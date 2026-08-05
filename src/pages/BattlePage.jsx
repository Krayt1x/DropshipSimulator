import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  useLocalStorageState,
  useSyncedTransientState,
  makeKey,
} from '../lib/storage.js';
import { backgroundContainerStyle } from '../lib/mapBackground.js';
import {
  formatRollLogMessage,
  parseHitDice,
  DIE_TYPES,
  DICE_COLORS,
  rollDie,
} from '../lib/dice.js';
import {
  hexLine,
  hexDistance,
  isInWeaponArc,
  visibleSides,
  neighborHex,
  nearestSide,
  reachableHexes,
  directionFacing,
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
  withTokenLabel,
  isDropPodUnit,
  itemHasTag,
  tokenHasMovementTag,
  equippedItemsForSide,
  slotForType,
} from '../lib/tokens.js';
import {
  DEFAULT_TERRAIN_TYPES,
  blocksMovement,
  hasLineOfSight,
  mergeDefaultTerrainTypes,
} from '../lib/terrain.js';
import { computeObjectiveVp } from '../lib/victory.js';
import {
  rollAttackDice,
  countHits,
  calculateDamage,
  effectiveSideArmor,
} from '../lib/combat.js';
import {
  DEFAULT_TURN,
  DEFAULT_BANKED_DICE,
  DEFAULT_VICTORY_POINTS,
  resetActiveGame,
  restartBattle,
} from '../lib/gameState.js';
import { parseRosterExport } from '../lib/rosterImport.js';
import { chooseBotAction, pickDeploymentHexes, sleep } from '../lib/bot.js';
import { resolveDropPod } from '../lib/dropPod.js';
import BattleBoard from '../components/BattleBoard.jsx';
import TokenCard from '../components/TokenCard.jsx';
import UnitCardHeader from '../components/UnitCardHeader.jsx';
import AttackModal from '../components/AttackModal.jsx';
import SplashAttackModal from '../components/SplashAttackModal.jsx';
import RosterImport, { DEFAULT_ROSTERS } from '../components/RosterImport.jsx';
import ReserveRosterPanel from '../components/ReserveRosterPanel.jsx';
import DestroyedList from '../components/DestroyedList.jsx';
import TurnTracker from '../components/TurnTracker.jsx';
import TurnOrder from '../components/TurnOrder.jsx';
import MobileTabBar from '../components/MobileTabBar.jsx';
import TurnNotificationToast from '../components/TurnNotificationToast.jsx';
import DiceRoller from '../components/DiceRoller.jsx';
import GameLog from '../components/GameLog.jsx';
import { useCatalogue } from '../lib/catalogue.js';

const DEFAULT_DIMENSIONS = { cols: 24, rows: 24 };
// How many steps "Undo last move" can step back through (#186).
const MAX_UNDO_HISTORY = 10;
// Winner-modal label for the vs-computer difficulty (#169, extended for the
// Expert tier) — a lookup instead of a chained ternary now that there are
// three tiers.
const BOT_DIFFICULTY_LABELS = {
  simple: 'Simple',
  tactical: 'Tactical',
  expert: 'Expert',
};
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
// Raised from 2 so a zoomed-in board has real detail to look at (#187) — the
// board is clipped (not scrolled) past this size, panned via click-and-drag
// instead of scrollbars.
const ZOOM_MAX = 4;
const ZOOM_STEP = 0.25;
// A pointer has to move at least this many pixels before a drag counts as
// panning the board rather than a click on whatever's underneath (#187).
const PAN_DRAG_THRESHOLD = 5;

