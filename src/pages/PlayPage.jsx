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
  return (
    <div className="container home-container">
      <h1 style={{ textAlign: 'center' }}>Play</h1>
      <p
        className="unit-meta"
        style={{ textAlign: 'center', marginBottom: 24 }}
      >
        Choose how you want to play.
      </p>
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
