import { useEffect, useState } from 'react';
import { useLocalStorageState, makeKey } from '../lib/storage.js';
import { backgroundContainerStyle } from '../lib/mapBackground.js';
import {
  DEFAULT_TERRAIN_TYPES,
  mergeDefaultTerrainTypes,
} from '../lib/terrain.js';
import HexGrid from '../components/HexGrid.jsx';
import TilePalette from '../components/TilePalette.jsx';
import BackgroundPicker from '../components/BackgroundPicker.jsx';
import MapExportPanel from '../components/MapExportPanel.jsx';

const DEFAULT_DIMENSIONS = { cols: 24, rows: 24 };
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 40;
// Must match .battle-board-viewport's width in index.css.
const BOARD_WIDTH = 1000;
// .battle-board-viewport's own padding (1rem each side) + border (1px each
// side) — subtracted so the board fits inside it without an unwanted
// horizontal scrollbar at 100% zoom.
const BOARD_PADDING = 34;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

function clampDimension(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return MIN_DIMENSION;
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, n));
}

function MapEditorPage() {
  const [tileTypes, setTileTypes] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tileTypes',
    DEFAULT_TERRAIN_TYPES,
  );
  // Restores any built-in terrain type missing from an older or edited
  // palette (#194) — see mergeDefaultTerrainTypes for why this can't just
  // live in the useLocalStorageState call above.
  useEffect(() => {
    setTileTypes((current) => mergeDefaultTerrainTypes(current));
  }, [setTileTypes]);
  const [dimensions, setDimensions] = useLocalStorageState(
    'dropshipsimulator:mapEditor:dimensions',
    DEFAULT_DIMENSIONS,
  );
  const [tiles, setTiles] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tiles',
    {},
  );
  const [background, setBackground] = useLocalStorageState(
    'dropshipsimulator:mapEditor:background',
    null,
  );
  const [selectedTool, setSelectedTool] = useState(
    tileTypes[0]?.id ?? 'eraser',
  );
  const [colsInput, setColsInput] = useState(dimensions.cols);
  const [rowsInput, setRowsInput] = useState(dimensions.rows);
  const [zoom, setZoom] = useState(1);

  const fitSize = (BOARD_WIDTH - BOARD_PADDING) / (1.5 * (dimensions.cols + 1));
  const boardSize = fitSize * zoom;

  function adjustZoom(delta) {
    setZoom((current) =>
      Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Number((current + delta).toFixed(2))),
      ),
    );
  }

  function handleHexClick(key) {
    if (!selectedTool || selectedTool === 'eraser') {
      if (!(key in tiles)) return;
      setTiles((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
      return;
    }
    setTiles((current) => ({ ...current, [key]: selectedTool }));
  }

  function addTileType({ name, color, blocksLineOfSight, blocksMovement, isObjective }) {
    const id = makeKey('tile');
    setTileTypes((current) => [
      ...current,
      { id, name, color, blocksLineOfSight, blocksMovement, isObjective },
    ]);
    setSelectedTool(id);
  }

  function removeTileType(id) {
    setTileTypes((current) => current.filter((t) => t.id !== id));
    setTiles((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        if (next[key] === id) delete next[key];
      });
      return next;
    });
    setSelectedTool((current) => (current === id ? 'eraser' : current));
  }

  function clearBoard() {
    if (Object.keys(tiles).length === 0) return;
    if (!window.confirm('Clear every placed tile from the board?')) return;
    setTiles({});
  }

  function importMap({ dimensions: newDimensions, tileTypes: newTileTypes, tiles: newTiles }) {
    setDimensions(newDimensions);
    setColsInput(newDimensions.cols);
    setRowsInput(newDimensions.rows);
    setTileTypes(newTileTypes);
    setTiles(newTiles);
    setSelectedTool(newTileTypes[0]?.id ?? 'eraser');
  }

  function applyDimensions(e) {
    e.preventDefault();
    const cols = clampDimension(colsInput);
    const rows = clampDimension(rowsInput);
    setColsInput(cols);
    setRowsInput(rows);
    setDimensions({ cols, rows });
    setTiles((current) => {
      const next = {};
      Object.entries(current).forEach(([key, value]) => {
        const [col, row] = key.split(',').map(Number);
        if (col < cols && row < rows) next[key] = value;
      });
      return next;
    });
  }

  return (
    <div className="container-wide">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Map editor</h1>
      <p className="unit-meta" style={{ marginBottom: 20 }}>
        Build a hex battlefield by defining your own terrain types and
        painting them onto the grid.
      </p>

      <form className="map-dimensions-form" onSubmit={applyDimensions}>
        <div className="field">
          <label htmlFor="cols">Columns</label>
          <input
            type="number"
            id="cols"
            min={MIN_DIMENSION}
            max={MAX_DIMENSION}
            value={colsInput}
            onChange={(e) => setColsInput(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="rows">Rows</label>
          <input
            type="number"
            id="rows"
            min={MIN_DIMENSION}
            max={MAX_DIMENSION}
            value={rowsInput}
            onChange={(e) => setRowsInput(e.target.value)}
          />
        </div>
        <button type="submit">Resize board</button>
        <button type="button" className="ghost" onClick={clearBoard}>
          Clear board
        </button>
      </form>

      <div className="map-editor-layout">
        <div className="battle-board-column">
          <div className="zoom-controls">
            <button
              type="button"
              className="ghost"
              aria-label="Zoom out"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => adjustZoom(-ZOOM_STEP)}
            >
              −
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="ghost"
              aria-label="Zoom in"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => adjustZoom(ZOOM_STEP)}
            >
              +
            </button>
          </div>
          <div
            className="battle-board-viewport"
            style={backgroundContainerStyle(background)}
          >
            <HexGrid
              cols={dimensions.cols}
              rows={dimensions.rows}
              tiles={tiles}
              tileTypes={tileTypes}
              hasBackground={Boolean(background)}
              size={boardSize}
              onHexClick={handleHexClick}
            />
          </div>
        </div>
        <div>
          <TilePalette
            tileTypes={tileTypes}
            selectedTool={selectedTool}
            onSelectTool={setSelectedTool}
            onAddTileType={addTileType}
            onRemoveTileType={removeTileType}
          />
          <BackgroundPicker background={background} onChange={setBackground} />
          <MapExportPanel
            dimensions={dimensions}
            tileTypes={tileTypes}
            tiles={tiles}
            onImport={importMap}
          />
        </div>
      </div>
    </div>
  );
}

export default MapEditorPage;
