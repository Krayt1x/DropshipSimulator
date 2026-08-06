import { useEffect, useRef, useState } from 'react';
import { useLocalStorageState } from '../lib/storage.js';
import { resetActiveGame, DEFAULT_SCENARIO } from '../lib/gameState.js';
import { parseRosterExport } from '../lib/rosterImport.js';
import { DEFAULT_ROSTERS } from '../components/RosterImport.jsx';
import { DEFAULT_MAPS } from '../lib/maps.js';
import { useCatalogue } from '../lib/catalogue.js';
import MapThumbnail from '../components/MapThumbnail.jsx';
import BattlePage from './BattlePage.jsx';
import { useMultiplayer } from '../context/MultiplayerContext.jsx';

const DIFFICULTIES = [
  { id: 'simple', label: 'Simple' },
  { id: 'tactical', label: 'Tactical' },
  { id: 'expert', label: 'Expert' },
];

// Alternative win conditions (#232) — 'annihilation' is the game's original,
// always-on behavior (wipe out every enemy model); anything else here is an
// alternative way to end the match instead.
const SCENARIOS = [
  {
    id: 'annihilation',
    label: 'Annihilation',
    description: 'Wipe out every enemy model.',
  },
  {
    id: 'first-to-11',
    label: 'First to 11',
    description: 'First player to reach 11 victory points wins.',
  },
];

// Importing a map here was removed (#191) — map creation/maintenance is a
// Map Editor concern now, not something to redo on every new game.

// Shown inline wherever a WebRTC code needs handing to the other browser —
// read-only so the whole thing is easy to select, plus a one-click copy for
// browsers that support the Clipboard API.
function CopyCode({ code }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the textarea below can still be copied manually
    }
  }

  return (
    <div className="field">
      <textarea
        readOnly
        rows={4}
        value={code}
        onClick={(e) => e.target.select()}
      />
      <button type="button" className="ghost" onClick={copy}>
        {copied ? 'Copied!' : 'Copy code'}
      </button>
    </div>
  );
}

