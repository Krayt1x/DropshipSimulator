import { useState } from 'react';
import { useLocalStorageState } from '../lib/storage.js';
import { resetActiveGame } from '../lib/gameState.js';
import { parseRosterExport } from '../lib/rosterImport.js';
import { DEFAULT_ROSTERS } from '../components/RosterImport.jsx';
import { DEFAULT_MAPS, parseMapExport } from '../lib/maps.js';
import manufacturers from '../data/manufacturers.json';
import units from '../data/units.json';
import equipment from '../data/equipment.json';

function PlayPage() {
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
  // when it started.
  const [step, setStep] = useState(null); // null | 'mode' | 'difficulty' | 'roster' | 'map'
  const [rosterChoice, setRosterChoice] = useState(null); // null | 'specific' | 'import'
  const [specificRosterName, setSpecificRosterName] = useState(
    DEFAULT_ROSTERS[0]?.name ?? '',
  );
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState(null);
  const [mapChoice, setMapChoice] = useState('current'); // 'current' | 'blank' | 'import'
  const [mapImportText, setMapImportText] = useState('');
  const [mapImportPreview, setMapImportPreview] = useState(null);

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

  function chooseSandbox() {
    setGameMode('sandbox');
    setStep('map');
  }

  function chooseDifficulty(difficulty) {
    setGameMode('vs-computer');
    setBotDifficulty(difficulty);
    // The human always plays Player 1 against the bot, so canControl/canRoll
    // (BattlePage.jsx) restrict them to their own seat the same way hotseat
    // multiplayer identity already does.
    setMyPlayer('p1');
    setStep('roster');
  }

  function startBattleWith(botRoster) {
    setBotRoster(botRoster);
    setStep('map');
  }

  function previewImport() {
    setImportPreview(
      parseRosterExport(importText, { units, manufacturers, equipment }),
    );
  }

  function previewMapImport() {
    setMapImportPreview(parseMapExport(mapImportText));
  }

  function confirmStartGame() {
    if (mapChoice === 'blank') {
      const blank = DEFAULT_MAPS.find((m) => m.name === 'Blank');
      setMapDimensions(blank.dimensions);
      setMapTileTypes(blank.tileTypes);
      setMapTiles(blank.tiles);
    } else if (mapChoice === 'import' && mapImportPreview) {
      setMapDimensions(mapImportPreview.dimensions);
      setMapTileTypes(mapImportPreview.tileTypes);
      setMapTiles(mapImportPreview.tiles);
    }
    // 'current' leaves whatever's already saved in the Map Editor alone.
    window.location.hash = '#battle';
  }

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
            onClick={() => setStep('mode')}
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

      {step === 'mode' && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="reserve-header">
            <p className="unit-name">How do you want to play?</p>
            <button
              type="button"
              className="ghost"
              onClick={() => setStep(null)}
            >
              Cancel
            </button>
          </div>
          <div className="token-owner-row" style={{ marginTop: 8 }}>
            <button type="button" onClick={chooseSandbox}>
              Sandbox
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => setStep('difficulty')}
            >
              vs Computer
            </button>
          </div>
        </div>
      )}

      {step === 'difficulty' && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="reserve-header">
            <p className="unit-name">Choose a difficulty</p>
            <button
              type="button"
              className="ghost"
              onClick={() => setStep(null)}
            >
              Cancel
            </button>
          </div>
          <div className="token-owner-row" style={{ marginTop: 8 }}>
            <button type="button" onClick={() => chooseDifficulty('simple')}>
              Simple
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => chooseDifficulty('tactical')}
            >
              Tactical
            </button>
            <button
              type="button"
              className="ghost"
              onClick={() => chooseDifficulty('expert')}
            >
              Expert
            </button>
          </div>
        </div>
      )}

      {step === 'roster' && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="reserve-header">
            <p className="unit-name">Which list should the computer play?</p>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setStep(null);
                setRosterChoice(null);
                setImportText('');
                setImportPreview(null);
              }}
            >
              Cancel
            </button>
          </div>
          <div className="token-owner-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              onClick={() => startBattleWith({ type: 'random' })}
            >
              Random
            </button>
            <button
              type="button"
              className={`ghost ${rosterChoice === 'specific' ? 'active' : ''}`}
              onClick={() => setRosterChoice('specific')}
            >
              Specific
            </button>
          </div>

          {rosterChoice === 'specific' && (
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="bot-roster-select">List</label>
              <select
                id="bot-roster-select"
                value={
                  specificRosterName === '__import__'
                    ? '__import__'
                    : specificRosterName
                }
                onChange={(e) => setSpecificRosterName(e.target.value)}
              >
                {DEFAULT_ROSTERS.map((roster) => (
                  <option key={roster.name} value={roster.name}>
                    {roster.name}
                  </option>
                ))}
                <option value="__import__">Import…</option>
              </select>

              {specificRosterName === '__import__' ? (
                <div style={{ marginTop: 10 }}>
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
                        startBattleWith({ type: 'import', text: importText })
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
              ) : (
                <button
                  type="button"
                  style={{ marginTop: 10 }}
                  onClick={() =>
                    startBattleWith({
                      type: 'specific',
                      name: specificRosterName,
                    })
                  }
                >
                  Use this list
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {step === 'map' && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="reserve-header">
            <p className="unit-name">Which map do you want to play?</p>
            <button
              type="button"
              className="ghost"
              onClick={() => {
                setStep(null);
                setMapChoice('current');
                setMapImportText('');
                setMapImportPreview(null);
              }}
            >
              Cancel
            </button>
          </div>
          <div className="token-owner-row" style={{ marginTop: 8 }}>
            <button
              type="button"
              className={`ghost ${mapChoice === 'current' ? 'active' : ''}`}
              onClick={() => setMapChoice('current')}
            >
              Current map
            </button>
            <button
              type="button"
              className={`ghost ${mapChoice === 'blank' ? 'active' : ''}`}
              onClick={() => setMapChoice('blank')}
            >
              Blank
            </button>
            <button
              type="button"
              className={`ghost ${mapChoice === 'import' ? 'active' : ''}`}
              onClick={() => setMapChoice('import')}
            >
              Import…
            </button>
          </div>

          {mapChoice === 'import' && (
            <div className="field" style={{ marginTop: 12 }}>
              <label htmlFor="map-import-text">Map export</label>
              <textarea
                id="map-import-text"
                rows={6}
                placeholder="Paste an exported map here"
                value={mapImportText}
                onChange={(e) => {
                  setMapImportText(e.target.value);
                  setMapImportPreview(null);
                }}
              />
              <div className="token-owner-row" style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="ghost"
                  disabled={!mapImportText.trim()}
                  onClick={previewMapImport}
                >
                  Preview import
                </button>
              </div>
              {mapImportPreview && (
                <p className="unit-meta" style={{ marginTop: 8 }}>
                  {mapImportPreview.dimensions.cols} ×{' '}
                  {mapImportPreview.dimensions.rows},{' '}
                  {Object.keys(mapImportPreview.tiles).length} tile
                  {Object.keys(mapImportPreview.tiles).length === 1
                    ? ''
                    : 's'}{' '}
                  painted.
                </p>
              )}
              {mapImportText.trim() && !mapImportPreview && (
                <p className="unit-meta" style={{ marginTop: 8 }}>
                  Preview it to check it&apos;s a valid map export.
                </p>
              )}
            </div>
          )}

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              marginTop: 16,
            }}
          >
            <button
              type="button"
              disabled={mapChoice === 'import' && !mapImportPreview}
              onClick={confirmStartGame}
            >
              Start Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayPage;
