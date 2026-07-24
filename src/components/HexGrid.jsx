import {
  boardPixelSize,
  generateGrid,
  hexPointsAttr,
  hexSize,
  oddRToPixel,
} from '../lib/hex.js';

function HexGrid({ cols, rows, tiles, tileTypes, onHexClick }) {
  const size = hexSize();
  const { width, height } = boardPixelSize(cols, rows, size);
  const hexes = generateGrid(cols, rows);

  function colorFor(key) {
    const typeId = tiles[key];
    const type = tileTypes.find((t) => t.id === typeId);
    return type?.color ?? null;
  }

  return (
    <svg
      className="hex-grid"
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="group"
      aria-label="Hex grid"
    >
      {hexes.map(({ col, row, key }) => {
        const { x, y } = oddRToPixel(col, row, size);
        const fill = colorFor(key);
        return (
          <polygon
            key={key}
            data-testid={`hex-${key}`}
            points={hexPointsAttr(x, y, size)}
            className={`hex-tile ${fill ? '' : 'hex-tile-empty'}`}
            style={fill ? { fill } : undefined}
            onClick={() => onHexClick(key)}
          >
            <title>{`${col}, ${row}`}</title>
          </polygon>
        );
      })}
    </svg>
  );
}

export default HexGrid;
