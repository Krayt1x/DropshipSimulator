// The computer opponent's decision-making (#single-player-vs-computer). Kept
// entirely pure/stateless — given a snapshot of the game, these functions
// answer "what would the bot do next" without touching React state at all.
// The actual state mutation happens in BattlePage.jsx, which calls these in
// a loop and applies whatever they return.
import {
  hexDistance,
  isInWeaponArc,
  neighborHex,
  tileKey,
  visibleSides,
} from './hex.js';
import {
  parseWeaponRange,
  parseHeatRating,
  sizeNumber,
  isDropPodUnit,
  itemHasTag,
  tokenHasMovementTag,
  equippedItemsForSide,
} from './tokens.js';
import {
  hasLineOfSight,
  blocksMovement,
  objectiveHexesFrom,
} from './terrain.js';
import { parseArmor } from './combat.js';
import { parseHitDice, DICE_COLORS, DIE_TYPES } from './dice.js';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWeaponUsable(weaponState, item) {
  const { max } = parseHeatRating(item.heat_rating);
  const state = weaponState ?? { heat: 0, broken: false };
  return !state.broken && !(max && state.heat > max);
}

// Predicts whether firing right now would push a weapon's heat past its max
// (breaking it for the rest of the game) — used only by the expert bot,
// which weighs that risk instead of firing greedily like tactical does.
function wouldOverheat(weaponState, item) {
  const { generate, max } = parseHeatRating(item.heat_rating);
  if (!max) return false;
  const currentHeat = weaponState?.heat ?? 0;
  return currentHeat + generate > max;
}

// Same "Splash" detection BattlePage.jsx uses for its own attackWeapon
// (#123, #267) — duplicated here rather than shared since that one lives on
// a derived render-time value, not an exported helper. Checks the tag first
// (#267), falling back to the older free-text `effects` convention for any
// equipment that hasn't been re-tagged yet.
export function isSplashWeapon(item) {
  return Boolean(
    item &&
      (itemHasTag(item, 'splash') ||
        /target tile and all adjacent tiles/i.test(item.effects ?? '')),
  );
}

export function findUsableWeapons(token, equipment) {
  return token.equippedIds
    .map((id, instanceIndex) => {
      const item = equipment.find((e) => Number(e.id) === Number(id));
      if (item?.type !== 'Weapon' || !item.hit_dice) return null;
      if (!isWeaponUsable(token.weaponState[instanceIndex], item)) return null;
      return { item, instanceIndex };
    })
    .filter(Boolean);
}

// A "Fire"-tagged weapon (e.g. Flame Thrower) only deals real chassis damage
// when it hits a bare side — landing on a side with equipment mounted there
// converts the damage to heat instead (#125), which merely risks breaking
// that one item rather than costing any HP. Ranking it as if it were normal
// damage overvalued it in exactly that case (#209), so it's discounted hard
// rather than counted at face value.
const FIRE_DAMAGE_ON_EQUIPPED_SIDE_FACTOR = 0.25;

// Expected damage of one shot against a given armor side — no RNG, used only
// to rank targets. count * min(targetNumber, sides)/sides is the expected
// number of hits (roll-under-die, capped at 1 per die since a die can't score
// more than a 100% hit chance), fed into the same calculateDamage formula
// combat.js uses for a real roll. `targetToken`/`equipment` are optional —
// pass both to also apply the Fire-tag discount above; omit them (as target
// ranking not tied to a specific token, e.g. tests) to skip that check.
export function expectedDamage(weapon, targetUnit, side, targetToken, equipment) {
  const parsed = parseHitDice(weapon.hit_dice);
  if (!parsed || !targetUnit) return 0;
  const sides = Number(parsed.dieId.slice(1));
  const targetNumber = sizeNumber(targetUnit.size) ?? 0;
  const sideArmor = parseArmor(targetUnit.armor)?.[side] ?? 0;
  const expectedHits = parsed.count * (Math.min(targetNumber, sides) / sides);
  const rawDamage = Math.max(0, sides - sideArmor) * expectedHits;
  if (
    itemHasTag(weapon, 'fire') &&
    targetToken &&
    equipment &&
    equippedItemsForSide(targetToken, side, equipment).length > 0
  ) {
    return rawDamage * FIRE_DAMAGE_ON_EQUIPPED_SIDE_FACTOR;
  }
  return rawDamage;
}

