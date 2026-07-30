// The computer opponent's decision-making (#single-player-vs-computer). Kept
// entirely pure/stateless — given a snapshot of the game, these functions
// answer "what would the bot do next" without touching React state at all.
// The actual state mutation happens in BattlePage.jsx, which calls these in
// a loop and applies whatever they return.
import { hexDistance, isInWeaponArc, neighborHex, visibleSides } from './hex.js';
import {
  parseWeaponRange,
  parseHeatRating,
  sizeNumber,
  isDropPodUnit,
} from './tokens.js';
import { parseArmor } from './combat.js';
import { parseHitDice, DICE_COLORS } from './dice.js';

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isWeaponUsable(weaponState, item) {
  const { max } = parseHeatRating(item.heat_rating);
  const state = weaponState ?? { heat: 0, broken: false };
  return !state.broken && !(max && state.heat > max);
}

// Same "target tile and all adjacent tiles" detection BattlePage.jsx uses
// for its own attackWeapon (#123) — duplicated here rather than shared since
// that one lives on a derived render-time value, not an exported helper.
export function isSplashWeapon(item) {
  return Boolean(
    item && /target tile and all adjacent tiles/i.test(item.effects ?? ''),
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

// Expected damage of one shot against a given armor side — no RNG, used only
// to rank targets. count * min(targetNumber, sides)/sides is the expected
// number of hits (roll-under-die, capped at 1 per die since a die can't score
// more than a 100% hit chance), fed into the same calculateDamage formula
// combat.js uses for a real roll.
export function expectedDamage(weapon, targetUnit, side) {
  const parsed = parseHitDice(weapon.hit_dice);
  if (!parsed || !targetUnit) return 0;
  const sides = Number(parsed.dieId.slice(1));
  const targetNumber = sizeNumber(targetUnit.size) ?? 0;
  const sideArmor = parseArmor(targetUnit.armor)?.[side] ?? 0;
  const expectedHits = parsed.count * (Math.min(targetNumber, sides) / sides);
  return Math.max(0, sides - sideArmor) * expectedHits;
}

function inRangeAndArc(attacker, item, side, targetPosition) {
  const range = parseWeaponRange(item.range);
  if (!range || !attacker.position) return false;
  const d = hexDistance(attacker.position, targetPosition);
  if (d < range.min || d > range.max) return false;
  if (!side) return true;
  return isInWeaponArc(attacker.position, targetPosition, attacker.facing, side);
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

// Picks a die from the pool matching `preferredValue` ('Move'/'Attack'), or
// an 'Action' die as a flexible fallback — mirrors the Move/Action/Attack
// die-face economy (WORD_ORDER in dice.js) without hard-coding it here.
function pickDie(actionPool, preferredValue) {
  const unused = actionPool.filter((d) => !d.used);
  return (
    unused.find((d) => d.value === preferredValue) ??
    unused.find((d) => d.value === 'Action') ??
    null
  );
}

function findAttackOptions({ tokens, units, equipment, botOwner, difficulty }) {
  const myTokens = tokens.filter(
    (t) => t.owner === botOwner && t.position && !t.destroyed,
  );
  const enemyTokens = tokens.filter(
    (t) => t.owner !== botOwner && t.position && !t.destroyed,
  );
  const options = [];

  myTokens.forEach((attacker) => {
    findUsableWeapons(attacker, equipment).forEach(({ item, instanceIndex }) => {
      const side = attacker.weaponState[instanceIndex]?.side;
      if (isSplashWeapon(item)) {
        enemyTokens.forEach((enemy) => {
          if (!inRangeAndArc(attacker, item, side, enemy.position)) return;
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
                ),
              0,
            );
          const enemyEv = ev(enemyHit);
          const friendlyEv = ev(friendlyHit);
          // Simple: fires at anything it can reach. Tactical: only pulls the
          // trigger if it does more expected damage to enemies than to itself.
          if (difficulty === 'simple' ? enemyHit.length === 0 : enemyEv <= friendlyEv) {
            return;
          }
          options.push({
            type: 'attack',
            isSplash: true,
            attackerId: attacker.id,
            instanceIndex,
            item,
            origin: enemy.position,
            ev: enemyEv - friendlyEv,
          });
        });
      } else {
        enemyTokens.forEach((enemy) => {
          if (!inRangeAndArc(attacker, item, side, enemy.position)) return;
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
            ev: expectedDamage(item, unitFor(enemy, units), chosenSide),
            targetHp: enemy.currentHp,
          });
        });
      }
    });
  });

  return options;
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

