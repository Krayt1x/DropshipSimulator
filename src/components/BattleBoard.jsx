import {
  boardPixelSize,
  generateGrid,
  hexPointsAttr,
  hexSize,
  oddRToPixel,
} from '../lib/hex.js';
import { ownerColor } from '../lib/tokens.js';

function TokenMarker({ token, unit, size, selected }) {
  const { x, y } = oddRToPixel(token.position.col, token.position.row, size);
  const radius = size * 0.62;
  const angle = token.facing * 60 - 90;
  const initials = (unit?.name ?? '?').slice(0, 4);

  return (
    <g style={{ pointerEvents: 'none' }}>
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={ownerColor(token.owner)}
        stroke={selected ? '#fff' : 'rgba(0,0,0,0.35)'}
        strokeWidth={selected ? 3 : 1.5}
      />
      <polygon
        points="0,-8 6,4 -6,4"
        fill="#fff"
        transform={`translate(${x},${y}) rotate(${angle}) translate(0,${-radius})`}
      />
      <text
        x={x}
        y={y + 2}
        textAnchor="middle"
        fontSize={size * 0.32}
        fontWeight="700"
        fill="#fff"
      >
        {initials}
      </text>
      <text
        x={x}
        y={y + radius + 12}
        textAnchor="middle"
        fontSize={size * 0.28}
        fontWeight="600"
        fill={token.currentHp <= 0 ? '#dc2626' : 'var(--text-primary)'}
      >
        {token.currentHp}/{unit?.hp ?? '?'}
      </text>
    </g>
  );
}

function BattleBoard({
  cols,
  rows,
  tiles,
  tileTypes,
  tokens,
  units,
  selectedTokenId,
  onHexClick,
}) {
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
      viewBox={`0 0 ${width} ${height + 16}`}
      width={width}
      height={height + 16}
      role="group"
      aria-label="Battle board"
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
      {tokens
        .filter((token) => token.position)
        .map((token) => (
          <TokenMarker
            key={token.id}
            token={token}
            unit={units.find((u) => Number(u.id) === Number(token.unitId))}
            size={size}
            selected={token.id === selectedTokenId}
          />
        ))}
    </svg>
  );
}

export default BattleBoard;
