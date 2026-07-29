import {
  boardPixelSize,
  generateGrid,
  hexDistance,
  hexPointsAttr,
  hexSize,
  hexToPixel,
  isInWeaponArc,
} from '../lib/hex.js';
import { healthBarColor, ownerColor } from '../lib/tokens.js';

function TokenMarker({
  token,
  unit,
  size,
  selected,
  draggable,
  onSelect,
  onDrop,
  onHover,
}) {
  const { x, y } = hexToPixel(token.position.col, token.position.row, size);
  const radius = size * 0.62;
  // facing 0 = North; the flat-top grid's neighbor directions sit every 60°
  // from there, so no extra offset is needed (see tokens.js).
  const angle = token.facing * 60;
  const initials = (unit?.name ?? '?').slice(0, 4);
  const maxHp = Number(unit?.hp) || 1;
  const hpFraction = Math.max(0, Math.min(1, token.currentHp / maxHp));
  const barWidth = radius * 1.8;
  const barY = radius + 3;

  // SVG elements don't support native HTML5 drag-and-drop, so movement is
  // driven by pointer capture + hit-testing the release point instead.
  function handlePointerDown(e) {
    if (!draggable) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
  }

  function handlePointerUp(e) {
    if (!draggable) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    const hexEl = target?.closest?.('[data-testid^="hex-"]');
    if (!hexEl) return;
    const [col, row] = hexEl
      .getAttribute('data-testid')
      .slice(4)
      .split(',')
      .map(Number);
    onDrop?.(col, row);
  }

  return (
    <g
      data-testid={`token-${token.id}`}
      className="token-marker"
      transform={`translate(${x},${y})`}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onClick={onSelect}
      onMouseEnter={(e) => onHover?.(token.id, e.clientX, e.clientY)}
      onMouseMove={(e) => onHover?.(token.id, e.clientX, e.clientY)}
      onMouseLeave={() => onHover?.(null)}
      style={{
        cursor: draggable ? 'grab' : 'default',
        touchAction: 'none',
      }}
    >
      <circle
        cx={0}
        cy={0}
        r={radius}
        fill={ownerColor(token.owner)}
        stroke={selected ? '#fff' : 'rgba(0,0,0,0.35)'}
        strokeWidth={selected ? 3 : 1.5}
      />
      <polygon
        points="0,-8 6,4 -6,4"
        fill="#fff"
        transform={`rotate(${angle}) translate(0,${-radius})`}
      />
      <text
        x={0}
        y={2}
        textAnchor="middle"
        fontSize={size * 0.32}
        fontWeight="700"
        fill="#fff"
      >
        {initials}
      </text>
      <rect
        x={-barWidth / 2}
        y={barY}
        width={barWidth}
        height={4}
        rx={2}
        fill="rgba(0,0,0,0.25)"
      />
      <rect
        x={-barWidth / 2}
        y={barY}
        width={barWidth * hpFraction}
        height={4}
        rx={2}
        fill={healthBarColor(hpFraction)}
      />
      <text
        x={0}
        y={radius + 20}
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

function DeploySmoke({ position, size }) {
  const { x, y } = hexToPixel(position.col, position.row, size);
  // Token markers have radius size*0.62 and are drawn on top of this, so
  // these need to sit further out/below to actually peek out from under it
  // instead of being fully hidden behind its opaque circle.
  return (
    <g className="deploy-smoke" transform={`translate(${x},${y})`}>
      <circle
        className="deploy-smoke-puff"
        cy={size * 0.15}
        r={size * 0.55}
        fill="#a8a29e"
      />
      <circle
        className="deploy-smoke-puff"
        style={{ animationDelay: '0.08s' }}
        cx={-size * 0.55}
        cy={size * 0.4}
        r={size * 0.32}
        fill="#a8a29e"
      />
      <circle
        className="deploy-smoke-puff"
        style={{ animationDelay: '0.14s' }}
        cx={size * 0.55}
        cy={size * 0.4}
        r={size * 0.32}
        fill="#a8a29e"
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
  animatingToken,
  deployEffect,
  selectedTokenId,
  rangeOrigin,
  weaponRange,
  moveRange,
  deploymentZones,
  hasBackground,
  size: sizeProp,
  canControl,
  onHexClick,
  onDropToken,
  onHoverToken,
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
      viewBox={`0 0 ${width} ${height + 16}`}
      width={width}
      height={height + 16}
      role="group"
      aria-label="Battle board"
    >
      {hexes.map(({ col, row, key }) => {
        const { x, y } = hexToPixel(col, row, size);
        const type = tileTypeFor(key);
        const fill = type?.color ?? null;
        const distance = rangeOrigin
          ? hexDistance(rangeOrigin, { col, row })
          : null;
        const tileTint = deploymentZones
          ? row <= deploymentZones.topBoundaryRow
            ? 'rgba(37,99,235,0.35)'
            : row > deploymentZones.bottomBoundaryRow
              ? 'rgba(220,38,38,0.35)'
              : null
          : null;
        const inWeaponRange =
          weaponRange &&
          (() => {
            const d = hexDistance(weaponRange.origin, { col, row });
            if (d < weaponRange.min || d > weaponRange.max) return false;
            // The model's own tile is never a valid target of its own weapon.
            if (d === 0) return false;
            // A weapon imported without a "Left:"/"Right:" label has no
            // known side, so it falls back to the full ring.
            if (!weaponRange.side) return true;
            return isInWeaponArc(
              weaponRange.origin,
              { col, row },
              weaponRange.facing,
              weaponRange.side,
            );
          })();
        const inMoveRange =
          moveRange &&
          hexDistance(moveRange.origin, { col, row }) <= moveRange.max;
        return (
          <g key={key}>
            <polygon
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
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const tokenId = e.dataTransfer.getData('text/plain');
                if (tokenId) onDropToken?.(tokenId, col, row);
              }}
            >
              <title>{`${col}, ${row}${type ? ` — ${type.name}` : ''}`}</title>
            </polygon>
            {tileTint && (
              <polygon
                points={hexPointsAttr(x, y, size)}
                fill={tileTint}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {inMoveRange && (
              <polygon
                points={hexPointsAttr(x, y, size)}
                fill="rgba(34,197,94,0.18)"
                style={{ pointerEvents: 'none' }}
              />
            )}
            {inWeaponRange && (
              <polygon
                points={hexPointsAttr(x, y, size)}
                fill="rgba(220,38,38,0.4)"
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
      {deployEffect && (
        <DeploySmoke position={deployEffect.position} size={size} />
      )}
      {tokens
        .filter((token) => token.position)
        .map((token) => {
          const renderToken =
            animatingToken?.tokenId === token.id
              ? { ...token, position: animatingToken.position }
              : token;
          return (
            <TokenMarker
              key={token.id}
              token={renderToken}
              unit={units.find((u) => Number(u.id) === Number(token.unitId))}
              size={size}
              selected={token.id === selectedTokenId}
              draggable={canControl ? canControl(token) : true}
              onSelect={() =>
                onHexClick(`${token.position.col},${token.position.row}`)
              }
              onDrop={(col, row) => onDropToken?.(token.id, col, row)}
              onHover={onHoverToken}
            />
          );
        })}
    </svg>
  );
}

export default BattleBoard;
