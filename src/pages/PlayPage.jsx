import { useState } from 'react';
import { useLocalStorageState } from '../lib/storage.js';
import { resetActiveGame } from '../lib/gameState.js';

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
  // A fresh game only — resuming one already in progress (the "Resume Game"
  // banner below) skips this, since that game's mode was already decided
  // when it started.
  const [step, setStep] = useState(null); // null | 'mode' | 'difficulty'

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
    window.location.hash = '#battle';
  }

  function chooseDifficulty(difficulty) {
    setGameMode('vs-computer');
    setBotDifficulty(difficulty);
    // The human always plays Player 1 against the bot, so canControl/canRoll
    // (BattlePage.jsx) restrict them to their own seat the same way hotseat
    // multiplayer identity already does.
    setMyPlayer('p1');
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
            <button type="button" className="ghost" onClick={() => setStep(null)}>
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
            <button type="button" className="ghost" onClick={() => setStep(null)}>
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
          </div>
        </div>
      )}
    </div>
  );
}

export default PlayPage;
