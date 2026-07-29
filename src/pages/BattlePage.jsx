import { useEffect, useRef, useState } from 'react';
import {
  useLocalStorageState,
  useSyncedTransientState,
  makeKey,
} from '../lib/storage.js';
import { backgroundContainerStyle } from '../lib/mapBackground.js';
import { formatRollLogMessage, parseHitDice } from '../lib/dice.js';
import {
  hexLine,
  hexDistance,
  isInWeaponArc,
  visibleSides,
  neighborHex,
  nearestSide,
} from '../lib/hex.js';
import {
  createToken,
  OWNERS,
  deployedDiceByOwner,
  sumDiceTotals,
  parseWeaponRange,
  parseHeatRating,
  sizeNumber,
  ownerColor,
} from '../lib/tokens.js';
import {
  parseArmor,
  rollAttackDice,
  countHits,
  calculateDamage,
} from '../lib/combat.js';
import { DEFAULT_TURN, DEFAULT_BANKED_DICE } from '../lib/gameState.js';
import BattleBoard from '../components/BattleBoard.jsx';
import TokenCard from '../components/TokenCard.jsx';
import UnitCardHeader from '../components/UnitCardHeader.jsx';
import AttackModal from '../components/AttackModal.jsx';
import SplashAttackModal from '../components/SplashAttackModal.jsx';
import RosterImport from '../components/RosterImport.jsx';
import ReserveRosterPanel from '../components/ReserveRosterPanel.jsx';
import DestroyedList from '../components/DestroyedList.jsx';
import TurnTracker from '../components/TurnTracker.jsx';
import TurnOrder from '../components/TurnOrder.jsx';
import MobileTabBar from '../components/MobileTabBar.jsx';
import TurnNotificationToast from '../components/TurnNotificationToast.jsx';
import DiceRoller from '../components/DiceRoller.jsx';
import GameLog from '../components/GameLog.jsx';
import manufacturers from '../data/manufacturers.json';
import units from '../data/units.json';
import equipment from '../data/equipment.json';

const DEFAULT_TILE_TYPES = [
  { id: 'plain', name: 'Plain', color: '#78716c' },
  { id: 'buildings', name: 'Buildings', color: '#9ca3af' },
  { id: 'forest', name: 'Forest', color: '#14532d' },
  { id: 'objective', name: 'Objective', color: '#f97316' },
];
const DEFAULT_DIMENSIONS = { cols: 24, rows: 24 };
// Must match .battle-board-viewport's width in index.css.
const BOARD_WIDTH = 1000;
// .battle-board-viewport's own padding (1rem each side) + border (1px each
// side) — subtracted so the board fits inside it without an unwanted
// horizontal scrollbar at 100% zoom.
const BOARD_PADDING = 34;
// Rough allowance for everything above/around the board viewport (nav bar,
// page header, turn tracker, deployment controls, zoom controls) so the
// auto-fit zoom keeps the whole board on screen without vertical scrolling.
const BOARD_CHROME_HEIGHT = 300;
// .container-wide's own 1.5rem padding on each side (#101) — the only other
// horizontal chrome around the board once it's narrower than BOARD_WIDTH.
const CONTAINER_PADDING = 48;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