function inRangeAndArc(attacker, item, side, targetPosition, tiles, terrainTypes) {
  const range = parseWeaponRange(item.range);
  if (!range || !attacker.position) return false;
  const d = hexDistance(attacker.position, targetPosition);
  if (d < range.min || d > range.max) return false;
  if (side && !isInWeaponArc(attacker.position, targetPosition, attacker.facing, side)) {
    return false;
  }
  // Blocking terrain stops a shot unless the weapon fires indirectly (#178,
  // #268). No map data means nothing can be blocking, so this only ever
  // narrows things down when tiles/terrainTypes are actually supplied.
  if (!tiles || !terrainTypes || itemHasTag(item, 'indirect_fire')) return true;
  return hasLineOfSight(attacker.position, targetPosition, tiles, terrainTypes);
}

function splashTemplateFor(origin) {
  return [
    origin,
    ...[0, 1, 2, 3, 4, 5].map((dir) => neighborHex(origin.col, origin.row, dir)),
  ];
}

function unitFor(token, units) {
  return units.find((u) => Number(u.id) === Number(token.unitId));
}

// Picks a die from the pool matching `preferredValue` ('Move'/'Attack')
// exactly (#237) — each color is single-purpose: Move only pays for
// movement, Attack only pays for attacks, Action only pays for actions
// like Drop Pods. Turning a spare die of one kind into another goes through
// findExchangeAction below instead of Action quietly covering either.
function pickDie(dicePool, preferredValue) {
  const unused = dicePool.filter((d) => !d.used);
  return unused.find((d) => d.value === preferredValue) ?? null;
}

// A die's own color caps what it can be exchanged into — a die that never
// rolls "Attack" on any of its faces can't become one (#200's green die, for
// instance, only ever shows Action/Move — see actionDice.json).
function distinctFacesForLabel(label) {
  const dieType = DIE_TYPES.find((dt) => dt.label === label);
  return dieType?.faces ? [...new Set(dieType.faces)] : [];
}

// Mirrors the human Exchange feature (#134): spend one unused die to change
// a different unused die's face to `neededValue`. Used when the pool has
// nothing of that value (or a flexible Action die) but does have two spare
// dice to trade — one consumed as the cost, the other's face rewritten —
// rather than the bot just giving up on an attack or move it otherwise could
// make (#200).
function findExchangeAction(dicePool, neededValue) {
  const unused = dicePool.filter((d) => !d.used);
  if (unused.length < 2) return null;
  const target = unused.find(
    (d) =>
      d.value !== neededValue &&
      distinctFacesForLabel(d.label).includes(neededValue),
  );
  if (!target) return null;
  const spend = unused.find((d) => d.id !== target.id);
  if (!spend) return null;
  return {
    type: 'exchange',
    spendId: spend.id,
    targetId: target.id,
    newValue: neededValue,
  };
}

