import {
  boardPixelSize,
  generateGrid,
  hexPointsAttr,
  hexSize,
  hexToPixel,
} from '../lib/hex.js';

function HexGrid({
  cols,
  rows,
  tiles,
  tileTypes,
  hasBackground,
  size: sizeProp,
  onHexClick,
}) {
  const size = sizeProp ?? hexSize();
  const { width, height } = boardPixelSize(cols, rows, size);
  const hexes = generateGrid(cols, rows);

  function tileTypeFor(key) {
    return tileTypes.find((t) => t.id === tiles[key]);
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
        const { x, y } = hexToPixel(col, row, size);
        const type = tileTypeFor(key);
        const fill = type?.color ?? null;
        return (
          <polygon
            key={key}
            data-testid={`hex-${key}`}
            points={hexPointsAttr(x, y, size)}
            className={`hex-tile ${fill ? '' : 'hex-tile-empty'}`}
            style={
              fill
                ? { fill }
                : hasBackground
                  ? { fill: 'transparent' }
                  : undefined
            }
            onClick={() => onHexClick(key)}
          >
            <title>{`${col}, ${row}${type ? ` — ${type.name}` : ''}`}</title>
          </polygon>
        );
      })}
    </svg>
  );
}

export default HexGrid;
