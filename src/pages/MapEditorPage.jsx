import { useState } from 'react';
import { useLocalStorageState, makeKey } from '../lib/storage.js';
import { backgroundContainerStyle } from '../lib/mapBackground.js';
import HexGrid from '../components/HexGrid.jsx';
import TilePalette from '../components/TilePalette.jsx';
import BackgroundPicker from '../components/BackgroundPicker.jsx';

const DEFAULT_TILE_TYPES = [{ id: 'plain', name: 'Plain', color: '#78716c' }];
const DEFAULT_DIMENSIONS = { cols: 14, rows: 10 };
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 40;

function clampDimension(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return MIN_DIMENSION;
  return Math.min(MAX_DIMENSION, Math.max(MIN_DIMENSION, n));
}

function MapEditorPage() {
  const [tileTypes, setTileTypes] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tileTypes',
    DEFAULT_TILE_TYPES,
  );
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

  function addTileType({ name, color }) {
    const id = makeKey('tile');
    setTileTypes((current) => [...current, { id, name, color }]);
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
        Build a hex battlefield by defining your own tile types and painting
        them onto the grid.
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
        <div
          className="map-editor-board"
          style={backgroundContainerStyle(background)}
        >
          <HexGrid
            cols={dimensions.cols}
            rows={dimensions.rows}
            tiles={tiles}
            tileTypes={tileTypes}
            hasBackground={Boolean(background)}
            onHexClick={handleHexClick}
          />
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
        </div>
      </div>
    </div>
  );
}

export default MapEditorPage;
