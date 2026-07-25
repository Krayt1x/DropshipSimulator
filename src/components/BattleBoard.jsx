import {
  boardPixelSize,
  generateGrid,
  hexDistance,
  hexPointsAttr,
  hexSize,
  hexToPixel,
} from '../lib/hex.js';
import { ownerColor } from '../lib/tokens.js';

function healthBarColor(fraction) {
  if (fraction <= 0.25) return '#dc2626';
  if (fraction <= 0.5) return '#f59e0b';
  return '#22c55e';
}

function TokenMarker({ token, unit, size, selected }) {
  const { x, y } = hexToPixel(token.position.col, token.position.row, size);
  const radius = size * 0.62;
  const angle = token.facing * 60 - 90;
  const initials = (unit?.name ?? '?').slice(0, 4);
  const maxHp = Number(unit?.hp) || 1;
  const hpFraction = Math.max(0, Math.min(1, token.currentHp / maxHp));
  const barWidth = radius * 1.8;
  const barY = y + radius + 3;

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
      <rect
        x={x - barWidth / 2}
        y={barY}
        width={barWidth}
        height={4}
        rx={2}
        fill="rgba(0,0,0,0.25)"
      />
      <rect
        x={x - barWidth / 2}
        y={barY}
        width={barWidth * hpFraction}
        height={4}
        rx={2}
        fill={healthBarColor(hpFraction)}
      />
      <text
        x={x}
        y={y + radius + 20}
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
  rangeOrigin,
  deploymentZones,
  hasBackground,
  onHexClick,
  onDropToken,
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
        const { x, y } = hexToPixel(col, row, size);
        const fill = colorFor(key);
        const distance = rangeOrigin ? hexDistance(rangeOrigin, { col, row }) : null;
        const tileTint = deploymentZones
          ? row <= deploymentZones.topBoundaryRow
            ? 'rgba(37,99,235,0.35)'
            : row > deploymentZones.bottomBoundaryRow
              ? 'rgba(220,38,38,0.35)'
              : null
          : null;
        return (
          <g key={key}>
            <polygon
              data-testid={`hex-${key}`}
              points={hexPointsAttr(x, y, size)}
              className={`hex-tile ${fill ? '' : 'hex-tile-empty'}`}
              style={fill ? { fill } : hasBackground ? { fill: 'transparent' } : undefined}
              onClick={() => onHexClick(key)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const tokenId = e.dataTransfer.getData('text/plain');
                if (tokenId) onDropToken?.(tokenId, col, row);
              }}
            >
              <title>{`${col}, ${row}`}</title>
            </polygon>
            {tileTint && (
              <polygon
                points={hexPointsAttr(x, y, size)}
                fill={tileTint}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {distance !== null && distance > 0 && (
              <text
                x={x}
                y={y + size * 0.12}
                textAnchor="middle"
                fontSize={size * 0.32}
                fill="var(--text-secondary)"
                style={{ pointerEvents: 'none' }}
              >
                {distance}
              </text>
            )}
          </g>
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