// Brings a reserve drop pod in with a spare Action die (#157, #158) — aimed
// at whichever enemy is closest to the bot's own front line (or the first
// enemy, if nothing's deployed yet), matching a human reinforcing near where
// the fight already is rather than picking a spot at random.
function findDropPodAction({ tokens, units, botOwner, actionPool, enemyTokens }) {
  if (enemyTokens.length === 0) return null;
  const actionDie = actionPool.find((d) => !d.used && d.value === 'Action');
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

// Greedy hex walk from `from` toward `to`, taking at most `maxSteps`,
// stopping once within `stopDistance` of the goal instead of always closing
// all the way in — lets the tactical bot hold its weapon's range band rather
// than walking into melee. No pathfinding exists elsewhere in the repo to
// reuse (movement is otherwise unenforced, see BattlePage.jsx's moveRange).
export function stepToward(from, to, maxSteps, stopDistance, isBlocked) {
  let current = from;
  for (let i = 0; i < maxSteps; i++) {
    if (hexDistance(current, to) <= stopDistance) break;
    let best = null;
    let bestDist = hexDistance(current, to);
    for (let dir = 0; dir < 6; dir++) {
      const candidate = neighborHex(current.col, current.row, dir);
      if (isBlocked?.(candidate)) continue;
      const d = hexDistance(candidate, to);
      if (d < bestDist) {
        bestDist = d;
        best = candidate;
      }
    }
    if (!best) break;
    current = best;
  }
  return current;
}

function findMoveAction({
  tokens,
  equipment,
  botOwner,
  actionPool,
  difficulty,
  dimensions,
}) {
  const moveDie = pickDie(actionPool, 'Move');
  if (!moveDie) return null;

  const myTokens = tokens.filter(
    (t) => t.owner === botOwner && t.position && !t.destroyed,
  );
  const enemyTokens = tokens.filter(
    (t) => t.owner !== botOwner && t.position && !t.destroyed,
  );
  if (enemyTokens.length === 0) return null;

  const occupied = new Set(
    tokens
      .filter((t) => t.position && !t.destroyed)
      .map((t) => `${t.position.col},${t.position.row}`),
  );
  const isBlocked = (hex) =>
    occupied.has(`${hex.col},${hex.row}`) ||
    (Boolean(dimensions) &&
      (hex.col < 0 ||
        hex.row < 0 ||
        hex.col >= dimensions.cols ||
        hex.row >= dimensions.rows));

  for (const token of myTokens) {
    const maxMove = movementForToken(token, equipment);
    if (maxMove <= 0) continue;
    const nearestEnemy = closestToken(token.position, enemyTokens);
    if (!nearestEnemy) continue;

    const weapons = findUsableWeapons(token, equipment);
    const bestRange = weapons.length
      ? Math.max(
          ...weapons.map((w) => parseWeaponRange(w.item.range)?.max ?? 0),
        )
      : 0;
    const currentDist = hexDistance(token.position, nearestEnemy.position);
    if (bestRange > 0 && currentDist <= bestRange) continue;

    const stopDistance = difficulty === 'tactical' && bestRange > 0 ? bestRange : 0;
    const destination = stepToward(
      token.position,
      nearestEnemy.position,
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
    return { type: 'move', dieId: moveDie.id, tokenId: token.id, destination };
  }
  return null;
}

// The single entry point BattlePage.jsx's runBotTurn calls in a loop: given
// the current game state, return the next thing the bot should do, or null
// once there's nothing useful left (the signal to end its turn).
export function chooseBotAction({
  tokens,
  units,
  equipment,
  botOwner,
  actionPool,
  difficulty,
  dimensions,
}) {
  // Clean up a wrecked model before doing anything else with it (#154) —
  // doesn't need an enemy on the board or spend an action-pool die, matching
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
    return findDropPodAction({ tokens, units, botOwner, actionPool, enemyTokens });
  }
  if (enemyTokens.length === 0) return null;

  const attackDie = pickDie(actionPool, 'Attack');
  if (attackDie) {
    const options = findAttackOptions({
      tokens,
      units,
      equipment,
      botOwner,
      difficulty,
    });
    if (options.length > 0) {
      const chosen =
        difficulty === 'tactical'
          ? options.reduce((best, o) => {
              // Prefer a kill outright, otherwise the highest expected damage.
              const bestIsKill = best.targetHp != null && best.ev >= best.targetHp;
              const oIsKill = o.targetHp != null && o.ev >= o.targetHp;
              if (oIsKill && !bestIsKill) return o;
              if (bestIsKill && !oIsKill) return best;
              return o.ev > best.ev ? o : best;
            })
          : options[0];
      return { ...chosen, dieId: attackDie.id };
    }
  }

  // Weapons in range get priority; otherwise use a spare Action die to bring
  // in a reserve drop pod before falling back to repositioning (#157, #158).
  const dropPodAction = findDropPodAction({
    tokens,
    units,
    botOwner,
    actionPool,
    enemyTokens,
  });
  if (dropPodAction) return dropPodAction;

  return findMoveAction({
    tokens,
    equipment,
    botOwner,
    actionPool,
    difficulty,
    dimensions,
  });
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
