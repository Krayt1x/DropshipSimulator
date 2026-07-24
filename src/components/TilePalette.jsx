import { useState } from 'react';

const DEFAULT_COLOR = '#65a30d';

function TilePalette({
  tileTypes,
  selectedTool,
  onSelectTool,
  onAddTileType,
  onRemoveTileType,
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(DEFAULT_COLOR);

  function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddTileType({ name: trimmed, color });
    setName('');
  }

  return (
    <div className="card tile-palette">
      <p className="unit-name">Tile types</p>
      <div className="tile-palette-list">
        <button
          type="button"
          className={`tile-swatch-btn ${selectedTool === 'eraser' ? 'selected' : ''}`}
          onClick={() => onSelectTool('eraser')}
        >
          <span className="tile-swatch tile-swatch-eraser" />
          Eraser
        </button>
        {tileTypes.map((type) => (
          <div className="tile-swatch-row" key={type.id}>
            <button
              type="button"
              className={`tile-swatch-btn ${selectedTool === type.id ? 'selected' : ''}`}
              onClick={() => onSelectTool(type.id)}
            >
              <span
                className="tile-swatch"
                style={{ background: type.color }}
              />
              {type.name}
            </button>
            <button
              type="button"
              className="ghost tile-swatch-remove"
              aria-label={`Remove ${type.name}`}
              onClick={() => onRemoveTileType(type.id)}
            >
              ✕
            </button>
          </div>
        ))}
        {tileTypes.length === 0 && (
          <p className="empty">No tile types yet — add one below.</p>
        )}
      </div>

      <form className="tile-palette-form" onSubmit={handleAdd}>
        <div className="field">
          <label htmlFor="tile-type-name">New tile type</label>
          <input
            type="text"
            id="tile-type-name"
            placeholder="e.g. Rubble"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="tile-type-color">Color</label>
          <input
            type="color"
            id="tile-type-color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <button type="submit">Add tile type</button>
      </form>
    </div>
  );
}

export default TilePalette;
