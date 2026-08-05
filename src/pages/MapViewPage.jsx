import { useLocalStorageState } from '../lib/storage.js';
import { DEFAULT_MAPS, DEFAULT_MAP_DIMENSIONS } from '../lib/maps.js';
import { DEFAULT_TERRAIN_TYPES } from '../lib/terrain.js';

// The Map Editor's landing page (#218): browse pre-made layouts (just
// "Blank" today, room for more later) or jump straight into building a
// custom one. Picking a layout loads it into the same localStorage keys
// MapEditorPage itself reads/writes, mirroring how PlayPage's own
// mapChoice === 'blank' branch already loads a default map before battle.
function MapViewPage() {
  const [, setDimensions] = useLocalStorageState(
    'dropshipsimulator:mapEditor:dimensions',
    DEFAULT_MAP_DIMENSIONS,
  );
  const [, setTileTypes] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tileTypes',
    DEFAULT_TERRAIN_TYPES,
  );
  const [, setTiles] = useLocalStorageState('dropshipsimulator:mapEditor:tiles', {});

  function loadMap(map) {
    setDimensions(map.dimensions);
    setTileTypes(map.tileTypes);
    setTiles(map.tiles);
  }

  return (
    <div className="container home-container">
      <h1 style={{ textAlign: 'center' }}>Map editor</h1>
      <p
        className="unit-meta"
        style={{ textAlign: 'center', marginBottom: 24 }}
      >
        Pick a pre-made layout, or build your own from scratch.
      </p>
      <h2 style={{ fontSize: 15 }}>Pre-made maps</h2>
      <div className="home-tile-grid">
        {DEFAULT_MAPS.map((map) => (
          <a
            key={map.name}
            className="home-tile"
            href="#map/edit"
            onClick={() => loadMap(map)}
          >
            <span className="home-tile-icon">🗺️</span>
            <span className="home-tile-title">{map.name}</span>
            <span className="home-tile-description">
              {map.dimensions.cols} × {map.dimensions.rows}
            </span>
          </a>
        ))}
      </div>

      <h2 style={{ fontSize: 15, marginTop: 24 }}>Map creator</h2>
      <div className="home-tile-grid">
        <a className="home-tile" href="#map/edit">
          <span className="home-tile-icon">✏️</span>
          <span className="home-tile-title">Create your own</span>
          <span className="home-tile-description">
            Build a hex battlefield with your own terrain types.
          </span>
        </a>
      </div>
    </div>
  );
}

export default MapViewPage;