function PlayPage() {
  const { manufacturers, units, equipment } = useCatalogue();
  const [tokens] = useLocalStorageState('dropshipsimulator:battle:tokens', []);
  const hasActiveGame = tokens.length > 0;
  const mp = useMultiplayer();
  // Single Player vs Multiplayer is the wizard's own first step now (#250)
  // instead of a picker that lived above/outside it — picking either grows
  // the rest of the rail underneath, same pattern Vs CPU already uses for
  // its own extra steps. Lazily reads mp's current phase so navigating back
  // here mid-handshake (e.g. via the nav connection badge) lands on the
  // Multiplayer branch already, instead of resetting to unpicked.
  const [platform, setPlatform] = useState(() =>
    mp && mp.phase !== 'idle' ? 'multiplayer' : null,
  ); // null | 'single' | 'multiplayer'
  // Host/Join is a local UI choice, kept separate from mp.role so picking
  // "Host a game" can reveal its explanation/button before any WebRTC call
  // actually fires, instead of the old idle phase's two full-width cards
  // competing for space up front.
  const [mpChoice, setMpChoice] = useState(null); // null | 'host' | 'join'
  const [pastedOffer, setPastedOffer] = useState('');
  const [pastedAnswer, setPastedAnswer] = useState('');
  // Desktop gets a compact tabbed wizard instead of the ever-growing stacked
  // cascade (#247) — mobile keeps the cascade as-is, since a single scrolling
  // column already suits a phone. Same breakpoint the rest of the app's
  // mobile/desktop split already uses.
  const [isDesktopWizard, setIsDesktopWizard] = useState(() =>
    typeof window.matchMedia === 'function'
      ? window.matchMedia('(min-width: 701px)').matches
      : true,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const mql = window.matchMedia('(min-width: 701px)');
    const handler = (e) => setIsDesktopWizard(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);
  const [wizardStep, setWizardStep] = useState(() =>
    mp && mp.phase !== 'idle' ? 'code' : 'platform',
  );
  const [, setMyPlayer] = useLocalStorageState(
    'dropshipsimulator:myPlayer',
    null,
  );
  const [, setGameMode] = useLocalStorageState(
    'dropshipsimulator:gameMode',
    'sandbox',
  );
  const [, setBotDifficulty] = useLocalStorageState(
    'dropshipsimulator:botDifficulty',
    'simple',
  );
  // Read once by BattlePage.jsx's runBotDeployment (#173) to decide which
  // roster the bot deploys: a random default roster, one picked here by
  // name, or a pasted export of the human's own choosing.
  const [, setBotRoster] = useLocalStorageState('dropshipsimulator:botRoster', {
    type: 'random',
  });
  // Same shape as botRoster, but for the human's own side (#202) — read once
  // by BattlePage.jsx to pre-fill the player's reserve the same way the
  // bot's is pre-filled, instead of only the bot arriving ready to go.
  const [, setPlayerRoster] = useLocalStorageState(
    'dropshipsimulator:playerRoster',
    null,
  );
  // Write-only here — BattlePage.jsx reads these on mount once the game
  // actually starts (#176). Left untouched entirely when the human keeps
  // whatever's already in the Map Editor ("Current map").
  const [currentMapDimensions, setMapDimensions] = useLocalStorageState(
    'dropshipsimulator:mapEditor:dimensions',
    DEFAULT_MAPS[0].dimensions,
  );
  const [currentMapTileTypes, setMapTileTypes] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tileTypes',
    DEFAULT_MAPS[0].tileTypes,
  );
  const [currentMapTiles, setMapTiles] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tiles',
    {},
  );
  // A fresh game only — resuming one already in progress (the "Resume Game"
  // banner below) skips this, since that game's mode was already decided
  // when it started. Rather than swapping between separate step screens
  // (#184), each answer just grows this one card downward: Sandbox/Vs CPU
  // tiles, then (for Vs CPU) difficulty tiles, then the CPU's list, then the
  // map — each stage staying visible and re-pickable once the next appears.
  const [mode, setMode] = useState(null); // null | 'sandbox' | 'cpu'
  const [difficulty, setDifficulty] = useState(null);
  // Which manufacturer's lists to offer (#198) — chosen before the specific
  // list, rather than showing every default roster from every manufacturer
  // in one flat pile.
  const [rosterManufacturer, setRosterManufacturer] = useState(null);
  const [chosenRoster, setChosenRoster] = useState(null); // label of the finalized bot roster
  const [showRosterImport, setShowRosterImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  // Mirrors the bot's manufacturer/roster/import picker state above, but for
  // the human's own list (#202).
  const [playerRosterManufacturer, setPlayerRosterManufacturer] = useState(null);
  const [chosenPlayerRoster, setChosenPlayerRoster] = useState(null);
  const [showPlayerRosterImport, setShowPlayerRosterImport] = useState(false);
  const [playerImportText, setPlayerImportText] = useState('');
  const [playerImportPreview, setPlayerImportPreview] = useState(null);
  // 'current', or a DEFAULT_MAPS entry's name (#222) — picked from a modal
  // listing every pre-existing map instead of a hardcoded Current/Blank pair.
  const [mapChoice, setMapChoice] = useState('current');
  const [mapPickerOpen, setMapPickerOpen] = useState(false);
  // Which win condition this match uses (#232) — committed to storage only
  // once Start Game is pressed, same as the map choice above.
  const [scenario, setScenario] = useState(DEFAULT_SCENARIO);
  const [, setGameScenario] = useLocalStorageState(
    'dropshipsimulator:gameScenario',
    DEFAULT_SCENARIO,
  );
  // Who takes Turn 1 in a vs-CPU game (#239) — null until the player picks a
  // side directly or rolls the die. Meaningless for Sandbox (nothing to
  // randomize against), so it's never gated on there.
  const [firstPlayer, setFirstPlayer] = useState(null); // null | 'player' | 'cpu'
  const [firstPlayerRolling, setFirstPlayerRolling] = useState(false);
  const firstPlayerTimeoutRef = useRef(null);

  function resetPicker() {
    // A mid-handshake host/join attempt needs tearing down too, or mp.phase
    // would stay stuck non-idle in the background while the picker above it
    // shows a fresh, unpicked Platform step (#250).
    if (mp && mp.phase !== 'idle') mp.disconnect();
    setPlatform(null);
    setMpChoice(null);
    setPastedOffer('');
    setPastedAnswer('');
    setWizardStep('platform');
    setMode(null);
    setDifficulty(null);
    setRosterManufacturer(null);
    setChosenRoster(null);
    setShowRosterImport(false);
    setImportText('');
    setImportPreview(null);
    setPlayerRosterManufacturer(null);
    setChosenPlayerRoster(null);
    setShowPlayerRosterImport(false);
    setPlayerImportText('');
    setPlayerImportPreview(null);
    setMapChoice('current');
    setMapPickerOpen(false);
    setScenario(DEFAULT_SCENARIO);
    clearTimeout(firstPlayerTimeoutRef.current);
    setFirstPlayer(null);
    setFirstPlayerRolling(false);
  }

  useEffect(() => () => clearTimeout(firstPlayerTimeoutRef.current), []);

  function pickPlatform(p) {
    setPlatform(p);
    setMpChoice(null);
    setPastedOffer('');
    setPastedAnswer('');
    if (isDesktopWizard) setWizardStep(p === 'single' ? 'mode' : 'role');
  }

  function pickMpChoice(choice) {
    setMpChoice(choice);
    if (isDesktopWizard) setWizardStep('code');
  }

  function pickFirstPlayer(side) {
    if (firstPlayerRolling) return;
    setFirstPlayer(side);
    if (isDesktopWizard) setWizardStep('review');
  }

  // Flickers between Player/CPU with intervals that grow from a quick
  // back-and-forth into a deliberate final beat (~2s total) before landing
  // on the actual (pre-picked) result, so the roll reads as a real coin
  // wobbling to a stop rather than an instant random assignment.
  const FIRST_PLAYER_FLICKER_STEPS = [
    70, 75, 85, 95, 110, 130, 155, 185, 220, 260, 305, 355,
  ];

  const [firstPlayerSettled, setFirstPlayerSettled] = useState(null);

  function rerollFirstPlayer() {
    if (firstPlayerRolling) return;
    setFirstPlayerRolling(true);
    const finalSide = Math.random() < 0.5 ? 'player' : 'cpu';
    let current = firstPlayer;
    let i = 0;
    function step() {
      current = current === 'player' ? 'cpu' : 'player';
      const isLast = i === FIRST_PLAYER_FLICKER_STEPS.length - 1;
      setFirstPlayer(isLast ? finalSide : current);
      if (isLast) {
        setFirstPlayerRolling(false);
        setFirstPlayerSettled(finalSide);
        if (isDesktopWizard) setWizardStep('review');
        firstPlayerTimeoutRef.current = setTimeout(
          () => setFirstPlayerSettled(null),
          260,
        );
        return;
      }
      i += 1;
      firstPlayerTimeoutRef.current = setTimeout(
        step,
        FIRST_PLAYER_FLICKER_STEPS[i],
      );
    }
    firstPlayerTimeoutRef.current = setTimeout(
      step,
      FIRST_PLAYER_FLICKER_STEPS[0],
    );
  }

  function handleEndGame() {
    if (
      !window.confirm(
        'End this game? This will delete all deployed units and reset the board.',
      )
    ) {
      return;
    }
    resetActiveGame();
  }

  function pickMode(nextMode) {
    setMode(nextMode);
    setGameMode(nextMode === 'cpu' ? 'vs-computer' : 'sandbox');
    // Sandbox has no scenario picker (#242) — always plain annihilation,
    // even if a scenario was already chosen before switching modes.
    if (nextMode === 'sandbox') setScenario(DEFAULT_SCENARIO);
    setDifficulty(null);
    setRosterManufacturer(null);
    setChosenRoster(null);
    setShowRosterImport(false);
    setImportText('');
    setImportPreview(null);
    setPlayerRosterManufacturer(null);
    setChosenPlayerRoster(null);
    setShowPlayerRosterImport(false);
    setPlayerImportText('');
    setPlayerImportPreview(null);
    clearTimeout(firstPlayerTimeoutRef.current);
    setFirstPlayer(null);
    setFirstPlayerRolling(false);
    if (isDesktopWizard) setWizardStep(nextMode === 'cpu' ? 'difficulty' : 'map');
  }

  function pickDifficulty(nextDifficulty) {
    setDifficulty(nextDifficulty);
    setBotDifficulty(nextDifficulty);
    // The human always plays Player 1 against the bot, so canControl/canRoll
    // (BattlePage.jsx) restrict them to their own seat the same way hotseat
    // multiplayer identity already does.
    setMyPlayer('p1');
    setRosterManufacturer(null);
    setChosenRoster(null);
    setShowRosterImport(false);
    setPlayerRosterManufacturer(null);
    setChosenPlayerRoster(null);
    setShowPlayerRosterImport(false);
    if (isDesktopWizard) setWizardStep('rosters');
  }

  function pickRosterManufacturer(manufacturer) {
    setRosterManufacturer(manufacturer);
    setChosenRoster(null);
    setShowRosterImport(false);
  }

  function chooseRoster(botRoster, label) {
    setBotRoster(botRoster);
    setChosenRoster(label);
    setShowRosterImport(false);
    if (isDesktopWizard && chosenPlayerRoster) setWizardStep('map');
  }

  function previewImport() {
    setImportPreview(
      parseRosterExport(importText, { units, manufacturers, equipment }),
    );
  }

  function pickPlayerRosterManufacturer(manufacturer) {
    setPlayerRosterManufacturer(manufacturer);
    setChosenPlayerRoster(null);
    setShowPlayerRosterImport(false);
  }

  function choosePlayerRoster(roster, label) {
    setPlayerRoster(roster);
    setChosenPlayerRoster(label);
    setShowPlayerRosterImport(false);
    if (isDesktopWizard && chosenRoster) setWizardStep('map');
  }

  function previewPlayerImport() {
    setPlayerImportPreview(
      parseRosterExport(playerImportText, { units, manufacturers, equipment }),
    );
  }

  function pickMap(choice) {
    setMapChoice(choice);
    setMapPickerOpen(false);
    if (isDesktopWizard) setWizardStep(mode === 'cpu' ? 'scenario' : 'review');
  }

  function pickScenario(id) {
    setScenario(id);
    if (isDesktopWizard) setWizardStep('first');
  }

  function confirmStartGame() {
    if (mapChoice !== 'current') {
      const chosen = DEFAULT_MAPS.find((m) => m.name === mapChoice);
      if (chosen) {
        setMapDimensions(chosen.dimensions);
        setMapTileTypes(chosen.tileTypes);
        setMapTiles(chosen.tiles);
      }
    }
    // 'current' leaves whatever's already saved in the Map Editor alone.
    setGameScenario(scenario);
    if (mode === 'cpu') {
      // The human is always seated as p1 (see pickDifficulty) and the bot
      // p2 — "who plays first" (#239) only decides which of those two seats
      // Turn 1's active owner starts on, not who occupies which seat.
      window.localStorage.setItem(
        'dropshipsimulator:battle:turn',
        JSON.stringify({ number: 1, active: firstPlayer === 'cpu' ? 'p2' : 'p1' }),
      );
    }
    window.location.hash = '#battle';
  }

  const botRosterReady = mode === 'cpu' && Boolean(difficulty) && Boolean(chosenRoster);
  // The human also picks their own list before the map (#202), same as the
  // bot's.
  const rosterReady = botRosterReady && Boolean(chosenPlayerRoster);
  const mapStageReady = mode === 'sandbox' || rosterReady;
  // A render of whichever map is currently chosen (#243) — either the one
  // already saved in the Map Editor, or a DEFAULT_MAPS entry by name.
  const selectedMap =
    mapChoice === 'current'
      ? {
          dimensions: currentMapDimensions,
          tileTypes: currentMapTileTypes,
          tiles: currentMapTiles,
        }
      : (DEFAULT_MAPS.find((m) => m.name === mapChoice) ?? {
          dimensions: currentMapDimensions,
          tileTypes: currentMapTileTypes,
          tiles: currentMapTiles,
        });
  const readyToStart =
    mode === 'sandbox' || (Boolean(firstPlayer) && !firstPlayerRolling);
  // Once mp.role is set (past the idle phase), the actual handshake already
  // decided Host vs Join — mpChoice only matters for the brief window before
  // that, while still on the idle phase picking one (#250).
  const effectiveMpChoice =
    mp && mp.phase !== 'idle'
      ? mp.role === 'guest'
        ? 'join'
        : 'host'
      : mpChoice;

  // The desktop wizard's tab list (#247) — grows/shrinks with `mode` (and now
  // `platform`, #250), same stages the mobile cascade below shows, just one
  // at a time instead of all stacked. Map/Scenario already have working
  // defaults, so they're always "done"; only Rosters and First player
  // require an explicit pick before the wizard lets you skip past them.
  const WIZARD_STEPS =
    platform === 'multiplayer'
      ? [
          { key: 'platform', label: 'Play as' },
          { key: 'role', label: 'Host or Join' },
          { key: 'code', label: 'Code exchange' },
        ]
      : [
          { key: 'platform', label: 'Play as' },
          { key: 'mode', label: 'Mode' },
          ...(mode === 'cpu'
            ? [
                { key: 'difficulty', label: 'Difficulty' },
                { key: 'rosters', label: 'Rosters' },
              ]
            : []),
          { key: 'map', label: 'Map' },
          ...(mode === 'cpu'
            ? [
                { key: 'scenario', label: 'Scenario' },
                { key: 'first', label: 'First player' },
              ]
            : []),
          { key: 'review', label: 'Review' },
        ];

  function isWizardStepDone(key) {
    if (key === 'platform') return Boolean(platform);
    if (key === 'mode') return Boolean(mode);
    if (key === 'difficulty') return Boolean(difficulty);
    if (key === 'rosters') return rosterReady;
    if (key === 'map') return Boolean(mapChoice);
    if (key === 'scenario') return Boolean(scenario);
    if (key === 'first') return Boolean(firstPlayer);
    if (key === 'role') return Boolean(effectiveMpChoice);
    return false;
  }

  function wizardStepSummary(key) {
    if (key === 'platform') {
      return platform === 'single'
        ? 'Single Player'
        : platform === 'multiplayer'
          ? 'Multiplayer'
          : '';
    }
    if (key === 'mode') {
      return mode === 'cpu' ? 'Vs CPU' : mode === 'sandbox' ? 'Sandbox' : '';
    }
    if (key === 'difficulty') {
      return DIFFICULTIES.find((d) => d.id === difficulty)?.label ?? '';
    }
    if (key === 'rosters') {
      return chosenPlayerRoster && chosenRoster
        ? `${playerRosterManufacturer} vs ${rosterManufacturer}`
        : '';
    }
    if (key === 'map') {
      return mapChoice === 'current' ? 'Current map' : mapChoice;
    }
    if (key === 'scenario') {
      return SCENARIOS.find((s) => s.id === scenario)?.label ?? '';
    }
    if (key === 'first') {
      return firstPlayer === 'player'
        ? 'Player'
        : firstPlayer === 'cpu'
          ? 'CPU'
          : '';
    }
    if (key === 'role') {
      return effectiveMpChoice === 'host'
        ? 'Hosting'
        : effectiveMpChoice === 'join'
          ? 'Joining'
          : '';
    }
    return '';
  }

  // Map/Scenario already default to a valid choice, so picking one isn't the
  // only way forward — this is the explicit fallback for "I'm happy with the
  // default, move on" (auto-advance-on-pick above still fires for anyone who
  // does pick something new).
  function continueFromWizardStep(key) {
    const steps = WIZARD_STEPS;
    const index = steps.findIndex((s) => s.key === key);
    const next = steps[index + 1];
    if (next) setWizardStep(next.key);
  }

  // Each stage's inner content, shared verbatim between the mobile cascade
  // (all stages stacked, one after another) and the desktop wizard (one
  // stage shown at a time — #247) so the two layouts can never drift apart.
  function renderPlatformOptions() {
    return (
      <>
        <p className="stage-label">How do you want to play?</p>
        <div className="home-tile-grid two-col-mobile-grid">
          <button
            type="button"
            className={`home-tile ${platform === 'single' ? 'selected' : ''}`}
            onClick={() => pickPlatform('single')}
          >
            <span className="home-tile-icon">🧍</span>
            <span className="home-tile-title">Single Player</span>
            <span className="home-tile-description">
              Play locally on one device — no connection needed.
            </span>
          </button>
          <button
            type="button"
            className={`home-tile ${platform === 'multiplayer' ? 'selected' : ''}`}
            onClick={() => pickPlatform('multiplayer')}
          >
            <span className="home-tile-icon">🔗</span>
            <span className="home-tile-title">Multiplayer</span>
            <span className="home-tile-description">
              Connect two browsers so a match stays in sync live.
            </span>
          </button>
        </div>
      </>
    );
  }

  function renderRoleOptions() {
    return (
      <>
        <p className="stage-label">Host or join a game?</p>
        <div className="home-tile-grid two-col-mobile-grid">
          <button
            type="button"
            className={`home-tile ${effectiveMpChoice === 'host' ? 'selected' : ''}`}
            disabled={mp?.phase !== 'idle'}
            onClick={() => pickMpChoice('host')}
          >
            <span className="home-tile-icon">📡</span>
            <span className="home-tile-title">Host a game</span>
            <span className="home-tile-description">
              Creates a code to send to your opponent.
            </span>
          </button>
          <button
            type="button"
            className={`home-tile ${effectiveMpChoice === 'join' ? 'selected' : ''}`}
            disabled={mp?.phase !== 'idle'}
            onClick={() => pickMpChoice('join')}
          >
            <span className="home-tile-icon">📥</span>
            <span className="home-tile-title">Join a game</span>
            <span className="home-tile-description">
              Paste the code your host sent you.
            </span>
          </button>
        </div>
      </>
    );
  }

  function renderCodeExchange() {
    if (!mp) return null;
    const { role, phase, offerCode, answerCode, error } = mp;

    return (
      <>
        {error && (
          <div className="card" style={{ borderColor: '#dc2626', marginBottom: 12 }}>
            <p className="unit-meta" style={{ color: '#dc2626' }}>
              {error}
            </p>
          </div>
        )}

        {phase === 'idle' && effectiveMpChoice === 'host' && (
          <>
            <p className="stage-label">Host a game</p>
            <button type="button" onClick={mp.startHost}>
              Host a game
            </button>
          </>
        )}

        {phase === 'idle' && effectiveMpChoice === 'join' && (
          <>
            <p className="stage-label">Join a game</p>
            <div className="field">
              <label htmlFor="join-offer-code">Paste host's code here</label>
              <textarea
                id="join-offer-code"
                rows={4}
                placeholder="Paste host's code here"
                value={pastedOffer}
                onChange={(e) => setPastedOffer(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={!pastedOffer.trim()}
              onClick={() => mp.joinWithOffer(pastedOffer.trim())}
            >
              Join a game
            </button>
          </>
        )}

        {phase === 'offer-ready' && role === 'host' && (
          <>
            <p className="stage-label">Step 1: send this code to your opponent</p>
            <CopyCode code={offerCode} />
            <p className="stage-label" style={{ marginTop: 16 }}>
              Step 2: paste the answer code they send back
            </p>
            <div className="field">
              <textarea
                rows={4}
                placeholder="Paste their answer code here"
                value={pastedAnswer}
                onChange={(e) => setPastedAnswer(e.target.value)}
              />
            </div>
            <button
              type="button"
              disabled={!pastedAnswer.trim()}
              onClick={() => mp.submitAnswer(pastedAnswer.trim())}
            >
              Connect
            </button>
          </>
        )}

        {phase === 'connecting' && role === 'guest' && answerCode && (
          <>
            <p className="stage-label">Send this code back to your host</p>
            <CopyCode code={answerCode} />
            <p className="unit-meta">
              Waiting for the host to finish connecting…
            </p>
          </>
        )}

        {phase === 'connecting' && !(role === 'guest' && answerCode) && (
          <p className="unit-meta">Connecting…</p>
        )}
      </>
    );
  }

  function renderModeOptions() {
    return (
      <>
        <p className="stage-label">Sandbox or Vs CPU?</p>
        <div className="home-tile-grid two-col-mobile-grid">
          <button
            type="button"
            className={`home-tile ${mode === 'sandbox' ? 'selected' : ''}`}
            onClick={() => pickMode('sandbox')}
          >
            <span className="home-tile-icon">🏖️</span>
            <span className="home-tile-title">Sandbox</span>
            <span className="home-tile-description">
              Control both sides yourself.
            </span>
          </button>
          <button
            type="button"
            className={`home-tile ${mode === 'cpu' ? 'selected' : ''}`}
            onClick={() => pickMode('cpu')}
          >
            <span className="home-tile-icon">🖥️</span>
            <span className="home-tile-title">Vs CPU</span>
            <span className="home-tile-description">
              Play against the computer.
            </span>
          </button>
        </div>
      </>
    );
  }

  function renderDifficultyOptions() {
    return (
      <>
        <p className="stage-label">Choose a difficulty</p>
        <div className="home-tile-grid play-difficulty-grid">
          {DIFFICULTIES.map((d) => (
            <button
              key={d.id}
              type="button"
              className={`home-tile ${difficulty === d.id ? 'selected' : ''}`}
              onClick={() => pickDifficulty(d.id)}
            >
              <span className="home-tile-title">{d.label}</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  function renderRostersOptions() {
    return (
      <>
        <p className="stage-label">Choose your list and the computer's</p>
        <div className="roster-picker-columns">
          <div>
            <p className="roster-picker-column-label">You</p>
            <div className="manufacturer-tile-list">
              {manufacturers.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`manufacturer-tile ${playerRosterManufacturer === m ? 'selected' : ''}`}
                  onClick={() => pickPlayerRosterManufacturer(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            {playerRosterManufacturer && (
              <>
                <div className="tile-palette-list" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className={`tile-swatch-btn ${chosenPlayerRoster === 'Random' ? 'selected' : ''}`}
                    onClick={() =>
                      choosePlayerRoster(
                        { type: 'random', manufacturer: playerRosterManufacturer },
                        'Random',
                      )
                    }
                  >
                    Random
                  </button>
                  {DEFAULT_ROSTERS.filter(
                    (roster) => roster.manufacturer === playerRosterManufacturer,
                  ).map((roster) => (
                    <div key={roster.name} className="roster-accordion-item">
                      <button
                        type="button"
                        className={`tile-swatch-btn ${chosenPlayerRoster === roster.name ? 'selected' : ''}`}
                        onClick={() =>
                          choosePlayerRoster(
                            { type: 'specific', name: roster.name },
                            roster.name,
                          )
                        }
                      >
                        {roster.name}
                      </button>
                      {chosenPlayerRoster === roster.name && (
                        <pre className="roster-accordion-description">
                          {roster.text}
                        </pre>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className={`tile-swatch-btn ${showPlayerRosterImport ? 'selected' : ''}`}
                    onClick={() => setShowPlayerRosterImport((v) => !v)}
                  >
                    Import…
                  </button>
                </div>
                {DEFAULT_ROSTERS.every(
                  (roster) => roster.manufacturer !== playerRosterManufacturer,
                ) && (
                  <p className="unit-meta" style={{ marginTop: 8 }}>
                    No default lists for {playerRosterManufacturer} yet —
                    Random will pull from another manufacturer, or import a
                    list instead.
                  </p>
                )}
                {showPlayerRosterImport && (
                  <div className="field" style={{ marginTop: 10 }}>
                    <label htmlFor="player-roster-import-text">
                      Roster export
                    </label>
                    <textarea
                      id="player-roster-import-text"
                      rows={6}
                      placeholder="Paste your exported list here"
                      value={playerImportText}
                      onChange={(e) => {
                        setPlayerImportText(e.target.value);
                        setPlayerImportPreview(null);
                      }}
                    />
                    <div className="token-owner-row" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="ghost"
                        disabled={!playerImportText.trim()}
                        onClick={previewPlayerImport}
                      >
                        Preview import
                      </button>
                      <button
                        type="button"
                        disabled={
                          !playerImportPreview ||
                          playerImportPreview.entries.length === 0
                        }
                        onClick={() =>
                          choosePlayerRoster(
                            { type: 'import', text: playerImportText },
                            'Imported list',
                          )
                        }
                      >
                        Use this list
                      </button>
                    </div>
                    {playerImportPreview && (
                      <p className="unit-meta" style={{ marginTop: 8 }}>
                        {playerImportPreview.entries.length > 0
                          ? `${playerImportPreview.entries.length} unit${playerImportPreview.entries.length === 1 ? '' : 's'} found.`
                          : 'No units found in this export.'}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
          <div>
            <p className="roster-picker-column-label">Computer</p>
            <div className="manufacturer-tile-list">
              {manufacturers.map((m) => (
                <button
                  key={m}
                  type="button"
                  className={`manufacturer-tile ${rosterManufacturer === m ? 'selected' : ''}`}
                  onClick={() => pickRosterManufacturer(m)}
                >
                  {m}
                </button>
              ))}
            </div>
            {rosterManufacturer && (
              <>
                <div className="tile-palette-list" style={{ marginTop: 8 }}>
                  <button
                    type="button"
                    className={`tile-swatch-btn ${chosenRoster === 'Random' ? 'selected' : ''}`}
                    onClick={() =>
                      chooseRoster(
                        { type: 'random', manufacturer: rosterManufacturer },
                        'Random',
                      )
                    }
                  >
                    Random
                  </button>
                  {DEFAULT_ROSTERS.filter(
                    (roster) => roster.manufacturer === rosterManufacturer,
                  ).map((roster) => (
                    <div key={roster.name} className="roster-accordion-item">
                      <button
                        type="button"
                        className={`tile-swatch-btn ${chosenRoster === roster.name ? 'selected' : ''}`}
                        onClick={() =>
                          chooseRoster(
                            { type: 'specific', name: roster.name },
                            roster.name,
                          )
                        }
                      >
                        {roster.name}
                      </button>
                      {chosenRoster === roster.name && (
                        <pre className="roster-accordion-description">
                          {roster.text}
                        </pre>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    className={`tile-swatch-btn ${showRosterImport ? 'selected' : ''}`}
                    onClick={() => setShowRosterImport((v) => !v)}
                  >
                    Import…
                  </button>
                </div>
                {DEFAULT_ROSTERS.every(
                  (roster) => roster.manufacturer !== rosterManufacturer,
                ) && (
                  <p className="unit-meta" style={{ marginTop: 8 }}>
                    No default lists for {rosterManufacturer} yet — Random
                    will pull from another manufacturer, or import a list
                    instead.
                  </p>
                )}
                {showRosterImport && (
                  <div className="field" style={{ marginTop: 10 }}>
                    <label htmlFor="bot-roster-import-text">
                      Roster export
                    </label>
                    <textarea
                      id="bot-roster-import-text"
                      rows={6}
                      placeholder="Paste your exported list here"
                      value={importText}
                      onChange={(e) => {
                        setImportText(e.target.value);
                        setImportPreview(null);
                      }}
                    />
                    <div className="token-owner-row" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className="ghost"
                        disabled={!importText.trim()}
                        onClick={previewImport}
                      >
                        Preview import
                      </button>
                      <button
                        type="button"
                        disabled={
                          !importPreview || importPreview.entries.length === 0
                        }
                        onClick={() =>
                          chooseRoster(
                            { type: 'import', text: importText },
                            'Imported list',
                          )
                        }
                      >
                        Use this list
                      </button>
                    </div>
                    {importPreview && (
                      <p className="unit-meta" style={{ marginTop: 8 }}>
                        {importPreview.entries.length > 0
                          ? `${importPreview.entries.length} unit${importPreview.entries.length === 1 ? '' : 's'} found.`
                          : 'No units found in this export.'}
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </>
    );
  }

  function renderMapOptions() {
    return (
      <>
        <p className="stage-label">Which map do you want to play?</p>
        <button
          type="button"
          className="ghost"
          onClick={() => setMapPickerOpen(true)}
        >
          Select map
        </button>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginTop: 8,
          }}
        >
          <MapThumbnail
            dimensions={selectedMap.dimensions}
            tileTypes={selectedMap.tileTypes}
            tiles={selectedMap.tiles}
            size={64}
          />
          <p className="unit-meta" style={{ margin: 0 }}>
            {mapChoice === 'current' ? 'Current map' : mapChoice}
          </p>
        </div>
      </>
    );
  }

  function renderScenarioOptions() {
    return (
      <>
        <p className="stage-label">Which scenario do you want to play?</p>
        <div className="home-tile-grid two-col-mobile-grid">
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`home-tile ${scenario === s.id ? 'selected' : ''}`}
              onClick={() => pickScenario(s.id)}
            >
              <span className="home-tile-title">{s.label}</span>
              <span className="home-tile-description">{s.description}</span>
            </button>
          ))}
        </div>
      </>
    );
  }

  function renderFirstPlayerOptions() {
    return (
      <>
        <p className="stage-label">Who plays first?</p>
        <div className="first-player-row">
          <button
            type="button"
            className={`home-tile ${firstPlayer === 'player' ? 'selected' : ''} ${firstPlayerSettled === 'player' ? 'settled' : ''}`}
            disabled={firstPlayerRolling}
            onClick={() => pickFirstPlayer('player')}
          >
            <span className="home-tile-title">Player</span>
            <span className="home-tile-description">
              {firstPlayer === 'player' ? 'Going first' : ''}
            </span>
          </button>
          <button
            type="button"
            className="first-player-reroll"
            disabled={firstPlayerRolling}
            onClick={rerollFirstPlayer}
            aria-label="Randomize who goes first"
            title="Randomize who goes first"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
              <path d="M8 21H3v-5" />
            </svg>
          </button>
          <button
            type="button"
            className={`home-tile ${firstPlayer === 'cpu' ? 'selected' : ''} ${firstPlayerSettled === 'cpu' ? 'settled' : ''}`}
            disabled={firstPlayerRolling}
            onClick={() => pickFirstPlayer('cpu')}
          >
            <span className="home-tile-title">CPU</span>
            <span className="home-tile-description">
              {firstPlayer === 'cpu' ? 'Going first' : ''}
            </span>
          </button>
        </div>
      </>
    );
  }

  // Once connected, status and Disconnect live in the nav's connection badge
  // instead (#115) — the picker above it is only for getting there.
  if (mp?.phase === 'connected') return <BattlePage />;

  return (
    <div className="container home-container">
      <h1 style={{ textAlign: 'center' }}>Play</h1>
      <p
        className="unit-meta"
        style={{ textAlign: 'center', marginBottom: 24 }}
      >
        Choose how you want to play.
      </p>
      {hasActiveGame && (
        <div className="resume-game-row">
          <a href="#battle" className="resume-game-banner">
            <span className="resume-game-icon">▶</span>
            <span>
              <span className="resume-game-title">Resume Game</span>
              <span className="resume-game-description">
                Continue the match already in progress
              </span>
            </span>
          </a>
          <button type="button" className="danger" onClick={handleEndGame}>
            End Game
          </button>
        </div>
      )}

      {hasActiveGame && (
        <p className="unit-meta" style={{ textAlign: 'center' }}>
          A game is already in progress — use Resume Game above, or End Game
          to start a new one.
        </p>
      )}

      {!hasActiveGame && isDesktopWizard && (
        <div className="card wizard-card" style={{ marginTop: 16 }}>
          <div className="reserve-header">
            <p className="unit-name">New Game</p>
            <button type="button" className="ghost" onClick={resetPicker}>
              Cancel
            </button>
          </div>
          <div className="wizard-layout">
            <div className="wizard-rail">
              {WIZARD_STEPS.map((s, i) => {
                const done = isWizardStepDone(s.key);
                const reachable =
                  i === 0 ||
                  isWizardStepDone(WIZARD_STEPS[i - 1].key) ||
                  done ||
                  s.key === wizardStep;
                const summary = wizardStepSummary(s.key);
                return (
                  <button
                    key={s.key}
                    type="button"
                    className={`wizard-rail-step ${s.key === wizardStep ? 'current' : ''} ${done ? 'done' : ''}`}
                    disabled={!reachable}
                    onClick={() => setWizardStep(s.key)}
                  >
                    <span className="wizard-rail-dot">
                      {done ? '✓' : i + 1}
                    </span>
                    <span className="wizard-rail-text">
                      <span className="wizard-rail-label">{s.label}</span>
                      {summary && (
                        <span className="wizard-rail-summary">{summary}</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="wizard-body">
              {wizardStep === 'platform' && renderPlatformOptions()}
              {wizardStep === 'role' && renderRoleOptions()}
              {wizardStep === 'code' && renderCodeExchange()}
              {wizardStep === 'mode' && renderModeOptions()}
              {wizardStep === 'difficulty' && renderDifficultyOptions()}
              {wizardStep === 'rosters' && renderRostersOptions()}
              {wizardStep === 'map' && renderMapOptions()}
              {wizardStep === 'scenario' && renderScenarioOptions()}
              {wizardStep === 'first' && renderFirstPlayerOptions()}
              {wizardStep !== 'review' && wizardStep !== 'code' && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    marginTop: 16,
                  }}
                >
                  <button
                    type="button"
                    disabled={!isWizardStepDone(wizardStep)}
                    onClick={() => continueFromWizardStep(wizardStep)}
                  >
                    Continue
                  </button>
                </div>
              )}
              {wizardStep === 'review' && (
                <>
                  <p className="stage-label">Review &amp; start</p>
                  {WIZARD_STEPS.filter((s) => s.key !== 'review').map((s) => (
                    <div key={s.key} className="wizard-review-line">
                      <span>{s.label}</span>
                      <span>{wizardStepSummary(s.key) || '—'}</span>
                    </div>
                  ))}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      marginTop: 16,
                    }}
                  >
                    <button
                      type="button"
                      disabled={!readyToStart}
                      onClick={confirmStartGame}
                    >
                      Start Game
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {!hasActiveGame && !isDesktopWizard && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="reserve-header">
            <p className="unit-name">New Game</p>
            <button type="button" className="ghost" onClick={resetPicker}>
              Cancel
            </button>
          </div>

          {renderPlatformOptions()}

          {platform === 'single' && (
            <div className="cascade-stage">{renderModeOptions()}</div>
          )}

          {platform === 'single' && mode === 'cpu' && (
            <div className="cascade-stage">{renderDifficultyOptions()}</div>
          )}

          {platform === 'single' && mode === 'cpu' && difficulty && (
            <div className="cascade-stage">{renderRostersOptions()}</div>
          )}

          {platform === 'single' && mapStageReady && (
            <div className="cascade-stage">{renderMapOptions()}</div>
          )}

          {platform === 'single' && mapStageReady && mode === 'cpu' && (
            <div className="cascade-stage">{renderScenarioOptions()}</div>
          )}

          {platform === 'single' && mapStageReady && mode === 'cpu' && (
            <div className="cascade-stage">{renderFirstPlayerOptions()}</div>
          )}

          {platform === 'single' && mapStageReady && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: 4,
              }}
            >
              <button
                type="button"
                disabled={!readyToStart}
                onClick={confirmStartGame}
              >
                Start Game
              </button>
            </div>
          )}

          {platform === 'multiplayer' && (
            <div className="cascade-stage">{renderRoleOptions()}</div>
          )}

          {platform === 'multiplayer' && effectiveMpChoice && (
            <div className="cascade-stage">{renderCodeExchange()}</div>
          )}
        </div>
      )}

      {mapPickerOpen && (
        <div
          className="map-picker-overlay"
          onClick={() => setMapPickerOpen(false)}
        >
          <div className="card map-picker-modal" onClick={(e) => e.stopPropagation()}>
            <p className="unit-name">Choose a map</p>
            <div className="home-tile-grid two-col-mobile-grid">
              <button
                type="button"
                className={`home-tile ${mapChoice === 'current' ? 'selected' : ''}`}
                onClick={() => pickMap('current')}
              >
                <MapThumbnail
                  dimensions={currentMapDimensions}
                  tileTypes={currentMapTileTypes}
                  tiles={currentMapTiles}
                />
                <span className="home-tile-title">Current map</span>
                <span className="home-tile-description">
                  Whatever's already saved in the Map Editor.
                </span>
              </button>
              {DEFAULT_MAPS.map((m) => (
                <button
                  key={m.name}
                  type="button"
                  className={`home-tile ${mapChoice === m.name ? 'selected' : ''}`}
                  onClick={() => pickMap(m.name)}
                >
                  <MapThumbnail
                    dimensions={m.dimensions}
                    tileTypes={m.tileTypes}
                    tiles={m.tiles}
                  />
                  <span className="home-tile-title">{m.name}</span>
                  <span className="home-tile-description">
                    {m.dimensions.cols} × {m.dimensions.rows}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ghost"
              style={{ marginTop: 16 }}
              onClick={() => setMapPickerOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayPage;