function findAttackOptions({
  tokens,
  units,
  equipment,
  botOwner,
  difficulty,
  tiles,
  terrainTypes,
}) {
  const myTokens = tokens.filter(
    (t) => t.owner === botOwner && t.position && !t.destroyed,
  );
  // A wrecked (0 HP) model isn't a real target — it's waiting on its owner
  // to click "Model Destroyed", not something worth spending an Attack die
  // on (#182).
  const enemyTokens = tokens.filter(
    (t) =>
      t.owner !== botOwner &&
      t.position &&
      !t.destroyed &&
      (t.currentHp ?? 0) > 0,
  );
  const options = [];

  myTokens.forEach((attacker) => {
    findUsableWeapons(attacker, equipment).forEach(({ item, instanceIndex }) => {
      const side = attacker.weaponState[instanceIndex]?.side;
      if (isSplashWeapon(item)) {
        enemyTokens.forEach((enemy) => {
          if (
            !inRangeAndArc(
              attacker,
              item,
              side,
              enemy.position,
              tiles,
              terrainTypes,
            )
          ) {
            return;
          }
          const template = splashTemplateFor(enemy.position);
          const hitTokens = tokens.filter(
            (t) =>
              t.position &&
              !t.destroyed &&
              template.some(
                (h) => h.col === t.position.col && h.row === t.position.row,
              ),
          );
          const enemyHit = hitTokens.filter((t) => t.owner !== botOwner);
          const friendlyHit = hitTokens.filter((t) => t.owner === botOwner);
          // Every hit model takes the side nearest the blast's origin tile,
          // same as BattlePage's own splash resolution (#123).
          const ev = (list) =>
            list.reduce(
              (sum, t) =>
                sum +
                expectedDamage(
                  item,
                  unitFor(t, units),
                  visibleSides(t.position, t.facing, enemy.position)[0],
                  t,
                  equipment,
                ),
              0,
            );
          const enemyEv = ev(enemyHit);
          const friendlyEv = ev(friendlyHit);
          // Simple: fires at anything it can reach. Tactical: only pulls the
          // trigger if it does more expected damage to enemies than to
          // itself. Expert wants a clearer margin before risking a blast
          // near its own models, not just a nominally-favorable trade.
          const rejects =
            difficulty === 'simple'
              ? enemyHit.length === 0
              : difficulty === 'expert'
                ? enemyEv <= friendlyEv * 1.5
                : enemyEv <= friendlyEv;
          if (rejects) return;
          options.push({
            type: 'attack',
            isSplash: true,
            attackerId: attacker.id,
            instanceIndex,
            item,
            origin: enemy.position,
            ev: enemyEv - friendlyEv,
            overheats: wouldOverheat(attacker.weaponState[instanceIndex], item),
          });
        });
      } else {
        enemyTokens.forEach((enemy) => {
          if (
            !inRangeAndArc(
              attacker,
              item,
              side,
              enemy.position,
              tiles,
              terrainTypes,
            )
          ) {
            return;
          }
          const chosenSide = visibleSides(
            enemy.position,
            enemy.facing,
            attacker.position,
          )[0];
          options.push({
            type: 'attack',
            isSplash: false,
            attackerId: attacker.id,
            instanceIndex,
            item,
            targetId: enemy.id,
            side: chosenSide,
            ev: expectedDamage(
              item,
              unitFor(enemy, units),
              chosenSide,
              enemy,
              equipment,
            ),
            targetHp: enemy.currentHp,
            overheats: wouldOverheat(attacker.weaponState[instanceIndex], item),
            // Drop pods are a low-value chassis (#180) — worth attacking
            // only when nothing else is on the table, not preferred over a
            // "real" unit just because its armor makes the EV math attractive.
            isDropPodTarget: isDropPodUnit(unitFor(enemy, units)),
          });
        });
      }
    });
  });

  return options;
}

// The best expected damage among `options` that belong to `attackerId` —
// used to compare "what this token can do at its current facing" against
// "what it could do at some other facing" below. Mirrors the same
// overheat-safety preference chooseBotAction itself applies to the options
// it's willing to fire (expert only) so a facing isn't chosen just because it
// exposes a shot that difficulty would refuse to take anyway; simple/tactical
// judge purely on raw EV, same as their own `chosen` reduce below.
function bestOptionEv(options, attackerId, difficulty) {
  const mine = options.filter((o) => o.attackerId === attackerId);
  if (mine.length === 0) return -Infinity;
  const safe =
    difficulty === 'expert'
      ? mine.filter(
          (o) => !o.overheats || (o.targetHp != null && o.ev >= o.targetHp),
        )
      : mine;
  const beforePodFilter = safe.length > 0 ? safe : mine;
  // Same pod-deprioritization as chooseBotAction's own `viable` below — a
  // facing that merely trades a reachable real unit for a higher-EV drop pod
  // isn't actually the better facing chooseBotAction would settle on once it
  // gets there.
  const nonPod = beforePodFilter.filter((o) => !o.isDropPodTarget);
  const pool = nonPod.length > 0 ? nonPod : beforePodFilter;
  return pool.reduce((max, o) => Math.max(max, o.ev), -Infinity);
}

