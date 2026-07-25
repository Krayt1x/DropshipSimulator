const TILES = [
  {
    href: '#map',
    icon: '🗺️',
    title: 'Map editor',
    description: 'Build a hex battlefield with your own tile types.',
  },
  {
    href: '#battle',
    icon: '⚔️',
    title: 'Battle board',
    description: 'Deploy units, track HP and heat, and play out a match.',
  },
  {
    href: '#connect',
    icon: '🔗',
    title: 'Multiplayer',
    description: 'Connect two browsers so a match stays in sync live.',
  },
];

function HomePage() {
  return (
    <div className="container home-container">
      <h1 style={{ textAlign: 'center' }}>Dropship Simulator</h1>
      <p className="unit-meta" style={{ textAlign: 'center', marginBottom: 24 }}>
        A game-state manager for the Dropship tabletop wargame.
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

export default HomePage;