function BattlePage() {
  // Manufacturers/units/equipment now live in an editable local catalogue
  // (#199) instead of the bundled JSON directly, so a player can add
  // homebrew content in the Manage page and use it here — same seed data,
  // just no longer read-only.
  const { manufacturers, units, equipment } = useCatalogue();
  const [tileTypes, setTileTypes] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tileTypes',
    DEFAULT_TERRAIN_TYPES,
  );
  // Restores any built-in terrain type missing from an older or edited
  // palette (#194) — see mergeDefaultTerrainTypes for why this can't just
  // live in the useLocalStorageState call above.
  useEffect(() => {
    setTileTypes((current) => mergeDefaultTerrainTypes(current));
  }, [setTileTypes]);
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
  // Chosen on PlayPage before entering a fresh game — 'sandbox' (today's
  // existing behavior, control both sides) or 'vs-computer' (a bot plays
  // whichever seat `myPlayer` isn't). Local-only, never synced to a peer —
  // there's no multiplayer meaning for "am I playing a bot".
  const [gameMode] = useLocalStorageState(
    'dropshipsimulator:gameMode',
    'sandbox',
  );
  const [botDifficulty] = useLocalStorageState(
    'dropshipsimulator:botDifficulty',
    'simple',
  );
  // Chosen on PlayPage's roster step (#173) — which list the bot deploys:
  // a random default roster, one picked by name, or a pasted export.
  const [botRoster] = useLocalStorageState('dropshipsimulator:botRoster', {
    type: 'random',
  });
  // Same shape, but for the human's own side (#202) — null for any game that
  // started before this existed, or a sandbox/multiplayer game where the
  // human always builds their own reserve manually.
  const [playerRoster] = useLocalStorageState(
    'dropshipsimulator:playerRoster',
    null,
  );
  const botOwner =
    gameMode === 'vs-computer'
      ? (OWNERS.find((o) => o.id !== myPlayer)?.id ?? null)
      : null;
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [movingTokenId, setMovingTokenId] = useState(null);
  // Drop pod flow (#158): tokenId of a reserve drop pod armed and waiting
  // for a hex click to aim at, before its deviation roll resolves.
  const [dropPodArmed, setDropPodArmed] = useState(null);
  const [rangeWeapon, setRangeWeapon] = useState(null);
  // Attack workflow (#103): attackWeapon marks which weapon is armed for
  // attacking (also drives the arc display via rangeWeapon); attackTarget +
  // attackResult track the in-progress modal once a valid target is picked.
  const [attackWeapon, setAttackWeapon] = useState(null);
  const [attackTarget, setAttackTarget] = useState(null);
  const [attackResult, setAttackResult] = useState(null);
  // Undo history (#186) — up to MAX_UNDO_HISTORY steps, oldest dropped off
  // the front once full. `lastAction` (the one "Undo" acts on) is just
  // whichever entry is most recent.
  const [actionHistory, setActionHistory] = useState([]);
  const lastAction = actionHistory[actionHistory.length - 1] ?? null;
  function pushHistory(action) {
    setActionHistory((current) =>
      [...current, action].slice(-MAX_UNDO_HISTORY),
    );
  }
  const [zoom, setZoom] = useState(1);
  // Click-and-drag panning of the battle board (#187) — panOffset is a CSS
  // translate applied to the board only (not its overlays, like the hover
  // card, which stay screen-anchored). panStateRef tracks an in-progress
  // drag without triggering re-renders on every pointermove.
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef(null);
  // A drag that crossed the pan threshold shouldn't also fire the hex click
  // that lands under the cursor on release.
  const suppressNextHexClickRef = useRef(false);
  const diceRollerRef = useRef(null);
  // Which of the 4 panels is showing on narrow (mobile) viewports (#101) —
  // replaces the old slide-in overlay/tray approach. Irrelevant on desktop,
  // where all 4 panels render at once in the existing 3-column layout.
  // Defaults to Units (which itself opens on its Import sub-tab while
  // reserve is empty) so a fresh mobile game starts on roster import (#165).
  const [mobileTab, setMobileTab] = useState('units');
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
  // The travelling-projectile effect (#183) — bolts (or flames, for a
  // fire-tagged weapon) shown moving from attacker to target when a weapon
  // fires, plus which token(s) are currently shaking from a landed hit.
  const [fireEffect, setFireEffect] = useSyncedTransientState(
    'dropshipsimulator:battle:fireEffect',
    null,
  );
  const fireEffectTimeoutRef = useRef(null);
  const [shakeEffect, setShakeEffect] = useSyncedTransientState(
    'dropshipsimulator:battle:shakeEffect',
    null,
  );
  const shakeEffectTimeoutRef = useRef(null);
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
  // The turn tracker portals into a slot App.jsx renders in the top menu
  // bar (#136) rather than lifting turn/endTurn/playerDice state up there —
  // grabbed after mount since the DOM node doesn't exist during this
  // component's own first render.
  const [turnSlot, setTurnSlot] = useState(null);
  useEffect(() => {
    setTurnSlot(document.getElementById('topnav-turn-slot'));
  }, []);
  // On mobile the nav bar (and its portaled TurnTracker) is hidden behind
  // the hamburger menu, so the full Player 1/Player 2/End Turn panel is
  // rendered inline in the page instead of in the nav slot there (#141).
  // Tracked via matchMedia rather than a CSS-only duplicate so only one
  // TurnTracker (and one "End Turn" button) ever exists in the DOM at once.
  const [isMobile, setIsMobile] = useState(() =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 900px)').matches
      : false,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia('(max-width: 900px)');
    const handler = (e) => setIsMobile(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  // Mirrors the Move/Deploy FAB (#101) — lets the Board tab arm a weapon
  // without switching to the Units tab first, since there was previously no
  // way back to the board to pick a target once you had (#138).
  const [attackPickerOpen, setAttackPickerOpen] = useState(false);

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

  useEffect(() => {
    return () => clearTimeout(fireEffectTimeoutRef.current);
  }, []);
  useEffect(() => {
    return () => clearTimeout(shakeEffectTimeoutRef.current);
  }, []);

  const FIRE_EFFECT_DURATION_MS = 900;
  const SHAKE_DURATION_MS = 350;

  // A few grey tracer bolts (or flame puffs, for a fire-tagged weapon)
  // travel from attacker to target when a weapon fires (#183). Count comes
  // from the hit dice count, length from the die's sides — 2d8 shows fewer,
  // longer bolts than 4d4's more, shorter ones — with a little randomness
  // per bolt (lane offset + timing) baked in here so a volley reads as a
  // ragged burst rather than one rigid line.
  function triggerFireEffect(originPos, targetPos, item) {
    if (!originPos || !targetPos) return;
    const parsed = parseHitDice(item?.hit_dice);
    const count = parsed ? Math.max(1, Math.min(parsed.count, 6)) : 1;
    const sides = parsed ? Number(parsed.dieId.slice(1)) : 6;
    const isFire = itemHasTag(item, 'fire');
    const length = 0.22 + sides * 0.03;
    const bolts = Array.from({ length: count }, (_, i) => ({
      lane: (i - (count - 1) / 2) * 0.18 + (Math.random() - 0.5) * 0.14,
      delay: i * (isFire ? 90 : 70) + Math.random() * 70,
    }));
    clearTimeout(fireEffectTimeoutRef.current);
    setFireEffect({
      id: makeKey('fire'),
      origin: originPos,
      target: targetPos,
      isFire,
      length,
      bolts,
    });
    fireEffectTimeoutRef.current = setTimeout(
      () => setFireEffect(null),
      FIRE_EFFECT_DURATION_MS,
    );
  }

  // The hit model(s) shake briefly once damage actually lands (#183) — a
  // miss or a fully-absorbed hit isn't worth calling out, matching the
  // attack modal's own "only shake on landed damage" rule (#161).
  function triggerShake(tokenIds) {
    const ids = tokenIds.filter(Boolean);
    if (ids.length === 0) return;
    clearTimeout(shakeEffectTimeoutRef.current);
    setShakeEffect({ id: makeKey('shake'), tokenIds: ids });
    shakeEffectTimeoutRef.current = setTimeout(
      () => setShakeEffect(null),
      SHAKE_DURATION_MS,
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
  // Victory points (#179), currently earned only by contesting objective
  // terrain (#178) at the end of a turn.
  const [victoryPoints, setVictoryPoints] = useLocalStorageState(
    'dropshipsimulator:battle:victoryPoints',
    DEFAULT_VICTORY_POINTS,
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

  // The bot's turn driver (runBotTurn, below) runs as one long-lived async
  // function per turn, chained together with real delays for pacing — by
  // the time it reaches its 2nd/3rd action, the plain `tokens`/`actionPool`
  // variables it closed over at the top of this render are stale (React
  // doesn't retroactively update a function's already-captured locals). This
  // ref is kept in sync every render so the bot can always read the *actual*
  // current state mid-turn instead.
  const stateRef = useRef({ tokens, actionPool, deploymentPhase });
  useEffect(() => {
    stateRef.current = { tokens, actionPool, deploymentPhase };
  });

  function appendLog(message) {
    setLogEntries((current) =>
      [{ id: makeKey('log'), message }, ...current].slice(0, 200),
    );
  }

  function unitName(token) {
    const name =
      units.find((u) => Number(u.id) === Number(token.unitId))?.name ?? 'Unit';
    return withTokenLabel(name, token);
  }

  function ownerLabel(ownerId) {
    return OWNERS.find((o) => o.id === ownerId)?.label ?? ownerId;
  }

  // Drop pods (e.g. "Delivery Capsule") play in during the game via an
  // Action die instead of being placed at deployment (#157, #158).
  function isDropPodToken(token) {
    const unit = units.find((u) => Number(u.id) === Number(token?.unitId));
    return isDropPodUnit(unit);
  }

  function endTurn() {
    const endingPlayer = turn.active;
    const next =
      turn.active === 'p1'
        ? { number: turn.number, active: 'p2' }
        : { number: turn.number + 1, active: 'p1' };
    setTurn(next);
    appendLog(`${ownerLabel(endingPlayer)} ended their turn`);
    // 1 VP per own model adjacent to an uncontested objective (#178, #179).
    const gainedVp = computeObjectiveVp({
      tokens,
      tiles,
      terrainTypes: tileTypes,
      owner: endingPlayer,
    });
    if (gainedVp > 0) {
      setVictoryPoints((current) => ({
        ...current,
        [endingPlayer]: (current[endingPlayer] ?? 0) + gainedVp,
      }));
      appendLog(
        `${ownerLabel(endingPlayer)} scored ${gainedVp} victory point${gainedVp === 1 ? '' : 's'} from objectives`,
      );
    }
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
    setActionHistory([]);
  }

  function handleDiceRoll(rolled) {
    appendLog(formatRollLogMessage(rolled));
  }

  function rollToActionPool(dice) {
    setActionPool(dice.map((d) => ({ ...d, used: false })));
    pushHistory({ type: 'rollToPool', dieIds: dice.map((d) => d.id) });
  }

  function useActionPoolDie(dieId) {
    const die = actionPool.find((d) => d.id === dieId);
    setActionPool((current) =>
      current.map((d) => (d.id === dieId ? { ...d, used: true } : d)),
    );
    pushHistory({ type: 'useDie', dieId });
    if (die) appendLog(`Used a ${die.label.toLowerCase()} die: ${die.value}`);
  }

  // Picks an unused die matching `preferredValue` ('Move'/'Attack'), falling
  // back to a flexible 'Action' die — same Move/Action/Attack economy the
  // bot already follows (bot.js's pickDie). Moving or attacking spends one
  // of these and is blocked without one (#162).
  function pickActionDie(preferredValue) {
    const unused = actionPool.filter((d) => !d.used);
    return (
      unused.find((d) => d.value === preferredValue) ??
      unused.find((d) => d.value === 'Action') ??
      null
    );
  }

  const hasMoveDie = Boolean(pickActionDie('Move'));
  const hasAttackDie = Boolean(pickActionDie('Attack'));
  // Counts shown on the mobile Move/Attack FABs (#162) — each die only
  // belongs to one bucket, matching DiceRoller's own Action Pool summary
  // (actionCounts). A flexible Action die can still cover either action
  // (see pickActionDie), but counting it in both totals at once summed to
  // more dice than the pool actually has (#167).
  const moveDieCount = actionPool.filter(
    (d) => !d.used && d.value === 'Move',
  ).length;
  const attackDieCount = actionPool.filter(
    (d) => !d.used && d.value === 'Attack',
  ).length;

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
    pushHistory({ type: 'exchange', spendId, targetId, previousValue });
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
      const { tokenId, position, previousWeaponState, previousFacing, dieId } =
        lastAction;
      const occupant = tokenAt(`${position.col},${position.row}`);
      if (!occupant || occupant.id === tokenId) {
        setTokens((current) =>
          current.map((t) =>
            t.id === tokenId
              ? {
                  ...t,
                  position,
                  weaponState: previousWeaponState,
                  facing: previousFacing ?? t.facing,
                }
              : t,
          ),
        );
      }
      // Refund the Move (or Action) die this move spent, if any (#168) —
      // a free initial placement never had one to refund.
      if (dieId) {
        setActionPool((current) =>
          current.map((d) => (d.id === dieId ? { ...d, used: false } : d)),
        );
      }
      const token = tokens.find((t) => t.id === tokenId);
      appendLog(`Undid ${token ? unitName(token) + "'s" : 'the'} last move`);
    }
    // Only pop the one step just undone (#186) — the rest of the history
    // stays available for further undos.
    setActionHistory((current) => current.slice(0, -1));
  }

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null;
  // A model at 0 chassis HP is a wreck — it can't move or attack until
  // someone clicks "Model Destroyed" (#160), same gate as TokenCard's own
  // desktop buttons.
  const selectedTokenWrecked =
    Boolean(selectedToken) && selectedToken.currentHp <= 0;

  // Game-end detection (#159): a player is out once they have no live,
  // deployed models left on the board — reserve units still in the wings
  // don't save them, matching the issue's literal "no more models on the
  // board". A wrecked (0 HP) model doesn't count even before someone gets
  // around to clicking "Model Destroyed" — waiting on that would let a
  // human opponent stall their own loss indefinitely. Drop pods don't count
  // either — they're delivery vehicles, not something defending the board.
  // Gated on the deployment phase being over so a fresh game (both sides
  // still at 0 before anyone's placed anything) never falsely ends itself.
  const modelsOnBoard = (owner) =>
    tokens.filter(
      (t) =>
        t.owner === owner &&
        t.position &&
        !t.destroyed &&
        (t.currentHp ?? 0) > 0 &&
        !isDropPodToken(t),
    ).length;
  const p1ModelsRemaining = modelsOnBoard('p1');
  const p2ModelsRemaining = modelsOnBoard('p2');
  const winner = deploymentPhase
    ? null
    : p1ModelsRemaining === 0 && p2ModelsRemaining > 0
      ? 'p2'
      : p2ModelsRemaining === 0 && p1ModelsRemaining > 0
        ? 'p1'
        : null;
  const loser = winner === 'p1' ? 'p2' : winner === 'p2' ? 'p1' : null;

  function playAgain() {
    restartBattle();
  }

  function returnHome() {
    resetActiveGame();
    window.location.hash = '#home';
  }
  const movingToken = movingTokenId
    ? (tokens.find((t) => t.id === movingTokenId) ?? null)
    : null;
  // Powers the Board-tab hint banner (#142) — only shown for a fresh deploy
  // (no position yet), not for repositioning an already-deployed token.
  const deployingToken =
    movingToken && !movingToken.position ? movingToken : null;
  const selectedUnit = selectedToken
    ? units.find((u) => Number(u.id) === Number(selectedToken.unitId))
    : null;
  // Powers the Attack FAB's weapon picker (#138) — same "is this equipped
  // item actually a fireable weapon" test TokenCard uses per weapon row.
  const selectedTokenWeapons = selectedToken
    ? selectedToken.equippedIds
        .map((id, instanceIndex) => {
          const item = equipment.find((e) => Number(e.id) === Number(id));
          return item?.type === 'Weapon' && item.hit_dice
            ? { ...item, instanceIndex }
            : null;
        })
        .filter(Boolean)
    : [];
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

  // Per-side armor/equipment breakdown for the attack-side picker (#204),
  // so the attacker can see what they're actually about to shoot at before
  // committing to a side.
  const attackSideInfo = attackTargetToken
    ? Object.fromEntries(
        ['front', 'left', 'right', 'rear'].map((s) => [
          s,
          {
            armor: effectiveSideArmor(
              attackTargetToken,
              attackTargetUnit,
              s,
              equipment,
            ),
            items: equippedItemsForSide(attackTargetToken, s, equipment),
          },
        ]),
      )
    : null;

  // Artillery-style weapons roll once against every model under a 7-tile
  // splash template (the targeted tile plus its 6 neighbors) instead of a
  // single chosen target (#123) — detected off the "Splash" tag (#267), or
  // the older free-text `effects` convention kept for any equipment that
  // hasn't been re-tagged yet.
  const isSplashWeapon = Boolean(
    attackWeapon &&
      (itemHasTag(attackWeapon.item, 'splash') ||
        /target tile and all adjacent tiles/i.test(
          attackWeapon.item.effects ?? '',
        )),
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
    // Spends an Attack (or Action) die and is blocked without one (#162).
    const die = pickActionDie('Attack');
    if (!die) return;
    const attacker = tokens.find((t) => t.id === attackWeapon.tokenId);
    const rolled = rollAttackDice(attackWeapon.item.hit_dice);
    if (!attacker || !rolled) return;
    useActionPoolDie(die.id);
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
    const sideArmor = effectiveSideArmor(
      attackTargetToken,
      attackTargetUnit,
      attackTarget.side,
      equipment,
    );
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
    triggerFireEffect(
      attacker.position,
      attackTargetToken.position,
      attackWeapon.item,
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
    // rollover to a second item the way HP damage has. Detected off the
    // "Fire" tag (#266), or the older free-text `effects` convention kept
    // for any equipment that hasn't been re-tagged yet.
    const damageAsHeat =
      itemHasTag(weaponItem, 'fire') ||
      /damage is applied as heat/i.test(weaponItem?.effects ?? '');
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
    if (attackResult.damage > 0) triggerShake([attackTargetToken.id]);
    cancelAttack();
  }

  // One roll of the weapon's dice is checked against every model under the
  // splash template, each against its own target number and armor (#123).
  function rollSplashAttack() {
    if (!attackWeapon || !attackOrigin) return;
    if (splashOriginToken && !attackTarget?.side) return;
    // Spends an Attack (or Action) die and is blocked without one (#162).
    const die = pickActionDie('Attack');
    if (!die) return;
    const attacker = tokens.find((t) => t.id === attackWeapon.tokenId);
    const rolled = rollAttackDice(attackWeapon.item.hit_dice);
    if (!attacker || !rolled) return;
    useActionPoolDie(die.id);
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
      const sideArmor = effectiveSideArmor(token, unit, side, equipment);
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
    triggerFireEffect(attacker.position, attackOrigin, attackWeapon.item);
  }

  function applySplashDamage() {
    if (!attackResult?.perTarget) return;
    attackResult.perTarget.forEach(({ tokenId, side, damage }) => {
      const token = tokens.find((t) => t.id === tokenId);
      if (token) applyDamageToToken(token, side, damage, attackWeapon?.item);
    });
    triggerShake(
      attackResult.perTarget
        .filter(({ damage }) => damage > 0)
        .map(({ tokenId }) => tokenId),
    );
    cancelAttack();
  }

  function movementForToken(token) {
    const movementItem = token.equippedIds
      .map((id) => equipment.find((e) => Number(e.id) === Number(id)))
      .find((item) => item?.type === 'Movement');
    return Number(movementItem?.movement) || 0;
  }

  // Shared by the move-range highlight and the actual move-legality checks
  // in handleHexClick/handleDropToken — a hex only counts as reachable if
  // it isn't off the board, isn't occupied by another model, and (unless
  // the mover is flying) isn't blocked terrain.
  function isBlockedHexFor(token) {
    return (hex) => {
      if (
        hex.col < 0 ||
        hex.row < 0 ||
        hex.col >= dimensions.cols ||
        hex.row >= dimensions.rows
      ) {
        return true;
      }
      const occupant = tokenAt(`${hex.col},${hex.row}`);
      if (occupant && occupant.id !== token.id) return true;
      if (
        !tokenHasMovementTag(token, equipment, 'flying') &&
        blocksMovement(tiles, tileTypes, hex)
      ) {
        return true;
      }
      return false;
    };
  }

  // Powers the move-range highlight (#196): which hexes a token could reach
  // within its own movement stat, routing around terrain/models rather than
  // just showing every hex within a plain hex-distance radius.
  function reachableHexesForToken(token) {
    const movement =
      token?.position && !token.destroyed ? movementForToken(token) : 0;
    if (movement <= 0) return null;
    return {
      origin: token.position,
      hexes: reachableHexes(token.position, movement, isBlockedHexFor(token)),
    };
  }

  const moveRange = reachableHexesForToken(selectedToken);

  // Actual move legality for handleHexClick/handleDropToken (#214): a move
  // is only blocked by terrain, board edges, and other models — not by
  // whatever the straight line between the two points happens to cross —
  // so a model can route around an obstacle it has the movement to go
  // around, the same way the (distance-capped) highlight above already
  // does. Distance itself was never capped for an actual move (only a
  // Move/Action die is spent per move, regardless of how far it travels),
  // so this uses an effectively unlimited step count rather than the
  // mover's own movement stat.
  function isHexReachableFor(token, col, row) {
    if (!token?.position) return false;
    const maxSteps = dimensions.cols + dimensions.rows;
    return reachableHexes(token.position, maxSteps, isBlockedHexFor(token)).has(
      `${col},${row}`,
    );
  }

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

  // Panning (#187): a plain click still needs to reach handleHexClick
  // untouched, so only a drag past PAN_DRAG_THRESHOLD engages it — token
  // markers own their own pointer-drag gesture (repositioning), so a
  // pointerdown starting on one never starts a pan.
  function handleBoardPointerDown(e) {
    if (e.target.closest?.('.token-marker')) return;
    panStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: panOffset,
      dragging: false,
    };
  }

  function handleBoardPointerMove(e) {
    const state = panStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    const dx = e.clientX - state.startX;
    const dy = e.clientY - state.startY;
    if (!state.dragging) {
      if (Math.hypot(dx, dy) < PAN_DRAG_THRESHOLD) return;
      state.dragging = true;
      setIsPanning(true);
    }
    setPanOffset({ x: state.startOffset.x + dx, y: state.startOffset.y + dy });
  }

  function endBoardPan(e) {
    const state = panStateRef.current;
    if (!state || state.pointerId !== e.pointerId) return;
    if (state.dragging) suppressNextHexClickRef.current = true;
    panStateRef.current = null;
    setIsPanning(false);
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

  function moveTokenTo(token, col, row, dieId) {
    if (token.position) {
      // Spins to face the direction it's actually moving in (#208) rather
      // than keeping whatever facing it had before — falls back to the
      // token's current facing on the (never-expected) same-hex case
      // directionFacing itself guards against.
      const facing = directionFacing(token.position, { col, row }) ?? token.facing;
      pushHistory({
        type: 'move',
        tokenId: token.id,
        position: token.position,
        previousWeaponState: token.weaponState,
        previousFacing: token.facing,
        // Recorded so "Undo last move" can also refund the Move die a human
        // move spent (#162), rather than just restoring position (#168).
        dieId,
      });
      appendLog(
        `${ownerLabel(token.owner)} moved ${unitName(token)} to (${col}, ${row})`,
      );
      const weaponState = bumpMovementHeat(token);
      setTokens((current) =>
        current.map((t) =>
          t.id === token.id
            ? { ...t, position: { col, row }, weaponState, facing }
            : t,
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
  function animateMove(token, col, row, dieId) {
    moveTimeoutsRef.current.forEach(clearTimeout);
    moveTimeoutsRef.current = [];
    if (!token.position) {
      moveTokenTo(token, col, row, dieId);
      return;
    }
    const path = hexLine(token.position, { col, row });
    if (path.length <= 2) {
      setAnimatingToken(null);
      moveTokenTo(token, col, row, dieId);
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
          moveTokenTo(token, col, row, dieId);
        },
        MOVE_STEP_MS * (path.length - 1),
      ),
    );
  }

  function handleHexClick(key) {
    if (suppressNextHexClickRef.current) {
      suppressNextHexClickRef.current = false;
      return;
    }
    const [col, row] = key.split(',').map(Number);

    if (dropPodArmed) {
      resolveDropPodDrop(dropPodArmed, { col, row });
      return;
    }

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
          })() &&
          // Blocking terrain stops a shot unless the weapon fires indirectly
          // (#178, #268).
          (itemHasTag(attackWeapon.item, 'indirect_fire') ||
            hasLineOfSight(attacker.position, { col, row }, tiles, tileTypes));
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
        })() &&
        (itemHasTag(attackWeapon.item, 'indirect_fire') ||
          hasLineOfSight(attacker.position, target.position, tiles, tileTypes));
      if (valid) {
        setAttackTarget({ tokenId: target.id, side: null });
      } else {
        cancelAttack();
      }
      return;
    }

    if (movingTokenId) {
      if (movingToken && canControl(movingToken)) {
        // Placing a reserve token for the first time is free; an actual
        // move spends a Move (or Action) die and is blocked without one
        // (#162).
        if (movingToken.position) {
          // A hex is only a legal destination if it's actually reachable
          // within the mover's movement — routing around terrain and other
          // models the same way the move-range highlight does (#196) —
          // rather than only checking the straight line between the two
          // points, which blocked a move that had plenty of movement to
          // spare to go around an obstacle (#214).
          const blocked = !isHexReachableFor(movingToken, col, row);
          const die = !blocked && pickActionDie('Move');
          if (die) {
            // Order matters: both calls set lastAction, and a short move
            // finishes synchronously inside animateMove while a longer one
            // completes later on a timeout — calling useActionPoolDie first
            // guarantees moveTokenTo's own 'move' record (carrying dieId)
            // is always the one left standing either way (#168).
            useActionPoolDie(die.id);
            animateMove(movingToken, col, row, die.id);
          }
        } else if (!tokenAt(key)) {
          animateMove(movingToken, col, row);
          // Jumps back to the Units tab so the next reserve unit can be
          // picked without a manual tab switch (#201) — but only if one is
          // actually left to deploy, otherwise there's nothing to jump back
          // for and the Board tab is more useful.
          if (deploymentPhase) {
            const otherReserveRemains = tokens.some(
              (t) =>
                t.id !== movingToken.id &&
                !t.position &&
                !t.destroyed &&
                canControl(t) &&
                !isDropPodToken(t),
            );
            if (otherReserveRemains) setMobileTab('units');
          }
        }
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
    // Drop pods never place directly — they always go through the aim +
    // deviation roll flow instead (#157, #158).
    if (isDropPodToken(token)) return;
    // Placing a reserve token for the first time is free; repositioning an
    // already-deployed one spends a Move (or Action) die and is blocked
    // without one (#162).
    if (token.position) {
      // Same reachability check as handleHexClick (#214) — routes around
      // terrain and other models instead of only checking the straight
      // line between the two points.
      if (!isHexReachableFor(token, col, row)) {
        return;
      }
      const die = pickActionDie('Move');
      if (!die) return;
      // See handleHexClick's identical comment on why useActionPoolDie runs
      // first (#168).
      useActionPoolDie(die.id);
      animateMove(token, col, row, die.id);
    } else {
      animateMove(token, col, row);
    }
    setSelectedTokenId(tokenId);
  }

  function hasUnusedActionDie() {
    return actionPool.some((d) => !d.used && d.value === 'Action');
  }

  // Arms a reserve drop pod to be aimed at the next hex click (#158) — only
  // once the deployment phase is over (#157) and there's a spare Action die
  // to spend on it, matching the human "you need an unused die" gate every
  // other action already follows.
  function armDropPod(tokenId) {
    if (deploymentPhase || !hasUnusedActionDie()) return;
    setMovingTokenId(null);
    setAttackWeapon(null);
    setAttackTarget(null);
    setDropPodArmed(tokenId);
    setMobileTab('board');
  }

  // Rolls the drop pod's deviation (1d4 distance, 1d6 direction — #158),
  // applies 10 rear damage to anything it bounces off of on the way down,
  // and lands it on the final empty hex.
  function resolveDropPodDrop(tokenId, aim) {
    const token = tokens.find((t) => t.id === tokenId);
    const actionDie = actionPool.find((d) => !d.used && d.value === 'Action');
    if (!token || !actionDie) {
      setDropPodArmed(null);
      return;
    }

    const d4Roll = rollDie(DIE_TYPES.find((d) => d.id === 'd4'));
    const d6Roll = rollDie(DIE_TYPES.find((d) => d.id === 'd6'));
    const { hex, hits } = resolveDropPod({
      aim,
      d4Roll,
      d6Roll,
      dimensions,
      findTokenAt: (h) =>
        tokens.find(
          (t) =>
            t.position &&
            !t.destroyed &&
            t.position.col === h.col &&
            t.position.row === h.row,
        ),
    });

    hits.forEach(({ token: hitToken }) => {
      const unit = units.find((u) => Number(u.id) === Number(hitToken.unitId));
      const sideArmor = effectiveSideArmor(hitToken, unit, 'rear', equipment);
      const damage = calculateDamage(10, sideArmor, 1);
      applyDamageToToken(hitToken, 'rear', damage, null);
    });

    appendLog(
      `${ownerLabel(token.owner)}'s ${unitName(token)} drop pod aimed at (${aim.col}, ${aim.row}), rolled ${d4Roll}/${d6Roll} and landed at (${hex.col}, ${hex.row})` +
        (hits.length > 0
          ? `, hitting ${hits.length} model${hits.length === 1 ? '' : 's'} for 10 damage to the rear on the way down`
          : ''),
    );

    placeTokenAt(token.id, hex.col, hex.row);
    triggerDeployEffect(token.id, hex.col, hex.row);
    useActionPoolDie(actionDie.id);
    setDropPodArmed(null);
    setSelectedTokenId(token.id);
  }

  // Reserve list's own Deploy button (#142) — on mobile, reserve tokens are
  // selected on the Units tab but placed by clicking a hex on the Board tab,
  // which previously required manually switching tabs in between with no
  // indication that was necessary. This selects, arms the move, and jumps to
  // the Board tab in one tap.
  function deployFromReserve(tokenId) {
    setSelectedTokenId(tokenId);
    setMovingTokenId(tokenId);
    setMobileTab('board');
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
    const imported = entries.map(
      ({ unit, equippedIds, equippedSides, label }) =>
        createToken({
          unit,
          equippedIds,
          equippedSides,
          owner,
          position: null,
          label,
        }),
    );
    setTokens((current) => [...current, ...imported]);
    appendLog(
      `${ownerLabel(owner)} imported ${imported.length} unit${imported.length === 1 ? '' : 's'} to reserve`,
    );
  }

  // --- Computer opponent (single-player vs-computer mode) -----------------
  //
  // Deliberately does NOT reuse startAttack/rollAttack/applyAttackDamage or
  // handleHexClick's attack-target branch: those all read attackWeapon/
  // attackTarget/attackResult from this render's closure, and setting those
  // mid-bot-turn wouldn't be visible to the *same* closure's rollAttack a
  // moment later (React doesn't retroactively patch an already-created
  // function's captured variables) — nor would it be desirable even if it
  // worked, since that state also drives the human-facing AttackModal, and a
  // bot's own attacks shouldn't pop a confirmation modal on the human's
  // screen. Instead every bot action resolves immediately and directly.
  // animateMove and applyDamageToToken ARE safe to call as-is — both take
  // the token to act on as a plain argument rather than reading it from
  // component state, so they work correctly regardless of which render's
  // closure calls them.
  function bumpWeaponHeat(tokenId, instanceIndex, generate) {
    setTokens((current) =>
      current.map((t) =>
        t.id === tokenId
          ? {
              ...t,
              weaponState: {
                ...t.weaponState,
                [instanceIndex]: {
                  ...t.weaponState[instanceIndex],
                  heat: (t.weaponState[instanceIndex]?.heat ?? 0) + generate,
                },
              },
            }
          : t,
      ),
    );
  }

  function performBotAttack(action) {
    const freshTokens = stateRef.current.tokens;
    const attacker = freshTokens.find((t) => t.id === action.attackerId);
    if (!attacker) return;
    const { generate } = parseHeatRating(action.item.heat_rating);
    bumpWeaponHeat(attacker.id, action.instanceIndex, generate);

    const rolled = rollAttackDice(action.item.hit_dice);
    if (!rolled) return;

    if (action.isSplash) {
      const template = [
        action.origin,
        ...[0, 1, 2, 3, 4, 5].map((dir) =>
          neighborHex(action.origin.col, action.origin.row, dir),
        ),
      ];
      const hitTokens = freshTokens.filter(
        (t) =>
          t.position &&
          !t.destroyed &&
          template.some(
            (h) => h.col === t.position.col && h.row === t.position.row,
          ),
      );
      hitTokens.forEach((token) => {
        const unit = units.find((u) => Number(u.id) === Number(token.unitId));
        const side = nearestSide(token.position, token.facing, action.origin);
        const sideArmor = effectiveSideArmor(token, unit, side, equipment);
        const hits = countHits(rolled.rolls, sizeNumber(unit?.size) ?? 0);
        const damage = calculateDamage(rolled.sides, sideArmor, hits);
        applyDamageToToken(token, side, damage, action.item);
      });
      appendLog(
        `${unitName(attacker)}'s ${action.item.name} hit the blast template at (${action.origin.col}, ${action.origin.row}), rolling ${rolled.rolls.join(', ')} against ${hitTokens.length} target${hitTokens.length === 1 ? '' : 's'}`,
      );
      return;
    }

    const target = freshTokens.find((t) => t.id === action.targetId);
    if (!target) return;
    const targetUnit = units.find(
      (u) => Number(u.id) === Number(target.unitId),
    );
    const targetNumber = sizeNumber(targetUnit?.size) ?? 0;
    const sideArmor = effectiveSideArmor(
      target,
      targetUnit,
      action.side,
      equipment,
    );
    const hits = countHits(rolled.rolls, targetNumber);
    const damage = calculateDamage(rolled.sides, sideArmor, hits);
    appendLog(
      `${unitName(attacker)}'s ${action.item.name} rolled ${rolled.rolls.join(', ')} vs ${unitName(target)}'s ${action.side} (TN ${targetNumber}) → ${hits} hit${hits === 1 ? '' : 's'}`,
    );
    applyDamageToToken(target, action.side, damage, action.item);
  }

  // Mirrors destroySelected(), but off `action.tokenId` (a stateRef-fresh
  // argument) instead of the `selectedToken` render-closure state, since
  // runBotTurn's own closure never sees a human selection (#154).
  function performBotDestroy(action) {
    const freshTokens = stateRef.current.tokens;
    const token = freshTokens.find((t) => t.id === action.tokenId);
    if (!token) return;
    appendLog(
      `${ownerLabel(token.owner)}'s ${unitName(token)} was destroyed` +
        (action.dieColor ? ` (kept a ${action.dieColor} die)` : ''),
    );
    if (action.dieColor) {
      setBankedDice((current) => ({
        ...current,
        [token.owner]: {
          ...current[token.owner],
          [action.dieColor]: (current[token.owner]?.[action.dieColor] ?? 0) + 1,
        },
      }));
    }
    setTokens((current) =>
      current.map((t) =>
        t.id === action.tokenId
          ? {
              ...t,
              destroyed: true,
              position: null,
              bankedDieColor: action.dieColor ?? null,
            }
          : t,
      ),
    );
  }

  // Mirrors resolveDropPodDrop(), but off `action.tokenId`/`action.aim`
  // (stateRef-fresh arguments) instead of the render closure, for the same
  // stale-closure reason performBotAttack/performBotDestroy do (#157, #158).
  function performBotDropPod(action) {
    const freshTokens = stateRef.current.tokens;
    const token = freshTokens.find((t) => t.id === action.tokenId);
    if (!token) return;

    const d4Roll = rollDie(DIE_TYPES.find((d) => d.id === 'd4'));
    const d6Roll = rollDie(DIE_TYPES.find((d) => d.id === 'd6'));
    const { hex, hits } = resolveDropPod({
      aim: action.aim,
      d4Roll,
      d6Roll,
      dimensions,
      findTokenAt: (h) =>
        stateRef.current.tokens.find(
          (t) =>
            t.position &&
            !t.destroyed &&
            t.position.col === h.col &&
            t.position.row === h.row,
        ),
    });

    hits.forEach(({ token: hitToken }) => {
      const unit = units.find((u) => Number(u.id) === Number(hitToken.unitId));
      const sideArmor = effectiveSideArmor(hitToken, unit, 'rear', equipment);
      const damage = calculateDamage(10, sideArmor, 1);
      applyDamageToToken(hitToken, 'rear', damage, null);
    });

    appendLog(
      `${ownerLabel(token.owner)}'s ${unitName(token)} drop pod aimed at (${action.aim.col}, ${action.aim.row}), rolled ${d4Roll}/${d6Roll} and landed at (${hex.col}, ${hex.row})` +
        (hits.length > 0
          ? `, hitting ${hits.length} model${hits.length === 1 ? '' : 's'} for 10 damage to the rear on the way down`
          : ''),
    );

    placeTokenAt(token.id, hex.col, hex.row);
    triggerDeployEffect(token.id, hex.col, hex.row);
  }

  const botTurnKeyRef = useRef(null);
  async function runBotTurn() {
    const ownerDice = playerDice[botOwner] ?? { blue: 0, red: 0, green: 0 };
    const rolled = [];
    DICE_COLORS.forEach((color) => {
      const dieType = DIE_TYPES.find((d) => d.id === color);
      for (let i = 0; i < (ownerDice[color] ?? 0); i++) {
        rolled.push({
          id: makeKey('die'),
          label: dieType.label,
          value: rollDie(dieType),
        });
      }
    });
    if (rolled.length > 0) {
      rollToActionPool(rolled);
      handleDiceRoll(rolled);
      await sleep(500);
    }

    // Capped as a safety net — a real turn only ever has a handful of dice —
    // so a logic bug can't wedge this into looping forever.
    for (let i = 0; i < 50; i++) {
      const { tokens: freshTokens, actionPool: freshPool } = stateRef.current;
      const action = chooseBotAction({
        tokens: freshTokens,
        units,
        equipment,
        botOwner,
        actionPool: freshPool,
        difficulty: botDifficulty,
        dimensions,
        tiles,
        terrainTypes: tileTypes,
      });
      if (!action) break;

      if (action.type === 'destroy') {
        performBotDestroy(action);
        await sleep(400);
      } else if (action.type === 'attack') {
        performBotAttack(action);
        useActionPoolDie(action.dieId);
        await sleep(700);
      } else if (action.type === 'dropPod') {
        performBotDropPod(action);
        useActionPoolDie(action.dieId);
        await sleep(700);
      } else if (action.type === 'move') {
        const token = freshTokens.find((t) => t.id === action.tokenId);
        if (!token) break;
        const steps = hexDistance(token.position, action.destination);
        animateMove(token, action.destination.col, action.destination.row);
        useActionPoolDie(action.dieId);
        await sleep(steps * MOVE_STEP_MS + 400);
      } else if (action.type === 'exchange') {
        exchangeActionDie(action.spendId, action.targetId, action.newValue);
        await sleep(400);
      }
    }

    endTurn();
  }

  useEffect(() => {
    if (gameMode !== 'vs-computer' || !botOwner || deploymentPhase) return;
    if (turn.active !== botOwner) return;
    const key = `${turn.active}:${turn.number}`;
    if (botTurnKeyRef.current === key) return;
    botTurnKeyRef.current = key;
    runBotTurn();
  }, [turn, gameMode, deploymentPhase, botOwner]);

  // Auto-rolls the active player's Action Pool the moment their turn starts
  // (#164), instead of waiting on a manual "Roll Action Pool" click. Lives
  // here (not inside DiceRoller) since it needs to call appendLog/rollToActionPool
  // directly — a child component's effect calling those same callbacks
  // during the same render cascade as endTurn()'s own state updates was
  // silently losing the log entry. Guarded the same way DiceRoller's old
  // "canRoll" prop was (skip if this browser isn't the active player) so
  // exactly one side ever rolls in multiplayer, and the bot's own turn is
  // left to runBotTurn(), which already rolls its own dice.
  const humanRollKeyRef = useRef(null);
  useEffect(() => {
    if (deploymentPhase) return;
    if (myPlayer && myPlayer !== turn.active) return;
    const key = `${turn.active}:${turn.number}`;
    if (humanRollKeyRef.current === key) return;
    humanRollKeyRef.current = key;
    const ownerDice = playerDice[turn.active] ?? { blue: 0, red: 0, green: 0 };
    const rolled = [];
    DICE_COLORS.forEach((color) => {
      const dieType = DIE_TYPES.find((d) => d.id === color);
      for (let i = 0; i < (ownerDice[color] ?? 0); i++) {
        rolled.push({
          id: makeKey('die'),
          label: dieType.label,
          value: rollDie(dieType),
        });
      }
    });
    if (rolled.length > 0) {
      rollToActionPool(rolled);
      handleDiceRoll(rolled);
    }
  }, [turn, deploymentPhase, myPlayer]);

  const botDeployStartedRef = useRef(false);
  async function runBotDeployment() {
    if (botDeployStartedRef.current || !deploymentZonesValid) return;
    botDeployStartedRef.current = true;

    const hasBotTokens = stateRef.current.tokens.some(
      (t) => t.owner === botOwner,
    );
    if (!hasBotTokens) {
      // Random and "specific by name" both resolve to one of the built-in
      // default rosters; "import" uses the human's own pasted export
      // instead (#173). Falls back to the first default roster if a named
      // one can't be found (e.g. the list of defaults changed). Random is
      // scoped to whichever manufacturer was chosen on PlayPage (#198),
      // falling back to the full list if that manufacturer has none.
      const randomPool = botRoster?.manufacturer
        ? DEFAULT_ROSTERS.filter(
            (r) => r.manufacturer === botRoster.manufacturer,
          )
        : [];
      const pool = randomPool.length > 0 ? randomPool : DEFAULT_ROSTERS;
      const rosterText =
        botRoster?.type === 'import'
          ? botRoster.text
          : botRoster?.type === 'specific'
            ? (DEFAULT_ROSTERS.find((r) => r.name === botRoster.name)?.text ??
              DEFAULT_ROSTERS[0].text)
            : pool[Math.floor(Math.random() * pool.length)].text;
      const parsed = parseRosterExport(rosterText, {
        units,
        manufacturers,
        equipment,
      });
      importRoster({ entries: parsed.entries, owner: botOwner });
      await sleep(400);
    }

    // Drop pods deploy mid-game via an Action die, not at setup (#157).
    const reserveBotTokens = stateRef.current.tokens.filter(
      (t) =>
        t.owner === botOwner &&
        !t.position &&
        !t.destroyed &&
        !isDropPodToken(t),
    );
    if (reserveBotTokens.length === 0) return;

    const zoneRows =
      botOwner === 'p1'
        ? Array.from({ length: topBoundaryRow + 1 }, (_, i) => i)
        : Array.from(
            { length: dimensions.rows - 1 - bottomBoundaryRow },
            (_, i) => bottomBoundaryRow + 1 + i,
          );
    const occupied = new Set(
      stateRef.current.tokens
        .filter((t) => t.position)
        .map((t) => `${t.position.col},${t.position.row}`),
    );
    const hexes = pickDeploymentHexes({
      count: reserveBotTokens.length,
      rows: zoneRows,
      cols: dimensions.cols,
      occupied,
    });

    for (let i = 0; i < reserveBotTokens.length; i++) {
      const hex = hexes[i];
      if (!hex) break;
      const freshToken = stateRef.current.tokens.find(
        (t) => t.id === reserveBotTokens[i].id,
      );
      if (!freshToken || freshToken.position) continue;
      animateMove(freshToken, hex.col, hex.row);
      await sleep(300);
    }
  }

  useEffect(() => {
    if (gameMode !== 'vs-computer' || !botOwner || !deploymentPhase) return;
    runBotDeployment();
  }, [gameMode, botOwner, deploymentPhase]);
  // --------------------------------------------------------------------

  // Pre-fills the human's reserve from the list they picked on PlayPage
  // (#202), the same way the bot's own list pre-fills its reserve above —
  // only into reserve, never auto-deployed, since placing units is still a
  // manual (human) step.
  const playerRosterAppliedRef = useRef(false);
  useEffect(() => {
    if (
      gameMode !== 'vs-computer' ||
      !deploymentPhase ||
      !myPlayer ||
      !playerRoster ||
      playerRosterAppliedRef.current
    ) {
      return;
    }
    if (tokens.some((t) => t.owner === myPlayer)) {
      playerRosterAppliedRef.current = true;
      return;
    }
    playerRosterAppliedRef.current = true;
    const randomPool = playerRoster.manufacturer
      ? DEFAULT_ROSTERS.filter(
          (r) => r.manufacturer === playerRoster.manufacturer,
        )
      : [];
    const pool = randomPool.length > 0 ? randomPool : DEFAULT_ROSTERS;
    const rosterText =
      playerRoster.type === 'import'
        ? playerRoster.text
        : playerRoster.type === 'specific'
          ? (DEFAULT_ROSTERS.find((r) => r.name === playerRoster.name)?.text ??
            DEFAULT_ROSTERS[0].text)
          : pool[Math.floor(Math.random() * pool.length)].text;
    const parsed = parseRosterExport(rosterText, {
      units,
      manufacturers,
      equipment,
    });
    importRoster({ entries: parsed.entries, owner: myPlayer });
  }, [gameMode, deploymentPhase, myPlayer, playerRoster, tokens]);
  // --------------------------------------------------------------------

  // Built once and reused in two spots (#146): shown inline above the
  // Reserve/Roster card on desktop, or as an "Import" tab inside it on
  // mobile, instead of duplicating the JSX for each.
  const rosterImportPanel = deploymentPhase ? (
    <RosterImport
      manufacturers={manufacturers}
      units={units}
      equipment={equipment}
      myPlayer={myPlayer}
      onImport={importRoster}
    />
  ) : null;

  return (
    <div className="container-wide battle-page">
      <TurnNotificationToast notice={turnNotice} myPlayer={myPlayer} />
      {winner && (
        <div className="winner-overlay">
          <div className="card winner-modal">
            <div className="winner-trophy">🏆</div>
            <h1 className="winner-heading">{ownerLabel(winner)} Wins!</h1>
            <p className="unit-meta winner-reason">
              {ownerLabel(loser)} has no models left on the board.
            </p>
            {gameMode === 'vs-computer' && (
              <p className="unit-meta winner-difficulty">
                vs Computer ·{' '}
                {BOT_DIFFICULTY_LABELS[botDifficulty] ?? 'Simple'}
              </p>
            )}
            <div className="card winner-summary">
              <p className="unit-name">Match summary</p>
              <div className="token-stat-row">
                <span>Turns played</span>
                <span className="winner-summary-value">{turn.number}</span>
              </div>
              <div className="token-stat-row">
                <span>{ownerLabel('p1')} models remaining</span>
                <span className="winner-summary-value">
                  {p1ModelsRemaining}
                </span>
              </div>
              <div className="token-stat-row">
                <span>{ownerLabel('p2')} models remaining</span>
                <span className="winner-summary-value">
                  {p2ModelsRemaining}
                </span>
              </div>
            </div>
            <div className="winner-actions">
              <button type="button" onClick={playAgain}>
                Play Again
              </button>
              <button type="button" className="ghost" onClick={returnHome}>
                Return Home
              </button>
            </div>
          </div>
        </div>
      )}
      {!isMobile &&
        turnSlot &&
        createPortal(
          <TurnTracker
            turn={turn}
            onEndTurn={endTurn}
            playerDice={playerDice}
            victoryPoints={victoryPoints}
          />,
          turnSlot,
        )}
      {isMobile && (
        <div className="mobile-turn-tracker">
          <TurnTracker
            turn={turn}
            onEndTurn={endTurn}
            playerDice={playerDice}
            victoryPoints={victoryPoints}
          />
        </div>
      )}

      {(!isMobile || !deploymentZonesValid) && (
        <div className="deployment-controls">
          {/* On mobile this toggle moves into the bottom action toolbar next
              to Move/Weapons instead (#143) — kept here for desktop, where
              there's no such toolbar. */}
          {!isMobile && (
            <button
              type="button"
              className={deploymentPhase ? '' : 'ghost'}
              disabled={!deploymentZonesValid}
              onClick={() => setDeploymentPhase((current) => !current)}
            >
              {deploymentPhase ? 'End deployment phase' : 'Deployment Phase'}
            </button>
          )}
          {!deploymentZonesValid && (
            <span className="unit-meta">
              Board needs at least 7 rows for deployment zones.
            </span>
          )}
        </div>
      )}

      <div className="battle-layout">
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
              turn={turn}
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
        <div
          className={`battle-board-column mobile-tab-panel ${mobileTab === 'board' ? 'mobile-tab-panel-active' : ''}`}
        >
          {deployingToken && (
            <div className="deploy-hint-banner">
              Tap a tile to deploy {unitName(deployingToken)}
              <button type="button" onClick={() => setMovingTokenId(null)}>
                Cancel
              </button>
            </div>
          )}
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
            onPointerDown={handleBoardPointerDown}
            onPointerMove={handleBoardPointerMove}
            onPointerUp={endBoardPan}
            onPointerLeave={endBoardPan}
          >
            <div
              className={`battle-board-pan ${isPanning ? 'panning' : ''}`}
              style={{
                transform: `translate(${panOffset.x}px, ${panOffset.y}px)`,
              }}
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
                fireEffect={fireEffect}
                shakingTokenIds={shakeEffect?.tokenIds ?? null}
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
            </div>
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
                    <p className="unit-name">
                      {withTokenLabel(hoverUnit.name, hoverToken)}
                    </p>
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
                sideInfo={attackSideInfo}
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
            {/* Groups the deployment-phase toggle with the token action
                buttons in one bar (#143) — it used to live in its own row at
                the top of the page, disconnected from the board actions it's
                closely related to. */}
            <div className="mobile-action-toolbar">
              {/* Only the "end" direction lives here — starting deployment
                  happens from the Units tab instead (#145). */}
              {isMobile && deploymentPhase && (
                <button
                  type="button"
                  className="mobile-deploy-phase-btn"
                  onClick={() => setDeploymentPhase(false)}
                >
                  End Deploy
                </button>
              )}
              {selectedToken &&
                !selectedToken.destroyed &&
                !selectedTokenWrecked &&
                canControl(selectedToken) && (
                  <button
                    type="button"
                    className="mobile-move-fab"
                    disabled={
                      movingTokenId !== selectedToken.id &&
                      selectedToken.position &&
                      !hasMoveDie
                    }
                    onClick={() =>
                      setMovingTokenId((current) =>
                        current === selectedToken.id ? null : selectedToken.id,
                      )
                    }
                  >
                    {movingTokenId === selectedToken.id
                      ? 'Cancel'
                      : selectedToken.position
                        ? `Move (${moveDieCount})`
                        : 'Deploy'}
                  </button>
                )}
              {selectedToken &&
                selectedToken.position &&
                !selectedToken.destroyed &&
                !selectedTokenWrecked &&
                canControl(selectedToken) &&
                selectedTokenWeapons.length > 0 && (
                  <button
                    type="button"
                    className="mobile-attack-fab"
                    disabled={
                      attackWeapon?.tokenId !== selectedToken.id &&
                      !hasAttackDie
                    }
                    onClick={() => {
                      if (attackWeapon?.tokenId === selectedToken.id) {
                        cancelAttack();
                        setAttackPickerOpen(false);
                      } else {
                        setAttackPickerOpen((current) => !current);
                      }
                    }}
                  >
                    {attackWeapon?.tokenId === selectedToken.id
                      ? 'Cancel attack'
                      : `Weapons (${attackDieCount})`}
                  </button>
                )}
            </div>
            {attackPickerOpen && selectedToken && (
              <div className="mobile-attack-picker">
                <p className="mobile-attack-picker-title">Choose a weapon</p>
                {selectedTokenWeapons.map((item) => {
                  const { max } = parseHeatRating(item.heat_rating);
                  const state = selectedToken.weaponState[
                    item.instanceIndex
                  ] ?? { heat: 0, broken: false };
                  const overheated = Boolean(max) && state.heat > max;
                  return (
                    <button
                      type="button"
                      key={item.instanceIndex}
                      disabled={
                        state.broken ||
                        overheated ||
                        selectedTokenWrecked ||
                        !hasAttackDie
                      }
                      className="mobile-attack-picker-item"
                      onClick={() => {
                        startAttack(item.instanceIndex, item);
                        setAttackPickerOpen(false);
                      }}
                    >
                      {item.name}
                      {overheated && (
                        <span className="badge-overheated">OVERHEATED</span>
                      )}
                      {/* Hidden from the accessible name (#215's
                          precedent) so getByRole('button', { name:
                          'Long Range Bolt' })-style queries stay exact. */}
                      <span
                        className="unit-meta mobile-attack-picker-meta"
                        aria-hidden="true"
                      >
                        Slot{' '}
                        {state.side === 'left'
                          ? 'Left'
                          : state.side === 'right'
                            ? 'Right'
                            : slotForType(item.type)}{' '}
                        · Hit {item.hit_dice || '—'}
                      </span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setAttackPickerOpen(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
        <div
          className={`mobile-tab-panel ${mobileTab === 'units' ? 'mobile-tab-panel-active' : ''}`}
        >
          {/* Starting deployment happens from here on mobile (#145) — it's
              where Reserve units are managed, so it's the natural place to
              re-open deployment for reinforcements. Ending it stays on the
              Board tab (see the action toolbar below), since that's where
              you're looking once everything's placed. */}
          {isMobile && !deploymentPhase && (
            <button
              type="button"
              className="mobile-deploy-phase-btn-units"
              disabled={!deploymentZonesValid}
              onClick={() => setDeploymentPhase(true)}
            >
              Deploy Phase
            </button>
          )}
          {/* On mobile this instead becomes an "Import" tab inside the
              Reserve/Roster card below (#146), rather than its own block
              taking up space above it. */}
          {!isMobile && rosterImportPanel}
          {selectedToken && !deploymentPhase && (
            <TokenCard
              key={selectedToken.id}
              token={selectedToken}
              unit={selectedUnit}
              equipment={equipment}
              moving={
                movingTokenId === selectedToken.id ||
                dropPodArmed === selectedToken.id
              }
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
              deploymentPhase={deploymentPhase}
              hasActionDie={hasUnusedActionDie()}
              onArmDropPod={() => armDropPod(selectedToken.id)}
              hasMoveDie={hasMoveDie}
              hasAttackDie={hasAttackDie}
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
            onDeploy={deployFromReserve}
            importPanel={isMobile ? rosterImportPanel : null}
            deploymentPhase={deploymentPhase}
            hasActionDie={hasUnusedActionDie()}
            onDropPod={armDropPod}
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
      </div>
      <MobileTabBar activeTab={mobileTab} onSelectTab={setMobileTab} />
    </div>
  );
}

export default BattlePage;
