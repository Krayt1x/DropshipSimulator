import { useState } from 'react';
import { useLocalStorageState } from '../lib/storage.js';
import { resetActiveGame } from '../lib/gameState.js';
import { parseRosterExport } from '../lib/rosterImport.js';
import { DEFAULT_ROSTERS } from '../components/RosterImport.jsx';
import { DEFAULT_MAPS } from '../lib/maps.js';
import { useCatalogue } from '../lib/catalogue.js';
import MapThumbnail from '../components/MapThumbnail.jsx';

const DIFFICULTIES = [
  { id: 'simple', label: 'Simple' },
  { id: 'tactical', label: 'Tactical' },
  { id: 'expert', label: 'Expert' },
];

// Importing a map here was removed (#191) — map creation/maintenance is a
// Map Editor concern now, not something to redo on every new game.

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
  const [expanded, setExpanded] = useState(false);
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

  function resetPicker() {
    setExpanded(false);
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
    setPlayerRosterManufacturer(null);
    setChosenPlayerRoster(null);
    setShowPlayerRosterImport(false);
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
  }

  function previewPlayerImport() {
    setPlayerImportPreview(
      parseRosterExport(playerImportText, { units, manufacturers, equipment }),
    );
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
    window.location.hash = '#battle';
  }

  const botRosterReady = mode === 'cpu' && Boolean(difficulty) && Boolean(chosenRoster);
  // The human also picks their own list before the map (#202), same as the
  // bot's.
  const rosterReady = botRosterReady && Boolean(chosenPlayerRoster);
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
                Which manufacturer should the computer play? (#198)
              </p>
              <div className="tile-palette-list">
                {manufacturers.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`tile-swatch-btn ${rosterManufacturer === m ? 'selected' : ''}`}
                    onClick={() => pickRosterManufacturer(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'cpu' && difficulty && rosterManufacturer && (
            <div className="cascade-stage">
              <p className="stage-label">
                Which list should the computer play?
              </p>
              <div className="tile-palette-list">
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
              {DEFAULT_ROSTERS.every(
                (roster) => roster.manufacturer !== rosterManufacturer,
              ) && (
                <p className="unit-meta" style={{ marginTop: 8 }}>
                  No default lists for {rosterManufacturer} yet — Random will
                  pull from another manufacturer, or import a list instead.
                </p>
              )}

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

          {botRosterReady && (
            <div className="cascade-stage">
              <p className="stage-label">
                Which manufacturer will you play? (#202)
              </p>
              <div className="tile-palette-list">
                {manufacturers.map((m) => (
                  <button
                    key={m}
                    type="button"
                    className={`tile-swatch-btn ${playerRosterManufacturer === m ? 'selected' : ''}`}
                    onClick={() => pickPlayerRosterManufacturer(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          )}

          {botRosterReady && playerRosterManufacturer && (
            <div className="cascade-stage">
              <p className="stage-label">Which list will you play?</p>
              <div className="tile-palette-list">
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
                  <button
                    key={roster.name}
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
                ))}
                <button
                  type="button"
                  className={`tile-swatch-btn ${showPlayerRosterImport ? 'selected' : ''}`}
                  onClick={() => setShowPlayerRosterImport(true)}
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
                    rows={8}
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
                      {playerImportPreview.warnings.map((warning) => (
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
              <button
                type="button"
                className="ghost"
                onClick={() => setMapPickerOpen(true)}
              >
                {mapChoice === 'current' ? 'Current map' : mapChoice}
              </button>

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

      {mapPickerOpen && (
        <div
          className="map-picker-overlay"
          onClick={() => setMapPickerOpen(false)}
        >
          <div className="card map-picker-modal" onClick={(e) => e.stopPropagation()}>
            <p className="unit-name">Choose a map</p>
            <div className="home-tile-grid">
              <button
                type="button"
                className={`home-tile ${mapChoice === 'current' ? 'selected' : ''}`}
                onClick={() => {
                  setMapChoice('current');
                  setMapPickerOpen(false);
                }}
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
                  onClick={() => {
                    setMapChoice(m.name);
                    setMapPickerOpen(false);
                  }}
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