function BattlePage() {
  const [tileTypes] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tileTypes',
    DEFAULT_TILE_TYPES,
  );
  const [dimensions] = useLocalStorageState(
    'dropshipsimulator:mapEditor:dimensions',
    DEFAULT_DIMENSIONS,
  );
  const [tiles] = useLocalStorageState('dropshipsimulator:mapEditor:tiles', {});
  const [background] = useLocalStorageState(
    'dropshipsimulator:mapEditor:background',
    null,
  );
  const [tokens, setTokens] = useLocalStorageState(
    'dropshipsimulator:battle:tokens',
    [],
  );
  const [deploymentPhase, setDeploymentPhase] = useLocalStorageState(
    'dropshipsimulator:battle:deploymentPhase',
    true,
  );
  const [myPlayer] = useLocalStorageState('dropshipsimulator:myPlayer', null);
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [movingTokenId, setMovingTokenId] = useState(null);
  const [rangeWeapon, setRangeWeapon] = useState(null);
  // Attack workflow (#103): attackWeapon marks which weapon is armed for
  // attacking (also drives the arc display via rangeWeapon); attackTarget +
  // attackResult track the in-progress modal once a valid target is picked.
  const [attackWeapon, setAttackWeapon] = useState(null);
  const [attackTarget, setAttackTarget] = useState(null);
  const [attackResult, setAttackResult] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [zoom, setZoom] = useState(1);
  const diceRollerRef = useRef(null);
  // Which of the 4 panels is showing on narrow (mobile) viewports (#101) —
  // replaces the old slide-in overlay/tray approach. Irrelevant on desktop,
  // where all 4 panels render at once in the existing 3-column layout.
  const [mobileTab, setMobileTab] = useState('board');
  // Mirrored to the other player over the multiplayer data channel (#117,
  // #118) rather than just local state, since these are transient
  // animations, not part of the persisted game state.
  const [animatingToken, setAnimatingToken] = useSyncedTransientState(
    'dropshipsimulator:battle:animatingToken',
    null,
  );
  const moveTimeoutsRef = useRef([]);
  const [deployEffect, setDeployEffect] = useSyncedTransientState(
    'dropshipsimulator:battle:deployEffect',
    null,
  );
  const deployEffectTimeoutRef = useRef(null);
  const [turnNotice, setTurnNotice] = useSyncedTransientState(
    'dropshipsimulator:battle:turnNotice',
    null,
  );
  // Lets each player see roughly what the other has in focus — their
  // selected token, whether they've armed it to move, and any weapon range
  // they're viewing (#135) — keyed by owner so each player's slot doesn't
  // clobber the other's.
  const [peerFocus, setPeerFocus] = useSyncedTransientState(
    'dropshipsimulator:battle:peerFocus',
    {},
  );
  const [hoverInfo, setHoverInfo] = useState(null);

  function handleHoverToken(tokenId, x, y) {
    setHoverInfo(tokenId ? { tokenId, x, y } : null);
  }

  useEffect(() => {
    return () => moveTimeoutsRef.current.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    return () => clearTimeout(deployEffectTimeoutRef.current);
  }, []);

  // A brief puff-of-smoke effect where a token just landed (#112), matching
  // .deploy-smoke-puff's animation duration in index.css (#117).
  const DEPLOY_SMOKE_DURATION_MS = 1400;
  function triggerDeployEffect(tokenId, col, row) {
    clearTimeout(deployEffectTimeoutRef.current);
    setDeployEffect({ tokenId, position: { col, row } });
    deployEffectTimeoutRef.current = setTimeout(
      () => setDeployEffect(null),
      DEPLOY_SMOKE_DURATION_MS,
    );
  }
  const [viewportHeight, setViewportHeight] = useState(
    () => window.innerHeight,
  );
  // Tracked alongside viewportHeight (#101) so the board's auto-fit sizing
  // actually shrinks to fit a narrow phone screen instead of always fitting
  // to a desktop-width assumption and relying on the viewport's own
  // overflow-scroll to hide the rest.
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);

  useEffect(() => {
    function onResize() {
      setViewportHeight(window.innerHeight);
      setViewportWidth(window.innerWidth);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [turn, setTurn] = useLocalStorageState(
    'dropshipsimulator:battle:turn',
    DEFAULT_TURN,
  );
  const [logEntries, setLogEntries] = useLocalStorageState(
    'dropshipsimulator:battle:log',
    [],
  );
  const [bankedDice, setBankedDice] = useLocalStorageState(
    'dropshipsimulator:battle:bankedDice',
    DEFAULT_BANKED_DICE,
  );
  const [actionPool, setActionPool] = useLocalStorageState(
    'dropshipsimulator:battle:actionPool',
    [],
  );

  function appendLog(message) {
    setLogEntries((current) =>
      [{ id: makeKey('log'), message }, ...current].slice(0, 200),
    );
  }

  function unitName(token) {
    return (
      units.find((u) => Number(u.id) === Number(token.unitId))?.name ?? 'Unit'
    );
  }

  function ownerLabel(ownerId) {
    return OWNERS.find((o) => o.id === ownerId)?.label ?? ownerId;
  }

  function endTurn() {
    const endingPlayer = turn.active;
    const next =
      turn.active === 'p1'
        ? { number: turn.number, active: 'p2' }
        : { number: turn.number + 1, active: 'p1' };
    setTurn(next);
    appendLog(`${ownerLabel(endingPlayer)} ended their turn`);
    // A ding + toast tells whoever's screen it now is that it's their turn
    // (#131); `id` (not just `active`) so the toast re-triggers even though
    // there are only two possible values to alternate between.
    setTurnNotice({ id: makeKey('turn'), active: next.active });
    // Weapons (and Movement gear) cool by 1 heat for the player whose turn
    // just ended (#121).
    setTokens((current) =>
      current.map((t) =>
        t.owner === endingPlayer
          ? {
              ...t,
              weaponState: Object.fromEntries(
                Object.entries(t.weaponState).map(([index, state]) => [
                  index,
                  { ...state, heat: Math.max(0, (state.heat ?? 0) - 1) },
                ]),
              ),
            }
          : t,
      ),
    );
    setActionPool([]);
    setLastAction(null);
  }

  function handleDiceRoll(rolled) {
    appendLog(formatRollLogMessage(rolled));
  }

  function rollToActionPool(dice) {
    setActionPool(dice.map((d) => ({ ...d, used: false })));
    setLastAction({ type: 'rollToPool', dieIds: dice.map((d) => d.id) });
  }

  function useActionPoolDie(dieId) {
    const die = actionPool.find((d) => d.id === dieId);
    setActionPool((current) =>
      current.map((d) => (d.id === dieId ? { ...d, used: true } : d)),
    );
    setLastAction({ type: 'useDie', dieId });
    if (die) appendLog(`Used a ${die.label.toLowerCase()} die: ${die.value}`);
  }

  // Spends one unused action die to re-roll a different unused action die's
  // outcome (#134) — DiceRoller picks the new value (it already has the
  // die-type/face data) and hands it up here to apply + log.
  function exchangeActionDie(spendId, targetId, newValue) {
    const spendDie = actionPool.find((d) => d.id === spendId);
    const targetDie = actionPool.find((d) => d.id === targetId);
    if (!spendDie || !targetDie) return;
    const previousValue = targetDie.value;
    setActionPool((current) =>
      current.map((d) => {
        if (d.id === spendId) return { ...d, used: true };
        if (d.id === targetId) return { ...d, value: newValue };
        return d;
      }),
    );
    setLastAction({ type: 'exchange', spendId, targetId, previousValue });
    appendLog(
      `Exchanged a ${spendDie.label.toLowerCase()} die to change ${targetDie.label}'s roll from ${previousValue} to ${newValue}`,
    );
  }

  function undoLastAction() {
    if (!lastAction) return;
    if (lastAction.type === 'rollToPool') {
      setActionPool((current) =>
        current.filter((d) => !lastAction.dieIds.includes(d.id)),
      );
      appendLog('Undid dice roll into Action Pool');
    } else if (lastAction.type === 'useDie') {
      setActionPool((current) =>
        current.map((d) =>
          d.id === lastAction.dieId ? { ...d, used: false } : d,
        ),
      );
      appendLog('Undid using a die from the Action Pool');
    } else if (lastAction.type === 'exchange') {
      const { spendId, targetId, previousValue } = lastAction;
      setActionPool((current) =>
        current.map((d) => {
          if (d.id === spendId) return { ...d, used: false };
          if (d.id === targetId) return { ...d, value: previousValue };
          return d;
        }),
      );
      appendLog('Undid an Exchange');
    } else if (lastAction.type === 'move') {
      const { tokenId, position, previousWeaponState } = lastAction;
      const occupant = tokenAt(`${position.col},${position.row}`);
      if (!occupant || occupant.id === tokenId) {
        setTokens((current) =>
          current.map((t) =>
            t.id === tokenId
              ? { ...t, position, weaponState: previousWeaponState }
              : t,
          ),
        );
      }
      const token = tokens.find((t) => t.id === tokenId);
      appendLog(`Undid ${token ? unitName(token) + "'s" : 'the'} last move`);
    }
    setLastAction(null);
  }

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null;
  const selectedUnit = selectedToken
    ? units.find((u) => Number(u.id) === Number(selectedToken.unitId))
    : null;
  const reserveTokens = tokens.filter((t) => !t.position && !t.destroyed);
  const destroyedTokens = tokens.filter((t) => t.destroyed);
  const playerDice = sumDiceTotals(
    deployedDiceByOwner(tokens, units),
    bankedDice,
  );
  const activeOwnerDice = playerDice[myPlayer ?? turn.active];

  function toggleWeaponRange(instanceIndex, range) {
    setRangeWeapon((current) =>
      current?.tokenId === selectedToken?.id &&
      current?.instanceIndex === instanceIndex
        ? null
        : { tokenId: selectedToken?.id, instanceIndex, range },
    );
  }

  const activeRangeSpec =
    rangeWeapon &&
    selectedToken?.id === rangeWeapon.tokenId &&
    selectedToken.position
      ? parseWeaponRange(rangeWeapon.range)
      : null;
  // "Synchronized Firing Pattern" lets Artillery target either arc (#97),
  // so it overrides the weapon's own mounted side for range purposes.
  const rangeItem = activeRangeSpec
    ? equipment.find(
        (e) =>
          Number(e.id) ===
          Number(selectedToken.equippedIds[rangeWeapon.instanceIndex]),
      )
    : null;
  const hasSyncFiringPattern = Boolean(
    activeRangeSpec &&
    selectedToken.equippedIds.some(
      (id) =>
        equipment.find((e) => Number(e.id) === Number(id))?.name ===
        'Synchronized Firing Pattern',
    ),
  );
  const weaponRange = activeRangeSpec
    ? {
        origin: selectedToken.position,
        ...activeRangeSpec,
        facing: selectedToken.facing,
        side:
          hasSyncFiringPattern && rangeItem?.name === 'Artillery'
            ? 'both'
            : selectedToken.weaponState[rangeWeapon.instanceIndex]?.side,
      }
    : null;

  // Broadcasts my own current focus so the other player can see it (#135).
  // Depends on the raw range-toggle state (rangeWeapon), not the `weaponRange`
  // object above — that's rebuilt fresh every render, so depending on it
  // directly would re-publish (and re-render) on every render forever.
  useEffect(() => {
    if (!myPlayer) return;
    setPeerFocus((current) => ({
      ...current,
      [myPlayer]: {
        selectedTokenId,
        isMoving: Boolean(movingTokenId),
        weaponRange,
      },
    }));
  }, [myPlayer, selectedTokenId, movingTokenId, rangeWeapon]);

  const otherPlayerId =
    myPlayer === 'p1' ? 'p2' : myPlayer === 'p2' ? 'p1' : null;
  const theirFocus = otherPlayerId ? peerFocus?.[otherPlayerId] : null;

  function startAttack(instanceIndex, item) {
    const isSame =
      attackWeapon?.tokenId === selectedToken?.id &&
      attackWeapon?.instanceIndex === instanceIndex;
    if (isSame) {
      setAttackWeapon(null);
      setRangeWeapon(null);
    } else {
      setAttackWeapon({ tokenId: selectedToken.id, instanceIndex, item });
      setRangeWeapon({
        tokenId: selectedToken.id,
        instanceIndex,
        range: item.range,
      });
    }
    setAttackTarget(null);
    setAttackResult(null);
  }

  function cancelAttack() {
    setAttackWeapon(null);
    setRangeWeapon(null);
    setAttackTarget(null);
    setAttackResult(null);
  }

  function pickAttackSide(side) {
    setAttackTarget((current) => (current ? { ...current, side } : current));
  }

  const attackTargetToken = attackTarget
    ? tokens.find((t) => t.id === attackTarget.tokenId)
    : null;
  const attackTargetUnit = attackTargetToken
    ? units.find((u) => Number(u.id) === Number(attackTargetToken.unitId))
    : null;
  const attackTargetNumber = attackTargetUnit
    ? sizeNumber(attackTargetUnit.size)
    : null;
  // Only sides actually visible from where the attacker is standing can be
  // picked (#126) — the target's own body blocks the rest.
  const attackerToken = attackWeapon
    ? tokens.find((t) => t.id === attackWeapon.tokenId)
    : null;
  const attackVisibleSides =
    attackTargetToken?.position && attackerToken?.position
      ? visibleSides(
          attackTargetToken.position,
          attackTargetToken.facing,
          attackerToken.position,
        )
      : null;

  // Artillery-style weapons roll once against every model under a 7-tile
  // splash template (the targeted tile plus its 6 neighbors) instead of a
  // single chosen target (#123) — detected off the same `effects` text
  // DropshipBuilder ships rather than hardcoding the weapon name.
  const isSplashWeapon = Boolean(
    attackWeapon &&
    /target tile and all adjacent tiles/i.test(attackWeapon.item.effects ?? ''),
  );
  const attackOrigin = attackTarget?.origin ?? null;
  const splashTemplate = attackOrigin
    ? [
        attackOrigin,
        ...[0, 1, 2, 3, 4, 5].map((dir) =>
          neighborHex(attackOrigin.col, attackOrigin.row, dir),
        ),
      ]
    : [];
  // Every model under the template is hit, friend or foe alike — a splash
  // template doesn't distinguish sides, only the tile grid does.
  const splashTargetTokens = attackOrigin
    ? tokens.filter(
        (t) =>
          t.position &&
          !t.destroyed &&
          splashTemplate.some(
            (tile) =>
              tile.col === t.position.col && tile.row === t.position.row,
          ),
      )
    : [];
  // A model actually standing on the targeted tile has its side picked
  // manually, same as a normal attack; every other model under the
  // template gets the side nearest the blast's origin tile (#123).
  const splashOriginToken =
    splashTargetTokens.find(
      (t) =>
        t.position.col === attackOrigin?.col &&
        t.position.row === attackOrigin?.row,
    ) ?? null;
  function splashSideFor(token) {
    if (splashOriginToken && token.id === splashOriginToken.id) {
      return attackTarget?.side ?? null;
    }
    return nearestSide(token.position, token.facing, attackOrigin);
  }
  const splashPreview = splashTargetTokens.map((token) => {
    const unit = units.find((u) => Number(u.id) === Number(token.unitId));
    return {
      tokenId: token.id,
      name: unitName(token),
      sizeLabel: unit?.size,
      side: splashSideFor(token),
      isManualSide: splashOriginToken?.id === token.id,
    };
  });

  // The attack roll is self-contained (its own dice, its own comparison to
  // the target's size) rather than going through the shared dice pool, since
  // that pool can hold unrelated Move/Action dice that a hit-vs-target-number
  // comparison has no meaning for.
  function rollAttack() {
    if (!attackWeapon || !attackTarget?.side) return;
    const attacker = tokens.find((t) => t.id === attackWeapon.tokenId);
    const rolled = rollAttackDice(attackWeapon.item.hit_dice);
    if (!attacker || !rolled) return;
    const currentHeat =
      attacker.weaponState[attackWeapon.instanceIndex]?.heat ?? 0;
    // Firing generates whatever the weapon's own heat_rating stipulates
    // (#124), not a flat +1.
    const { generate } = parseHeatRating(attackWeapon.item.heat_rating);
    setTokens((current) =>
      current.map((t) =>
        t.id === attackWeapon.tokenId
          ? {
              ...t,
              weaponState: {
                ...t.weaponState,
                [attackWeapon.instanceIndex]: {
                  ...t.weaponState[attackWeapon.instanceIndex],
                  heat: currentHeat + generate,
                },
              },
            }
          : t,
      ),
    );
    const armor = parseArmor(attackTargetUnit?.armor);
    const sideArmor = armor?.[attackTarget.side] ?? 0;
    const hits = countHits(rolled.rolls, attackTargetNumber ?? 0);
    const damage = calculateDamage(rolled.sides, sideArmor, hits);
    setAttackResult({
      rolls: rolled.rolls,
      sides: rolled.sides,
      sideArmor,
      hits,
      damage,
    });
    appendLog(
      `${unitName(attacker)}'s ${attackWeapon.item.name} rolled ${rolled.rolls.join(', ')} vs ${unitName(attackTargetToken)}'s ${attackTarget.side} (TN ${attackTargetNumber}) → ${hits} hit${hits === 1 ? '' : 's'}`,
    );
  }

  // Shared by both the single-target attack flow and the splash flow
  // (#123) — everything about landing `damage` on one `token`'s `side` is
  // identical either way, only how the side and damage were determined
  // differs between the two callers.
  function applyDamageToToken(token, side, damage, weaponItem) {
    function damageChassis(amount, note = '') {
      setTokens((current) =>
        current.map((t) =>
          t.id === token.id
            ? { ...t, currentHp: Math.max(0, t.currentHp - amount) }
            : t,
        ),
      );
      appendLog(
        `${unitName(token)} took ${amount} damage to the chassis${note}`,
      );
    }

    if (side === 'front' || side === 'rear') {
      damageChassis(damage);
      return;
    }

    const sideIndices = token.equippedIds
      .map((id, index) => ({ id, index }))
      .filter(({ index }) => token.weaponState[index]?.side === side);

    // Some weapons (e.g. Flame Thrower) apply their damage as heat instead
    // of HP loss (#125) — heat isn't a depleting resource, so there's no
    // rollover to a second item the way HP damage has.
    const damageAsHeat = /damage is applied as heat/i.test(
      weaponItem?.effects ?? '',
    );
    if (damageAsHeat && sideIndices.length > 0) {
      const { index, id } = sideIndices[0];
      const eqItem = equipment.find((e) => Number(e.id) === Number(id));
      const currentHeat = token.weaponState[index]?.heat ?? 0;
      setTokens((current) =>
        current.map((t) =>
          t.id === token.id
            ? {
                ...t,
                weaponState: {
                  ...t.weaponState,
                  [index]: {
                    ...t.weaponState[index],
                    heat: currentHeat + damage,
                  },
                },
              }
            : t,
        ),
      );
      appendLog(
        `${unitName(token)}'s ${eqItem?.name ?? 'equipment'} took ${damage} heat`,
      );
      return;
    }

    // Excess damage rolls over to the next item on the same side, then to
    // the chassis once that side has nothing left to absorb it (#122).
    let remaining = damage;
    const hits = [];
    sideIndices.forEach(({ id, index }) => {
      if (remaining <= 0) return;
      const eqItem = equipment.find((e) => Number(e.id) === Number(id));
      if (!eqItem) return;
      const maxHp = Number(eqItem.hp) || 0;
      const hp = token.weaponState[index]?.hp ?? maxHp;
      if (hp <= 0) return;
      const absorbed = Math.min(remaining, hp);
      remaining -= absorbed;
      hits.push({ index, name: eqItem.name, absorbed, nextHp: hp - absorbed });
    });

    if (hits.length > 0) {
      setTokens((current) =>
        current.map((t) => {
          if (t.id !== token.id) return t;
          const weaponState = { ...t.weaponState };
          hits.forEach(({ index, nextHp }) => {
            weaponState[index] = {
              ...weaponState[index],
              hp: nextHp,
              broken: nextHp <= 0 ? true : weaponState[index]?.broken,
            };
          });
          return { ...t, weaponState };
        }),
      );
      hits.forEach(({ name, absorbed, nextHp }) => {
        appendLog(
          `${unitName(token)}'s ${name} took ${absorbed} damage` +
            (nextHp <= 0 ? ' and broke' : ''),
        );
      });
    }

    if (remaining > 0) {
      damageChassis(remaining, ` (no ${side} equipment left to absorb it)`);
    }
  }

  function applyAttackDamage() {
    if (!attackTarget || !attackResult || !attackTargetToken) return;
    applyDamageToToken(
      attackTargetToken,
      attackTarget.side,
      attackResult.damage,
      attackWeapon?.item,
    );
    cancelAttack();
  }

  // One roll of the weapon's dice is checked against every model under the
  // splash template, each against its own target number and armor (#123).
  function rollSplashAttack() {
    if (!attackWeapon || !attackOrigin) return;
    if (splashOriginToken && !attackTarget?.side) return;
    const attacker = tokens.find((t) => t.id === attackWeapon.tokenId);
    const rolled = rollAttackDice(attackWeapon.item.hit_dice);
    if (!attacker || !rolled) return;
    const currentHeat =
      attacker.weaponState[attackWeapon.instanceIndex]?.heat ?? 0;
    const { generate } = parseHeatRating(attackWeapon.item.heat_rating);
    setTokens((current) =>
      current.map((t) =>
        t.id === attackWeapon.tokenId
          ? {
              ...t,
              weaponState: {
                ...t.weaponState,
                [attackWeapon.instanceIndex]: {
                  ...t.weaponState[attackWeapon.instanceIndex],
                  heat: currentHeat + generate,
                },
              },
            }
          : t,
      ),
    );

    const perTarget = splashTargetTokens.map((token) => {
      const unit = units.find((u) => Number(u.id) === Number(token.unitId));
      const side = splashSideFor(token);
      const targetNumber = sizeNumber(unit?.size);
      const sideArmor = parseArmor(unit?.armor)?.[side] ?? 0;
      const hits = countHits(rolled.rolls, targetNumber);
      const damage = calculateDamage(rolled.sides, sideArmor, hits);
      return {
        tokenId: token.id,
        name: unitName(token),
        side,
        targetNumber,
        hits,
        damage,
      };
    });

    setAttackResult({ rolls: rolled.rolls, sides: rolled.sides, perTarget });
    appendLog(
      `${unitName(attacker)}'s ${attackWeapon.item.name} hit the blast template at (${attackOrigin.col}, ${attackOrigin.row}), rolling ${rolled.rolls.join(', ')} against ${perTarget.length} target${perTarget.length === 1 ? '' : 's'}`,
    );
  }

  function applySplashDamage() {
    if (!attackResult?.perTarget) return;
    attackResult.perTarget.forEach(({ tokenId, side, damage }) => {
      const token = tokens.find((t) => t.id === tokenId);
      if (token) applyDamageToToken(token, side, damage, attackWeapon?.item);
    });
    cancelAttack();
  }

  function movementForToken(token) {
    const movementItem = token.equippedIds
      .map((id) => equipment.find((e) => Number(e.id) === Number(id)))
      .find((item) => item?.type === 'Movement');
    return Number(movementItem?.movement) || 0;
  }

  const selectedMovement =
    selectedToken?.position && !selectedToken.destroyed
      ? movementForToken(selectedToken)
      : 0;
  const moveRange =
    selectedMovement > 0
      ? { origin: selectedToken.position, max: selectedMovement }
      : null;

  function canControl(token) {
    return !myPlayer || token.owner === myPlayer;
  }

  // Capped at BOARD_WIDTH (desktop's fixed board width) but shrinks below
  // that on a narrow phone screen instead of overflowing it (#101).
  const availableWidth = Math.min(
    BOARD_WIDTH,
    viewportWidth - CONTAINER_PADDING,
  );
  const fitWidth =
    (availableWidth - BOARD_PADDING) / (1.5 * (dimensions.cols + 1));
  const availableHeight = Math.max(200, viewportHeight - BOARD_CHROME_HEIGHT);
  const fitHeight =
    (availableHeight - BOARD_PADDING) / (Math.sqrt(3) * (dimensions.rows + 1));
  const fitSize = Math.min(fitWidth, fitHeight);
  const boardSize = fitSize * zoom;

  function adjustZoom(delta) {
    setZoom((current) =>
      Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Number((current + delta).toFixed(2))),
      ),
    );
  }

  const topBoundaryRow = 2;
  const bottomBoundaryRow = dimensions.rows - 4;
  const deploymentZonesValid = bottomBoundaryRow > topBoundaryRow;
  const deploymentZones =
    deploymentPhase && deploymentZonesValid
      ? { topBoundaryRow, bottomBoundaryRow }
      : null;

  function tokenAt(key) {
    return tokens.find(
      (t) => t.position && `${t.position.col},${t.position.row}` === key,
    );
  }

  function placeTokenAt(tokenId, col, row) {
    setTokens((current) =>
      current.map((t) =>
        t.id === tokenId ? { ...t, position: { col, row } } : t,
      ),
    );
  }

  // Moving heats up a token's Movement gear by 1 (#102) — the heat display
  // itself turning orange at its stat and red/bold past it is handled in
  // TokenCard's renderGearRow, shared with weapon heat.
  function bumpMovementHeat(token) {
    const weaponState = { ...token.weaponState };
    token.equippedIds.forEach((id, index) => {
      const item = equipment.find((e) => Number(e.id) === Number(id));
      if (item?.type === 'Movement') {
        weaponState[index] = {
          ...weaponState[index],
          heat: (weaponState[index]?.heat ?? 0) + 1,
        };
      }
    });
    return weaponState;
  }

  function moveTokenTo(token, col, row) {
    if (token.position) {
      setLastAction({
        type: 'move',
        tokenId: token.id,
        position: token.position,
        previousWeaponState: token.weaponState,
      });
      appendLog(
        `${ownerLabel(token.owner)} moved ${unitName(token)} to (${col}, ${row})`,
      );
      const weaponState = bumpMovementHeat(token);
      setTokens((current) =>
        current.map((t) =>
          t.id === token.id ? { ...t, position: { col, row }, weaponState } : t,
        ),
      );
    } else {
      appendLog(
        `${ownerLabel(token.owner)} deployed ${unitName(token)} at (${col}, ${row})`,
      );
      placeTokenAt(token.id, col, row);
      triggerDeployEffect(token.id, col, row);
    }
  }

  // Steps a moving token through each hex between its old and new position
  // (#93) instead of jumping straight there; the real position/log/undo
  // update only happens once the animation reaches the destination.
  const MOVE_STEP_MS = 160;
  function animateMove(token, col, row) {
    moveTimeoutsRef.current.forEach(clearTimeout);
    moveTimeoutsRef.current = [];
    if (!token.position) {
      moveTokenTo(token, col, row);
      return;
    }
    const path = hexLine(token.position, { col, row });
    if (path.length <= 2) {
      setAnimatingToken(null);
      moveTokenTo(token, col, row);
      return;
    }
    path.slice(1, -1).forEach((hex, i) => {
      moveTimeoutsRef.current.push(
        setTimeout(
          () => {
            setAnimatingToken({ tokenId: token.id, position: hex });
          },
          MOVE_STEP_MS * (i + 1),
        ),
      );
    });
    moveTimeoutsRef.current.push(
      setTimeout(
        () => {
          setAnimatingToken(null);
          moveTokenTo(token, col, row);
        },
        MOVE_STEP_MS * (path.length - 1),
      ),
    );
  }

  function handleHexClick(key) {
    const [col, row] = key.split(',').map(Number);

    if (attackWeapon) {
      const attacker = tokens.find((t) => t.id === attackWeapon.tokenId);
      if (isSplashWeapon) {
        const validOrigin =
          attacker?.position &&
          weaponRange &&
          (() => {
            const d = hexDistance(attacker.position, { col, row });
            if (d < weaponRange.min || d > weaponRange.max) return false;
            if (!weaponRange.side) return true;
            return isInWeaponArc(
              attacker.position,
              { col, row },
              attacker.facing,
              weaponRange.side,
            );
          })();
        if (validOrigin) {
          setAttackTarget({ origin: { col, row }, side: null });
        } else {
          cancelAttack();
        }
        return;
      }
      const target = tokenAt(key);
      const valid =
        attacker &&
        target &&
        target.id !== attacker.id &&
        !target.destroyed &&
        target.owner !== attacker.owner &&
        weaponRange &&
        (() => {
          const d = hexDistance(attacker.position, target.position);
          if (d < weaponRange.min || d > weaponRange.max) return false;
          if (!weaponRange.side) return true;
          return isInWeaponArc(
            attacker.position,
            target.position,
            attacker.facing,
            weaponRange.side,
          );
        })();
      if (valid) {
        setAttackTarget({ tokenId: target.id, side: null });
      } else {
        cancelAttack();
      }
      return;
    }

    if (movingTokenId) {
      const movingToken = tokens.find((t) => t.id === movingTokenId);
      if (movingToken && canControl(movingToken)) {
        animateMove(movingToken, col, row);
      }
      setMovingTokenId(null);
      return;
    }

    const existing = tokenAt(key);
    setSelectedTokenId(existing ? existing.id : null);
  }

  function handleDropToken(tokenId, col, row) {
    if (tokenAt(`${col},${row}`)) return;
    const token = tokens.find((t) => t.id === tokenId);
    if (!token || !canControl(token)) return;
    animateMove(token, col, row);
    setSelectedTokenId(tokenId);
  }

  function updateSelected(patch) {
    setTokens((current) =>
      current.map((t) =>
        t.id === selectedTokenId ? { ...t, ...patch(t) } : t,
      ),
    );
  }

  function adjustHp(delta) {
    updateSelected((t) => ({ currentHp: t.currentHp + delta }));
  }

  function rotate(delta) {
    updateSelected((t) => ({ facing: (t.facing + delta + 6) % 6 }));
  }

  function setHeat(weaponId, heat) {
    updateSelected((t) => ({
      weaponState: {
        ...t.weaponState,
        [weaponId]: { ...t.weaponState[weaponId], heat },
      },
    }));
  }

  function setWeaponHp(weaponId, hp) {
    updateSelected((t) => ({
      weaponState: {
        ...t.weaponState,
        [weaponId]: { ...t.weaponState[weaponId], hp },
      },
    }));
  }

  function rollHitDice(instanceIndex, item) {
    const parsed = parseHitDice(item.hit_dice);
    if (!parsed) return;
    diceRollerRef.current?.addDice(parsed.dieId, parsed.count);
    const { generate } = parseHeatRating(item.heat_rating);
    if (generate > 0) {
      const currentHeat = selectedToken?.weaponState[instanceIndex]?.heat ?? 0;
      setHeat(instanceIndex, currentHeat + generate);
    }
  }

  function toggleBroken(weaponId) {
    updateSelected((t) => ({
      weaponState: {
        ...t.weaponState,
        [weaponId]: {
          ...t.weaponState[weaponId],
          broken: !t.weaponState[weaponId]?.broken,
        },
      },
    }));
  }

  function destroySelected(keptDiceColor) {
    if (selectedToken) {
      appendLog(
        `${ownerLabel(selectedToken.owner)}'s ${unitName(selectedToken)} was destroyed` +
          (keptDiceColor ? ` (kept a ${keptDiceColor} die)` : ''),
      );
      if (keptDiceColor) {
        const owner = selectedToken.owner;
        setBankedDice((current) => ({
          ...current,
          [owner]: {
            ...current[owner],
            [keptDiceColor]: (current[owner]?.[keptDiceColor] ?? 0) + 1,
          },
        }));
      }
    }
    updateSelected(() => ({
      destroyed: true,
      position: null,
      bankedDieColor: keptDiceColor ?? null,
    }));
    setMovingTokenId(null);
  }

  // Reverses the die banked at destruction time (if any) so redeploying a
  // returned model doesn't double-count its dice against the one already
  // added to the player's pool.
  function releaseBankedDie(token) {
    if (!token.bankedDieColor) return;
    const { owner, bankedDieColor } = token;
    setBankedDice((current) => ({
      ...current,
      [owner]: {
        ...current[owner],
        [bankedDieColor]: Math.max(
          0,
          (current[owner]?.[bankedDieColor] ?? 0) - 1,
        ),
      },
    }));
  }

  function returnSelectedToReserve() {
    if (selectedToken) {
      appendLog(`${unitName(selectedToken)} returned to reserve`);
      releaseBankedDie(selectedToken);
    }
    updateSelected(() => ({
      destroyed: false,
      position: null,
      bankedDieColor: null,
    }));
    setMovingTokenId(null);
  }

  function returnDestroyedToReserve(tokenId) {
    const token = tokens.find((t) => t.id === tokenId);
    if (token) {
      appendLog(`${unitName(token)} returned to reserve`);
      releaseBankedDie(token);
    }
    setTokens((current) =>
      current.map((t) =>
        t.id === tokenId
          ? { ...t, destroyed: false, position: null, bankedDieColor: null }
          : t,
      ),
    );
  }

  function importRoster({ entries, owner }) {
    const imported = entries.map(({ unit, equippedIds, equippedSides }) =>
      createToken({ unit, equippedIds, equippedSides, owner, position: null }),
    );
    setTokens((current) => [...current, ...imported]);
    appendLog(
      `${ownerLabel(owner)} imported ${imported.length} unit${imported.length === 1 ? '' : 's'} to reserve`,
    );
  }

  return (
    <div className="container-wide battle-page">
      <TurnNotificationToast notice={turnNotice} myPlayer={myPlayer} />
      <div className="battle-header-row">
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 4 }}>Battle board</h1>
          <p className="unit-meta" style={{ marginBottom: 20 }}>
            Place units from the catalogue, move them around, and track HP and
            weapon heat as you play. This tool manages state only — it's on you
            and your opponent to know and apply the rules.
          </p>
        </div>
        <TurnTracker turn={turn} onEndTurn={endTurn} playerDice={playerDice} />
      </div>

      <div className="deployment-controls">
        <button
          type="button"
          className={deploymentPhase ? '' : 'ghost'}
          disabled={!deploymentZonesValid}
          onClick={() => setDeploymentPhase((current) => !current)}
        >
          {deploymentPhase ? 'End deployment phase' : 'Deployment Phase'}
        </button>
        {!deploymentZonesValid && (
          <span className="unit-meta">
            Board needs at least 7 rows for deployment zones.
          </span>
        )}
      </div>

      <div className="battle-layout">
        <div
          className={`mobile-tab-panel ${mobileTab === 'units' ? 'mobile-tab-panel-active' : ''}`}
        >
          {deploymentPhase && (
            <RosterImport
              manufacturers={manufacturers}
              units={units}
              equipment={equipment}
              myPlayer={myPlayer}
              onImport={importRoster}
            />
          )}
          {selectedToken && !deploymentPhase && (
            <TokenCard
              key={selectedToken.id}
              token={selectedToken}
              unit={selectedUnit}
              equipment={equipment}
              moving={movingTokenId === selectedToken.id}
              canControl={canControl(selectedToken)}
              onAdjustHp={adjustHp}
              onRotate={rotate}
              onArmMove={() =>
                setMovingTokenId((current) =>
                  current === selectedToken.id ? null : selectedToken.id,
                )
              }
              onSetHeat={setHeat}
              onSetWeaponHp={setWeaponHp}
              onToggleBroken={toggleBroken}
              onRollHitDice={rollHitDice}
              activeRangeIndex={
                rangeWeapon?.tokenId === selectedToken.id
                  ? rangeWeapon.instanceIndex
                  : null
              }
              onToggleRange={toggleWeaponRange}
              onStartAttack={startAttack}
              activeAttackIndex={
                attackWeapon?.tokenId === selectedToken.id
                  ? attackWeapon.instanceIndex
                  : null
              }
              onDestroy={destroySelected}
              onReturnToReserve={returnSelectedToReserve}
              onDeselect={() => setSelectedTokenId(null)}
            />
          )}
          <ReserveRosterPanel
            reserveTokens={reserveTokens}
            allTokens={tokens}
            units={units}
            myPlayer={myPlayer}
            selectedTokenId={selectedTokenId}
            canControl={canControl}
            onSelect={setSelectedTokenId}
          />
          <DestroyedList
            tokens={destroyedTokens}
            units={units}
            selectedTokenId={selectedTokenId}
            canControl={canControl}
            onSelect={setSelectedTokenId}
            onReturnToReserve={returnDestroyedToReserve}
          />
        </div>
        <div
          className={`battle-board-column mobile-tab-panel ${mobileTab === 'board' ? 'mobile-tab-panel-active' : ''}`}
        >
          <div className="zoom-controls">
            <button
              type="button"
              className="ghost"
              aria-label="Zoom out"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => adjustZoom(-ZOOM_STEP)}
            >
              −
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="ghost"
              aria-label="Zoom in"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => adjustZoom(ZOOM_STEP)}
            >
              +
            </button>
          </div>
          <div
            className="battle-board-viewport"
            style={backgroundContainerStyle(background)}
          >
            <BattleBoard
              cols={dimensions.cols}
              rows={dimensions.rows}
              tiles={tiles}
              tileTypes={tileTypes}
              tokens={tokens}
              units={units}
              animatingToken={animatingToken}
              deployEffect={deployEffect}
              selectedTokenId={selectedTokenId}
              rangeOrigin={selectedToken?.position ?? null}
              weaponRange={weaponRange}
              moveRange={moveRange}
              deploymentZones={deploymentZones}
              hasBackground={Boolean(background)}
              size={boardSize}
              canControl={canControl}
              onHexClick={handleHexClick}
              onDropToken={handleDropToken}
              onHoverToken={handleHoverToken}
              peerSelectedTokenId={theirFocus?.selectedTokenId ?? null}
              peerIsMoving={Boolean(theirFocus?.isMoving)}
              peerWeaponRange={theirFocus?.weaponRange ?? null}
              peerColor={otherPlayerId ? ownerColor(otherPlayerId) : null}
            />
            {hoverInfo &&
              (() => {
                const hoverToken = tokens.find(
                  (t) => t.id === hoverInfo.tokenId,
                );
                const hoverUnit = hoverToken
                  ? units.find(
                      (u) => Number(u.id) === Number(hoverToken.unitId),
                    )
                  : null;
                if (!hoverToken || !hoverUnit) return null;
                const hoverEquippedItems = hoverToken.equippedIds
                  .map((id, instanceIndex) => {
                    const item = equipment.find(
                      (e) => Number(e.id) === Number(id),
                    );
                    return item ? { ...item, instanceIndex } : null;
                  })
                  .filter(Boolean);
                return (
                  <div
                    className="token-hover-card"
                    style={{ left: hoverInfo.x + 16, top: hoverInfo.y + 16 }}
                  >
                    <p className="unit-name">{hoverUnit.name}</p>
                    <UnitCardHeader
                      unit={hoverUnit}
                      token={hoverToken}
                      equippedItems={hoverEquippedItems}
                    />
                  </div>
                );
              })()}
            {attackTarget && attackWeapon && attackTargetToken && (
              <AttackModal
                attackerName={unitName(
                  tokens.find((t) => t.id === attackWeapon.tokenId),
                )}
                weaponName={attackWeapon.item.name}
                hitDice={attackWeapon.item.hit_dice}
                heatGenerate={
                  parseHeatRating(attackWeapon.item.heat_rating).generate
                }
                targetName={unitName(attackTargetToken)}
                targetSizeLabel={attackTargetUnit?.size}
                targetNumber={attackTargetNumber}
                visibleSides={attackVisibleSides}
                side={attackTarget.side}
                onPickSide={pickAttackSide}
                result={attackResult}
                onRoll={rollAttack}
                onApply={applyAttackDamage}
                onCancel={cancelAttack}
              />
            )}
            {attackTarget && attackWeapon && attackOrigin && (
              <SplashAttackModal
                attackerName={unitName(
                  tokens.find((t) => t.id === attackWeapon.tokenId),
                )}
                weaponName={attackWeapon.item.name}
                hitDice={attackWeapon.item.hit_dice}
                heatGenerate={
                  parseHeatRating(attackWeapon.item.heat_rating).generate
                }
                origin={attackOrigin}
                targets={splashPreview}
                side={attackTarget.side}
                onPickSide={pickAttackSide}
                result={attackResult}
                onRoll={rollSplashAttack}
                onApply={applySplashDamage}
                onCancel={cancelAttack}
              />
            )}
            {selectedToken &&
              !selectedToken.destroyed &&
              canControl(selectedToken) && (
                <button
                  type="button"
                  className="mobile-move-fab"
                  onClick={() =>
                    setMovingTokenId((current) =>
                      current === selectedToken.id ? null : selectedToken.id,
                    )
                  }
                >
                  {movingTokenId === selectedToken.id
                    ? 'Cancel'
                    : selectedToken.position
                      ? 'Move'
                      : 'Deploy'}
                </button>
              )}
          </div>
        </div>
        <div>
          <div
            className={`mobile-tab-panel ${mobileTab === 'dice' ? 'mobile-tab-panel-active' : ''}`}
          >
            <DiceRoller
              ref={diceRollerRef}
              onRoll={handleDiceRoll}
              actionPool={actionPool}
              onRollToActionPool={rollToActionPool}
              onUseActionPoolDie={useActionPoolDie}
              onExchangeActionDice={exchangeActionDie}
              activeOwnerDice={activeOwnerDice}
              canRoll={!myPlayer || myPlayer === turn.active}
            />
          </div>
          <div
            className={`mobile-tab-panel ${mobileTab === 'log' ? 'mobile-tab-panel-active' : ''}`}
          >
            <TurnOrder />
            <div className="card">
              <button
                type="button"
                className="ghost"
                style={{ width: '100%' }}
                disabled={!lastAction}
                onClick={undoLastAction}
              >
                {lastAction?.type === 'rollToPool'
                  ? 'Undo dice roll'
                  : lastAction?.type === 'useDie'
                    ? 'Undo used die'
                    : lastAction?.type === 'exchange'
                      ? 'Undo exchange'
                      : 'Undo last move'}
              </button>
            </div>
            <GameLog entries={logEntries} />
          </div>
        </div>
      </div>
      <MobileTabBar activeTab={mobileTab} onSelectTab={setMobileTab} />
    </div>
  );
}

export default BattlePage;