// Facing is free to change (matching the human rotate buttons in
// BattlePage.jsx: no die, no cooldown), but `findAttackOptions` only ever
// looks at a token's *current* facing — a side-mounted weapon whose arc
// doesn't happen to cover the nearest enemy right now simply never appears
// as an option at all, regardless of how much better it is than whatever
// does happen to be in arc (#302 pt2). This checks, for each of the bot's
// own tokens, whether spinning in place (same hex, no move) to a different
// facing would put a strictly better attack option into arc than anything
// available at the current facing — and if so, returns a free rotate action
// to take that facing instead of settling for the weaker in-arc option.
//
// Returns null once every token's current facing already offers its best
// possible option, so this can't oscillate: a token that just rotated to its
// best facing has nothing better left to rotate toward on the very next
// call, and the loop in chooseBotAction below falls through to actually
// firing instead.
function findRotateAction({
  tokens,
  units,
  equipment,
  botOwner,
  difficulty,
  tiles,
  terrainTypes,
  currentOptions,
}) {
  const myTokens = tokens.filter(
    (t) => t.owner === botOwner && t.position && !t.destroyed,
  );
  for (const attacker of myTokens) {
    const currentBest = bestOptionEv(currentOptions, attacker.id, difficulty);
    let bestFacing = null;
    let bestEv = currentBest;
    for (let facing = 0; facing < 6; facing++) {
      if (facing === attacker.facing) continue;
      const rotatedTokens = tokens.map((t) =>
        t.id === attacker.id ? { ...t, facing } : t,
      );
      const hypotheticalOptions = findAttackOptions({
        tokens: rotatedTokens,
        units,
        equipment,
        botOwner,
        difficulty,
        tiles,
        terrainTypes,
      });
      const ev = bestOptionEv(hypotheticalOptions, attacker.id, difficulty);
      if (ev > bestEv) {
        bestEv = ev;
        bestFacing = facing;
      }
    }
    if (bestFacing !== null) {
      return { type: 'rotate', tokenId: attacker.id, facing: bestFacing };
    }
  }
  return null;
}

function movementForToken(token, equipment) {
  const movementIndex = token.equippedIds.findIndex((id) => {
    const item = equipment.find((e) => Number(e.id) === Number(id));
    return item?.type === 'Movement';
  });
  if (movementIndex === -1) return 0;
  const movementItem = equipment.find(
    (e) => Number(e.id) === Number(token.equippedIds[movementIndex]),
  );
  // A broken or overheated movement item can't move the token at all (#153),
  // same as a broken/overheated weapon can't fire.
  if (!isWeaponUsable(token.weaponState[movementIndex], movementItem)) return 0;
  return Number(movementItem?.movement) || 0;
}

// A destroyed-eligible token (0 HP, not yet marked destroyed) blocks the rest
// of the bot's turn the same way it would block a human — you clean up your
// own wrecked model before doing anything else with it. Only the owning
// player's client ever handles this (`canControl` gates the human's "Model
// Destroyed" button the same way), so the bot only looks at its own tokens.
function findDestroyAction({ tokens, units, botOwner }) {
  const wreck = tokens.find(
    (t) => t.owner === botOwner && !t.destroyed && (t.currentHp ?? 0) <= 0,
  );
  if (!wreck) return null;
  const unit = unitFor(wreck, units);
  const dieColor =
    DICE_COLORS.find((color) => Number(unit?.[`dice_${color}`]) > 0) ?? null;
  return { type: 'destroy', tokenId: wreck.id, dieColor };
}

function closestToken(position, candidates) {
  return candidates.reduce((closest, t) => {
    if (!closest) return t;
    return hexDistance(position, t.position) < hexDistance(position, closest.position)
      ? t
      : closest;
  }, null);
}

// Tactical (and simple) always beeline for whichever enemy happens to be
// physically closest. Expert instead looks for the most wounded enemy
// among those roughly as close as the nearest one, so its footwork sets up
// finishing blows instead of just closing distance to whatever body is
// nearest.
function chooseMoveTarget(position, enemyTokens, difficulty) {
  const nearest = closestToken(position, enemyTokens);
  if (difficulty !== 'expert' || !nearest) return nearest;
  const nearestDist = hexDistance(position, nearest.position);
  const nearbyWounded = enemyTokens.filter(
    (t) => hexDistance(position, t.position) <= nearestDist + 2,
  );
  return nearbyWounded.reduce(
    (weakest, t) => (t.currentHp < weakest.currentHp ? t : weakest),
    nearbyWounded[0],
  );
}

