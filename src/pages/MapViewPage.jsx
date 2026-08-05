import { useState } from 'react';
import { useLocalStorageState } from '../lib/storage.js';
import { DEFAULT_MAPS, DEFAULT_MAP_DIMENSIONS } from '../lib/maps.js';
import { DEFAULT_TERRAIN_TYPES } from '../lib/terrain.js';
import MapThumbnail from '../components/MapThumbnail.jsx';

// The Map Editor's landing page (#218): just two tiles, "Pre-made maps" and
// "Map creator" (#223) — picking a pre-made layout opens a modal (same
// overlay style as PlayPage's own map picker, #222) rather than listing every
// map inline, and loading one from it stays on this page instead of jumping
// into the Creator, so you can look before you commit to editing it.
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
  const [lastLoadedMapName, setLastLoadedMapName] = useLocalStorageState(
    'dropshipsimulator:mapEditor:lastLoadedMapName',
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  function loadMap(map) {
    setDimensions(map.dimensions);
    setTileTypes(map.tileTypes);
    setTiles(map.tiles);
    setLastLoadedMapName(map.name);
    setPickerOpen(false);
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
      <div className="home-tile-grid">
        <button
          type="button"
          className="home-tile"
          onClick={() => setPickerOpen(true)}
        >
          <span className="home-tile-icon">🗺️</span>
          <span className="home-tile-title">Pre-made maps</span>
          <span className="home-tile-description">
            Browse ready-made battlefield layouts.
          </span>
        </button>
        <a className="home-tile" href="#map/edit">
          <span className="home-tile-icon">✏️</span>
          <span className="home-tile-title">Map creator</span>
          <span className="home-tile-description">
            {lastLoadedMapName
              ? `Currently: ${lastLoadedMapName}`
              : 'Build a hex battlefield with your own terrain types.'}
          </span>
        </a>
      </div>

      {pickerOpen && (
        <div
          className="map-picker-overlay"
          onClick={() => setPickerOpen(false)}
        >
          <div
            className="card map-picker-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="unit-name">Choose a map</p>
            <div className="home-tile-grid two-col-mobile-grid">
              {DEFAULT_MAPS.map((map) => (
                <button
                  key={map.name}
                  type="button"
                  className="home-tile"
                  onClick={() => loadMap(map)}
                >
                  <MapThumbnail
                    dimensions={map.dimensions}
                    tileTypes={map.tileTypes}
                    tiles={map.tiles}
                  />
                  <span className="home-tile-title">{map.name}</span>
                  <span className="home-tile-description">
                    {map.dimensions.cols} × {map.dimensions.rows}
                  </span>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="ghost"
              style={{ marginTop: 16 }}
              onClick={() => setPickerOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default MapViewPage;
