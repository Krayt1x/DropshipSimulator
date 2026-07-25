import { useLocalStorageState } from '../lib/storage.js';
import { resetActiveGame } from '../lib/gameState.js';

const TILES = [
  {
    href: '#battle',
    icon: '🧍',
    title: 'Single Player',
    description: 'Play locally on one device — no connection needed.',
  },
  {
    href: '#connect',
    icon: '🔗',
    title: 'Multiplayer',
    description: 'Connect two browsers so a match stays in sync live.',
  },
];

function PlayPage() {
  const [tokens] = useLocalStorageState('dropshipsimulator:battle:tokens', []);
  const hasActiveGame = tokens.length > 0;

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
        {TILES.map((tile) => (
          <a className="home-tile" key={tile.href} href={tile.href}>
            <span className="home-tile-icon">{tile.icon}</span>
            <span className="home-tile-title">{tile.title}</span>
            <span className="home-tile-description">{tile.description}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export default PlayPage;
