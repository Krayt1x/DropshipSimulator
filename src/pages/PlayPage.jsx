import { useState } from 'react';
import { useLocalStorageState } from '../lib/storage.js';
import { resetActiveGame } from '../lib/gameState.js';
import { parseRosterExport } from '../lib/rosterImport.js';
import { DEFAULT_ROSTERS } from '../components/RosterImport.jsx';
import { DEFAULT_MAPS } from '../lib/maps.js';
import { useCatalogue } from '../lib/catalogue.js';

const DIFFICULTIES = [
  { id: 'simple', label: 'Simple' },
  { id: 'tactical', label: 'Tactical' },
  { id: 'expert', label: 'Expert' },
];

// Importing a map here was removed (#191) — map creation/maintenance is a
// Map Editor concern now, not something to redo on every new game.
const MAP_CHOICES = [
  { id: 'current', label: 'Current map' },
  { id: 'blank', label: 'Blank' },
];

function PlayPage() {
  const { manufacturers, units, equipment } = useCatalogue();
  const [tokens] = useLocalStorageState('dropshipsimulator:battle:tokens', []);
  const hasActiveGame = tokens.length > 0;
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
  // Write-only here — BattlePage.jsx reads these on mount once the game
  // actually starts (#176). Left untouched entirely when the human keeps
  // whatever's already in the Map Editor ("Current map").
  const [, setMapDimensions] = useLocalStorageState(
    'dropshipsimulator:mapEditor:dimensions',
    DEFAULT_MAPS[0].dimensions,
  );
  const [, setMapTileTypes] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tileTypes',
    DEFAULT_MAPS[0].tileTypes,
  );
  const [, setMapTiles] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tiles',
    {},
  );
  // A fresh game only — resuming one already in progress (the "Resume Game"
  // banner below) skips this, since that game's mode was already decided
  // when it started. Rather than swapping between separate step screens
  // (#184), each answer just grows this one card downward: Sandbox/Vs CPU
  // tiles, then (for Vs CPU) difficulty tiles, then the CPU's list, then the
  // map — each stage staying visible and re-pickable once the next appears.
  const [expanded, setExpanded] = useState(false);
  const [mode, setMode] = useState(null); // null | 'sandbox' | 'cpu'
  const [difficulty, setDifficulty] = useState(null);
  const [chosenRoster, setChosenRoster] = useState(null); // label of the finalized bot roster
  const [showRosterImport, setShowRosterImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [mapChoice, setMapChoice] = useState('current'); // 'current' | 'blank'

  function resetPicker() {
    setExpanded(false);
    setMode(null);
    setDifficulty(null);
    setChosenRoster(null);
    setShowRosterImport(false);
    setImportText('');
    setImportPreview(null);
    setMapChoice('current');
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
    setDifficulty(null);
    setChosenRoster(null);
    setShowRosterImport(false);
    setImportText('');
    setImportPreview(null);
  }

  function pickDifficulty(nextDifficulty) {
    setDifficulty(nextDifficulty);
    setBotDifficulty(nextDifficulty);
    // The human always plays Player 1 against the bot, so canControl/canRoll
    // (BattlePage.jsx) restrict them to their own seat the same way hotseat
    // multiplayer identity already does.
    setMyPlayer('p1');
    setChosenRoster(null);
    setShowRosterImport(false);
  }

  function chooseRoster(botRoster, label) {
    setBotRoster(botRoster);
    setChosenRoster(label);
    setShowRosterImport(false);
  }

  function previewImport() {
    setImportPreview(
      parseRosterExport(importText, { units, manufacturers, equipment }),
    );
  }

  function confirmStartGame() {
    if (mapChoice === 'blank') {
      const blank = DEFAULT_MAPS.find((m) => m.name === 'Blank');
      setMapDimensions(blank.dimensions);
      setMapTileTypes(blank.tileTypes);
      setMapTiles(blank.tiles);
    }
    // 'current' leaves whatever's already saved in the Map Editor alone.
    window.location.hash = '#battle';
  }

  const rosterReady = mode === 'cpu' && Boolean(difficulty) && Boolean(chosenRoster);
  const mapStageReady = mode === 'sandbox' || rosterReady;

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
      <div className="home-tile-grid">
        {hasActiveGame ? (
          <a className="home-tile" href="#battle">
            <span className="home-tile-icon">🧍</span>
            <span className="home-tile-title">Single Player</span>
            <span className="home-tile-description">
              Play locally on one device — no connection needed.
            </span>
          </a>
        ) : (
          <button
            type="button"
            className="home-tile"
            onClick={() => setExpanded(true)}
          >
            <span className="home-tile-icon">🧍</span>
            <span className="home-tile-title">Single Player</span>
            <span className="home-tile-description">
              Play locally on one device — no connection needed.
            </span>
          </button>
        )}
        <a className="home-tile" href="#connect">
          <span className="home-tile-icon">🔗</span>
          <span className="home-tile-title">Multiplayer</span>
          <span className="home-tile-description">
            Connect two browsers so a match stays in sync live.
          </span>
        </a>
      </div>

      {expanded && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="reserve-header">
            <p className="unit-name">Single Player</p>
            <button type="button" className="ghost" onClick={resetPicker}>
              Cancel
            </button>
          </div>

          <p className="stage-label">How do you want to play?</p>
          <div className="home-tile-grid">
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

          {mode === 'cpu' && (
            <div className="cascade-stage">
              <p className="stage-label">Choose a difficulty</p>
              <div className="home-tile-grid">
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
            </div>
          )}

          {mode === 'cpu' && difficulty && (
            <div className="cascade-stage">
              <p className="stage-label">
                Which list should the computer play?
              </p>
              <div className="tile-palette-list">
                <button
                  type="button"
                  className={`tile-swatch-btn ${chosenRoster === 'Random' ? 'selected' : ''}`}
                  onClick={() => chooseRoster({ type: 'random' }, 'Random')}
                >
                  Random
                </button>
                {DEFAULT_ROSTERS.map((roster) => (
                  <button
                    key={roster.name}
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
                ))}
                <button
                  type="button"
                  className={`tile-swatch-btn ${showRosterImport ? 'selected' : ''}`}
                  onClick={() => setShowRosterImport(true)}
                >
                  Import…
                </button>
              </div>

              {showRosterImport && (
                <div className="field" style={{ marginTop: 10 }}>
                  <label htmlFor="bot-roster-import-text">Roster export</label>
                  <textarea
                    id="bot-roster-import-text"
                    rows={8}
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
                      {importPreview.warnings.map((warning) => (
                        <span key={warning} style={{ display: 'block' }}>
                          {warning}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {mapStageReady && (
            <div className="cascade-stage">
              <p className="stage-label">Which map do you want to play?</p>
              <div className="home-tile-grid">
                {MAP_CHOICES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`home-tile ${mapChoice === m.id ? 'selected' : ''}`}
                    onClick={() => setMapChoice(m.id)}
                  >
                    <span className="home-tile-title">{m.label}</span>
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  marginTop: 16,
                }}
              >
                <button type="button" onClick={confirmStartGame}>
                  Start Game
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default PlayPage;