// Brings a reserve drop pod in with a spare Action die (#157, #158) — aimed
// at whichever enemy is closest to the bot's own front line (or the first
// enemy, if nothing's deployed yet), matching a human reinforcing near where
// the fight already is rather than picking a spot at random.
function findDropPodAction({ tokens, units, botOwner, dicePool, enemyTokens }) {
  if (enemyTokens.length === 0) return null;
  const actionDie = dicePool.find((d) => !d.used && d.value === 'Action');
  if (!actionDie) return null;

  const podToken = tokens.find(
    (t) =>
      t.owner === botOwner &&
      !t.position &&
      !t.destroyed &&
      isDropPodUnit(unitFor(t, units)),
  );
  if (!podToken) return null;

  const myDeployed = tokens.filter(
    (t) => t.owner === botOwner && t.position && !t.destroyed,
  );
  const anchor = myDeployed[0]?.position ?? enemyTokens[0].position;
  const aim = (closestToken(anchor, enemyTokens) ?? enemyTokens[0]).position;

  return { type: 'dropPod', dieId: actionDie.id, tokenId: podToken.id, aim };
}

// Hex walk from `from` toward `to`, taking at most `maxSteps`, stopping once
// within `stopDistance` of the goal instead of always closing all the way in
// — lets the tactical bot hold its weapon's range band rather than walking
// into melee.
//
// `to` itself is frequently a hex `isBlocked` rejects (the enemy token being
// chased occupies it), so this can't just delegate to hex.js's hexPath/
// reachableHexes with `to` as the destination — nothing would ever be
// "reachable" at the actual target. Instead it runs its own step-by-step BFS
// outward from `from`, tracking (per step level) the closest any newly-
// visited hex gets to `to`, so a detour around a blocking hex (a wrecked
// model, a live one, terrain) is found even when the single neighbor that
// most directly reduces distance is blocked and no other neighbor does
// either — the case a naive greedy single-step lookahead can never escape,
// since it only ever compares this step's immediate neighbors and gives up
// the moment none of them individually improve on the current hex (#299).
export function stepToward(from, to, maxSteps, stopDistance, isBlocked) {
  const startDist = hexDistance(from, to);
  if (startDist <= stopDistance) return from;

  const visited = new Set([tileKey(from.col, from.row)]);
  let frontier = [from];
  let closest = { hex: from, dist: startDist };

  for (let step = 0; step < maxSteps && frontier.length > 0; step++) {
    const next = [];
    // Among this level's newly-reached hexes, prefer whichever lands closest
    // to (but still within) stopDistance — the least overshoot past the
    // range band the bot is trying to hold — rather than the first one
    // found, so kiting behavior doesn't depend on direction-scan order.
    let reachedStop = null;
    for (const hex of frontier) {
      for (let dir = 0; dir < 6; dir++) {
        const candidate = neighborHex(hex.col, hex.row, dir);
        const key = tileKey(candidate.col, candidate.row);
        if (visited.has(key) || isBlocked?.(candidate)) continue;
        visited.add(key);
        next.push(candidate);
        const d = hexDistance(candidate, to);
        if (d < closest.dist) closest = { hex: candidate, dist: d };
        if (d <= stopDistance && (!reachedStop || d > reachedStop.dist)) {
          reachedStop = { hex: candidate, dist: d };
        }
      }
    }
    if (reachedStop) return reachedStop.hex;
    frontier = next;
  }
  // Couldn't get within stopDistance inside the step budget — settle for
  // whatever reachable hex got closest, same "best effort" fallback the old
  // greedy walk gave when it ran out of maxSteps before closing the gap.
  return closest.hex;
}

// Objective hexes (#178) the bot doesn't already have uncontested — same
// "adjacent and nobody's contesting it" rule computeObjectiveVp scores by
// (src/lib/victory.js), reimplemented here since the bot only needs the
// hexes themselves, not the VP total.
function uncoveredObjectiveHexes({ objectiveHexes, myTokens, enemyTokens }) {
  return objectiveHexes.filter((hex) => {
    const secured = myTokens.some((t) => {
      if (hexDistance(t.position, hex) !== 1) return false;
      const contested = enemyTokens.some(
        (e) =>
          hexDistance(e.position, hex) === 1 ||
          hexDistance(e.position, t.position) === 1,
      );
      return !contested;
    });
    return !secured;
  });
}

