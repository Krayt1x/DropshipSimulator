import {
  boardPixelSize,
  generateGrid,
  hexDistance,
  hexPointsAttr,
  hexSize,
  hexToPixel,
  rowBoundaryPolyline,
  rowBoundaryY,
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

function DeploymentZones({ cols, width, height, deploymentZones, size }) {
  if (!deploymentZones) return null;
  const { topBoundaryRow, bottomBoundaryRow, style } = deploymentZones;

  if (style === 'shaded') {
    const topY = rowBoundaryY(topBoundaryRow, size);
    const bottomY = rowBoundaryY(bottomBoundaryRow, size);
    return (
      <g style={{ pointerEvents: 'none' }}>
        <rect x={0} y={0} width={width} height={topY} fill="rgba(37,99,235,0.12)" />
        <rect
          x={0}
          y={bottomY}
          width={width}
          height={Math.max(0, height - bottomY)}
          fill="rgba(220,38,38,0.12)"
        />
      </g>
    );
  }

  if (style === 'zigzag') {
    const topPoints = rowBoundaryPolyline(cols, topBoundaryRow, size);
    const bottomPoints = rowBoundaryPolyline(cols, bottomBoundaryRow, size);
    const toAttr = (pts) => pts.map(([x, y]) => `${x},${y}`).join(' ');
    return (
      <g style={{ pointerEvents: 'none' }}>
        <polyline
          points={toAttr(topPoints)}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
        />
        <polyline
          points={toAttr(bottomPoints)}
          fill="none"
          stroke="#dc2626"
          strokeWidth={2}
        />
      </g>
    );
  }

  // 'line' (default): straight dashed line approximation
  const topY = rowBoundaryY(topBoundaryRow, size);
  const bottomY = rowBoundaryY(bottomBoundaryRow, size);
  return (
    <g style={{ pointerEvents: 'none' }}>
      <line
        x1={0}
        y1={topY}
        x2={width}
        y2={topY}
        stroke="#2563eb"
        strokeWidth={2}
        strokeDasharray="8 6"
      />
      <line
        x1={0}
        y1={bottomY}
        x2={width}
        y2={bottomY}
        stroke="#dc2626"
        strokeWidth={2}
        strokeDasharray="8 6"
      />
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
        return (
          <g key={key}>
            <polygon
              data-testid={`hex-${key}`}
              points={hexPointsAttr(x, y, size)}
              className={`hex-tile ${fill ? '' : 'hex-tile-empty'}`}
              style={fill ? { fill } : undefined}
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
      <DeploymentZones
        cols={cols}
        width={width}
        height={height + 16}
        deploymentZones={deploymentZones}
        size={size}
      />
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
