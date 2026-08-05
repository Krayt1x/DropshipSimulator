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
  const [blocksLineOfSight, setBlocksLineOfSight] = useState(false);
  const [blocksMovement, setBlocksMovement] = useState(false);
  const [isObjective, setIsObjective] = useState(false);

  function handleAdd(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onAddTileType({
      name: trimmed,
      color,
      blocksLineOfSight,
      blocksMovement,
      isObjective,
    });
    setName('');
    setBlocksLineOfSight(false);
    setBlocksMovement(false);
    setIsObjective(false);
  }

  return (
    <div className="card tile-palette">
      <p className="unit-name">Terrain types</p>
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
              {(type.blocksMovement ||
                type.blocksLineOfSight ||
                type.isObjective) && (
                // Hidden from the accessible name (#215) so
                // getByRole('button', { name: 'Forest' })-style queries
                // (and screen readers, which already hear the type name)
                // aren't affected by which pills happen to be showing.
                <span className="terrain-flag-pills" aria-hidden="true">
                  {type.blocksMovement && (
                    <span className="terrain-flag-pill">Blocks movement</span>
                  )}
                  {type.blocksLineOfSight && (
                    <span className="terrain-flag-pill">Blocks LOS</span>
                  )}
                  {type.isObjective && (
                    <span className="terrain-flag-pill terrain-flag-pill-objective">
                      Objective
                    </span>
                  )}
                </span>
              )}
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
          <p className="empty">No terrain types yet — add one below.</p>
        )}
      </div>

      <form className="tile-palette-form" onSubmit={handleAdd}>
        <div className="field">
          <label htmlFor="tile-type-name">New terrain type</label>
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
        <label className="tile-type-checkbox">
          <input
            type="checkbox"
            checked={blocksLineOfSight}
            onChange={(e) => setBlocksLineOfSight(e.target.checked)}
          />
          Blocks line of sight
        </label>
        <label className="tile-type-checkbox">
          <input
            type="checkbox"
            checked={blocksMovement}
            onChange={(e) => setBlocksMovement(e.target.checked)}
          />
          Blocks movement
        </label>
        <label className="tile-type-checkbox">
          <input
            type="checkbox"
            checked={isObjective}
            onChange={(e) => setIsObjective(e.target.checked)}
          />
          Objective (grants victory points)
        </label>
        <button type="submit">Add terrain type</button>
      </form>
    </div>
  );
}

export default TilePalette;