// The actual "is there a useful move" decision, kept separate from the
// Move-die check (#200) so an exchange can be attempted when the answer is
// yes but the pool has no Move (or Action) die to spend on it yet.
function computeMoveCandidate({
  tokens,
  equipment,
  botOwner,
  difficulty,
  dimensions,
  tiles,
  terrainTypes,
  scenario,
  movedTokenIds,
  attackOptions,
}) {
  const allMyTokens = tokens.filter(
    (t) => t.owner === botOwner && t.position && !t.destroyed,
  );
  // A wrecked (0 HP) enemy isn't a real target to move toward any more than
  // it's a real target to shoot at (#182 excluded it from findAttackOptions
  // the same way) — without this, a token whose nearest "enemy" happens to
  // be a corpse it's already standing next to fixates on it forever (it's
  // already as close as it can get to an occupied hex, so there's nothing
  // left to do), never advancing on the actually-threatening enemies farther
  // off. Reported as the bot's other units "seemingly stuck" around a 0 HP
  // model on the board (#299).
  const enemyTokens = tokens.filter(
    (t) =>
      t.owner !== botOwner &&
      t.position &&
      !t.destroyed &&
      (t.currentHp ?? 0) > 0,
  );
  if (enemyTokens.length === 0) return null;

  const occupied = new Set(
    tokens
      .filter((t) => t.position && !t.destroyed)
      .map((t) => `${t.position.col},${t.position.row}`),
  );

  // A model that needs several Move dice to close a long distance would
  // otherwise keep winning the "first token with somewhere to go" scan below
  // every time, soaking up every Move die this turn while the rest of the
  // roster never gets a look-in (#254). Trying tokens that haven't moved yet
  // first spreads a turn's dice across the roster instead; only once every
  // untouched token is either out of moves or already in range does a
  // repeat mover become eligible again.
  const untried = allMyTokens.filter((t) => !movedTokenIds?.has(t.id));
  const myTokens = untried.length > 0 ? untried : allMyTokens;

  // The "Scenario Control" scenario (#232, renamed/rebalanced #259) is won
  // by holding objectives, not by wiping out the enemy — without this the
  // bot just kept fighting toward the nearest enemy regardless of scenario
  // and never went near an objective (#233).
  const objectiveHexes =
    scenario === 'first-to-11' && tiles && terrainTypes
      ? objectiveHexesFrom(tiles, terrainTypes)
      : [];
  const uncovered = objectiveHexes.length
    ? uncoveredObjectiveHexes({ objectiveHexes, myTokens, enemyTokens })
    : [];

  for (const token of myTokens) {
    const maxMove = movementForToken(token, equipment);
    if (maxMove <= 0) continue;
    // Water/buildings block a step that isn't already flying (#178) —
    // checked per-token since flying depends on the mover's own gear.
    const flies = tiles && terrainTypes && tokenHasMovementTag(token, equipment, 'flying');
    const isBlocked = (hex) =>
      occupied.has(`${hex.col},${hex.row}`) ||
      (Boolean(dimensions) &&
        (hex.col < 0 ||
          hex.row < 0 ||
          hex.col >= dimensions.cols ||
          hex.row >= dimensions.rows)) ||
      (tiles && terrainTypes && !flies && blocksMovement(tiles, terrainTypes, hex));
    const weapons = findUsableWeapons(token, equipment);
    const bestRange = weapons.length
      ? Math.max(
          ...weapons.map((w) => parseWeaponRange(w.item.range)?.max ?? 0),
        )
      : 0;

    // Holding an uncovered objective outranks chasing the enemy while the
    // scenario has one on offer — attacking is decided separately, earlier
    // in chooseBotAction, so this only affects idle/out-of-range models'
    // repositioning, never whether an in-range shot gets taken.
    let moveTarget;
    let stopDistance;
    if (uncovered.length > 0) {
      const nearestObjective = uncovered.reduce((best, hex) => {
        const dist = hexDistance(token.position, hex);
        return !best || dist < best.dist ? { hex, dist } : best;
      }, null);
      moveTarget = { position: nearestObjective.hex };
      stopDistance = 0;
    } else {
      moveTarget = chooseMoveTarget(token.position, enemyTokens, difficulty);
      if (!moveTarget) continue;
      // Whether this token already has something worth shooting right now —
      // checked against the real attack options (arc + line-of-sight aware),
      // not just raw hex distance to its longest weapon's range. Distance
      // alone used to let a token sit idle forever believing it was "close
      // enough" when its facing or blocking terrain meant it could never
      // actually land a shot from there (#277, #280).
      const hasValidShot = attackOptions?.some((o) => o.attackerId === token.id);
      if (hasValidShot) continue;
      stopDistance = difficulty !== 'simple' && bestRange > 0 ? bestRange : 0;
    }

    const destination = stepToward(
      token.position,
      moveTarget.position,
      maxMove,
      stopDistance,
      isBlocked,
    );
    if (
      destination.col === token.position.col &&
      destination.row === token.position.row
    ) {
      continue;
    }
    return { tokenId: token.id, destination };
  }
  return null;
}

function findMoveAction(args) {
  const moveDie = pickDie(args.dicePool, 'Move');
  if (!moveDie) return null;
  const candidate = computeMoveCandidate(args);
  if (!candidate) return null;
  return { type: 'move', dieId: moveDie.id, ...candidate };
}

// The single entry point BattlePage.jsx's runBotTurn calls in a loop: given
// the current game state, return the next thing the bot should do, or null
// once there's nothing useful left (the signal to end its turn).
export function chooseBotAction({
  tokens,
  units,
  equipment,
  botOwner,
  dicePool,
  difficulty,
  dimensions,
  tiles,
  terrainTypes,
  scenario,
  movedTokenIds,
}) {
  // Clean up a wrecked model before doing anything else with it (#154) —
  // doesn't need an enemy on the board or spend a dice-pool die, matching
  // the human "Model Destroyed" button, which is always available and free.
  const destroyAction = findDestroyAction({ tokens, units, botOwner });
  if (destroyAction) return destroyAction;

  const myTokens = tokens.filter(
    (t) => t.owner === botOwner && t.position && !t.destroyed,
  );
  const enemyTokens = tokens.filter(
    (t) => t.owner !== botOwner && t.position && !t.destroyed,
  );

  // With nothing deployed to attack or move with, reinforcing via a reserve
  // drop pod is the only thing left to try (#157, #158).
  if (myTokens.length === 0) {
    return findDropPodAction({ tokens, units, botOwner, dicePool, enemyTokens });
  }
  if (enemyTokens.length === 0) return null;

  const attackDie = pickDie(dicePool, 'Attack');
  // Computed either way (#200): even without an Attack die yet, knowing
  // whether there's actually something worth shooting decides whether an
  // Exchange is worth spending a second die on below.
  const options = findAttackOptions({
    tokens,
    units,
    equipment,
    botOwner,
    difficulty,
    tiles,
    terrainTypes,
  });
  if (attackDie) {
    // Free (no die spent, matching the human rotate buttons) — checked
    // before committing to fire whatever's already in arc at the current
    // facing, so a token whose facing merely hides its best weapon spins to
    // expose it first instead of resignedly firing a strictly worse one just
    // because that's what its current facing happens to allow (#302 pt2).
    // Only returns a facing when it's genuinely better than every option
    // reachable at the current one; a token already facing its best option
    // returns null here every time, so this can never oscillate turn over
    // turn or loop forever within a single turn (see findRotateAction).
    const rotateAction = findRotateAction({
      tokens,
      units,
      equipment,
      botOwner,
      difficulty,
      tiles,
      terrainTypes,
      currentOptions: options,
    });
    if (rotateAction) return rotateAction;

    // Expert avoids breaking a weapon on a shot that isn't worth the risk —
    // it only considers an overheating option when nothing safer is on the
    // table, or when that shot is itself the one that finishes the target.
    const safeOptions =
      difficulty === 'expert'
        ? options.filter(
            (o) => !o.overheats || (o.targetHp != null && o.ev >= o.targetHp),
          )
        : options;
    const beforePodFilter = safeOptions.length > 0 ? safeOptions : options;
    // Every difficulty avoids spending its Attack die on a drop pod while a
    // "real" unit is also reachable (#180) — only falls back to the pod when
    // it's the only target on offer.
    const nonPodOptions = beforePodFilter.filter((o) => !o.isDropPodTarget);
    const viable = nonPodOptions.length > 0 ? nonPodOptions : beforePodFilter;
    if (viable.length > 0) {
      // Simple still doesn't chase kills or break EV ties cleverly like
      // tactical/expert do below — but picking blind off whatever happened
      // to land first in `viable` (iteration order over a token's equipped
      // slots) let it fire a strictly worse weapon (fewer dice, worse heat,
      // no real damage into an equipped side) over a plainly better one just
      // because it appeared earlier in that list, with no comparison at all
      // (#302). Ranking by raw expected damage is the minimum every
      // difficulty needs to avoid a dominated weapon choice; kill-seeking
      // and overheat-awareness stay reserved for tactical/expert.
      const chosen =
        difficulty === 'simple'
          ? viable.reduce((best, o) => (o.ev > best.ev ? o : best))
          : viable.reduce((best, o) => {
              // Prefer a kill outright, otherwise the highest expected damage.
              const bestIsKill = best.targetHp != null && best.ev >= best.targetHp;
              const oIsKill = o.targetHp != null && o.ev >= o.targetHp;
              if (oIsKill && !bestIsKill) return o;
              if (bestIsKill && !oIsKill) return best;
              if (o.ev !== best.ev) return o.ev > best.ev ? o : best;
              // Expert breaks EV ties toward whichever target is closer to
              // death, to actually secure a kill on a future shot instead
              // of spreading damage evenly across the enemy line.
              if (
                difficulty === 'expert' &&
                o.targetHp != null &&
                best.targetHp != null
              ) {
                return o.targetHp < best.targetHp ? o : best;
              }
              return best;
            });
      return { ...chosen, dieId: attackDie.id };
    }
  }

  // Weapons in range get priority; otherwise reposition an already-deployed
  // model before spending a spare Action die on a reserve drop pod — a pod
  // competes for the exact same spare Action die a real model needs to close
  // in with, and a model already on the board is always worth more than one
  // still waiting in reserve (#157, #158, #230).
  const moveArgs = {
    tokens,
    equipment,
    botOwner,
    dicePool,
    difficulty,
    dimensions,
    tiles,
    terrainTypes,
    scenario,
    movedTokenIds,
    attackOptions: options,
  };
  const moveAction = findMoveAction(moveArgs);
  if (moveAction) return moveAction;

  const dropPodAction = findDropPodAction({
    tokens,
    units,
    botOwner,
    dicePool,
    enemyTokens,
  });
  if (dropPodAction) return dropPodAction;

  // No Move (or Action) die to spend, but exchanging into one would let a
  // token that actually wants to move do so this turn (#200). Checked before
  // exchanging for a bonus Attack below — a model that's never moved (or
  // never reached an objective) needs that die more than a model that can
  // already shoot does need one more shot (#277, #280).
  if (!pickDie(dicePool, 'Move') && computeMoveCandidate(moveArgs)) {
    return findExchangeAction(dicePool, 'Move');
  }

  // Only once nothing needs a Move die is a spare die worth exchanging into
  // one more Attack.
  if (!attackDie && options.length > 0) {
    const exchange = findExchangeAction(dicePool, 'Attack');
    if (exchange) return exchange;
  }
  return null;
}

// Spreads `count` reserve tokens across empty hexes inside the bot's
// deployment zone (`rows`, the row numbers BattlePage.jsx already computed
// for that owner's band) — simple even spacing rather than randomization, so
// tests stay deterministic.
export function pickDeploymentHexes({ count, rows, cols, occupied }) {
  const candidates = [];
  rows.forEach((row) => {
    for (let col = 0; col < cols; col++) {
      const key = `${col},${row}`;
      if (!occupied?.has(key)) candidates.push({ col, row });
    }
  });
  if (candidates.length === 0 || count <= 0) return [];
  const step = Math.max(1, Math.floor(candidates.length / count));
  const picked = [];
  for (let i = 0; i < candidates.length && picked.length < count; i += step) {
    picked.push(candidates[i]);
  }
  for (let i = 0; picked.length < count && i < candidates.length; i++) {
    if (!picked.includes(candidates[i])) picked.push(candidates[i]);
  }
  return picked.slice(0, count);
}
