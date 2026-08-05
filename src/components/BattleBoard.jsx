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
import { hasLineOfSight } from '../lib/terrain.js';

function TokenMarker({
  token,
  unit,
  size,
  selected,
  draggable,
  onSelect,
  onDrop,
  onHover,
  peerHighlight,
  peerMoving,
  shaking,
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
      {/* A CSS transform on this same <g> would replace (not add to) the
          translate(x,y) attribute above, so the shake-on-hit animation
          (#183) lives on this inner group instead. */}
      <g className={shaking ? 'token-hit-shake' : undefined}>
        <circle
          cx={0}
          cy={0}
          r={radius}
          fill={ownerColor(token.owner)}
          stroke={selected ? '#fff' : 'rgba(0,0,0,0.35)'}
          strokeWidth={selected ? 3 : 1.5}
        />
        {peerHighlight && (
          <circle
            className={
              peerMoving
                ? 'peer-focus-ring peer-focus-ring-moving'
                : 'peer-focus-ring'
            }
            cx={0}
            cy={0}
            r={radius + 6}
            fill="none"
            stroke={peerHighlight}
            strokeWidth={2.5}
            strokeDasharray="5 4"
          />
        )}
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
    </g>
  );
}

function DeploySmoke({ position, size }) {
  const { x, y } = hexToPixel(position.col, position.row, size);
  // Token markers have radius size*0.62 and are drawn on top of this, so
  // these need to sit further out/below to actually peek out from under it
  // instead of being fully hidden behind its opaque circle. 25% larger than
  // the original puff geometry (#117).
  const s = size * 1.25;
  return (
    <g className="deploy-smoke" transform={`translate(${x},${y})`}>
      <circle
        className="deploy-smoke-puff"
        cy={s * 0.15}
        r={s * 0.55}
        fill="#a8a29e"
      />
      <circle
        className="deploy-smoke-puff"
        style={{ animationDelay: '0.08s' }}
        cx={-s * 0.55}
        cy={s * 0.4}
        r={s * 0.32}
        fill="#a8a29e"
      />
      <circle
        className="deploy-smoke-puff"
        style={{ animationDelay: '0.14s' }}
        cx={s * 0.55}
        cy={s * 0.4}
        r={s * 0.32}
        fill="#a8a29e"
      />
    </g>
  );
}

// A few "things" travel from attacker to target when a weapon fires (#183) —
// BattlePage precomputes each bolt's lane offset/delay (with a little
// randomness) and the overall length, so this just draws whatever it's
// handed. Fire-tagged weapons get flame shapes instead of the plain tracer.
function FireBolts({ effect, size }) {
  const from = hexToPixel(effect.origin.col, effect.origin.row, size);
  const to = hexToPixel(effect.target.col, effect.target.row, size);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dist = Math.hypot(dx, dy);
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const length = effect.length * size;

  return (
    <g
      className="fire-bolts"
      transform={`translate(${from.x},${from.y}) rotate(${angle})`}
    >
      {effect.bolts.map((bolt, i) => (
        // The lane offset is a plain attribute transform on this wrapper so
        // the travel animation's CSS transform (on the child below) doesn't
        // clobber it — same reasoning as TokenMarker's shake wrapper.
        <g key={i} transform={`translate(0, ${bolt.lane * size})`}>
          {effect.isFire ? (
            <g
              className="fire-bolt-flame"
              style={{
                '--travel': `${dist}px`,
                animationDelay: `${bolt.delay}ms`,
              }}
            >
              <g className="fire-flame-flicker">
                <ellipse
                  cx={length * 0.45}
                  rx={length * 0.5}
                  ry={length * 0.32}
                  fill="#dc2626"
                />
                <ellipse
                  cx={length * 0.62}
                  rx={length * 0.28}
                  ry={length * 0.17}
                  fill="#fb923c"
                />
              </g>
            </g>
          ) : (
            <rect
              className="fire-bolt-tracer"
              style={{
                '--travel': `${dist}px`,
                animationDelay: `${bolt.delay}ms`,
              }}
              x={0}
              y={-(size * 0.045)}
              width={length}
              height={size * 0.09}
              rx={size * 0.045}
            />
          )}
        </g>
      ))}
    </g>
  );
}

// Shared by both the local weapon-range highlight and the peer's (#135) —
// same "is this hex within range and arc" test, just against whichever range
// spec is passed in.
function hexInWeaponRange(range, col, row) {
  if (!range) return false;
  const d = hexDistance(range.origin, { col, row });
  if (d < range.min || d > range.max) return false;
  // The model's own tile is never a valid target of its own weapon.
  if (d === 0) return false;
  // A weapon imported without a "Left:"/"Right:" label has no known side, so
  // it falls back to the full ring.
  if (!range.side) return true;
  return isInWeaponArc(range.origin, { col, row }, range.facing, range.side);
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
  fireEffect,
  shakingTokenIds,
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
  peerSelectedTokenId,
  peerIsMoving,
  peerWeaponRange,
  peerColor,
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
      <defs>
        {/* A hex in weapon range but blocked from line of sight (#195) gets
            this hatch instead of the plain red fill, so "obstructed" reads
            at a glance rather than just looking like a dimmer version of a
            valid target. */}
        <pattern
          id="weapon-range-blocked"
          width="7"
          height="7"
          patternTransform="rotate(45)"
          patternUnits="userSpaceOnUse"
        >
          <rect width="7" height="7" fill="rgba(153,27,27,0.16)" />
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="7"
            stroke="rgba(153,27,27,0.55)"
            strokeWidth="2"
          />
        </pattern>
      </defs>
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
        const inWeaponRange = hexInWeaponRange(weaponRange, col, row);
        const inPeerWeaponRange = hexInWeaponRange(peerWeaponRange, col, row);
        const inMoveRange = Boolean(moveRange?.hexes.has(key));
        // A hex can be in range and arc but still not a valid target if
        // something blocks the sightline to it (#195) — hatched instead of
        // solid so that's visible before you even try to pick it.
        const weaponRangeBlocked =
          inWeaponRange &&
          !hasLineOfSight(weaponRange.origin, { col, row }, tiles, tileTypes);
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
                fill={
                  weaponRangeBlocked
                    ? 'url(#weapon-range-blocked)'
                    : 'rgba(220,38,38,0.4)'
                }
                style={{ pointerEvents: 'none' }}
              />
            )}
            {inPeerWeaponRange && (
              <polygon
                points={hexPointsAttr(x, y, size)}
                fill="none"
                stroke={peerColor ?? '#f59e0b'}
                strokeWidth={2}
                strokeDasharray="4 3"
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
              shaking={Boolean(shakingTokenIds?.includes(token.id))}
              onSelect={() =>
                onHexClick(`${token.position.col},${token.position.row}`)
              }
              onDrop={(col, row) => onDropToken?.(token.id, col, row)}
              onHover={onHoverToken}
              peerHighlight={
                token.id === peerSelectedTokenId
                  ? (peerColor ?? '#f59e0b')
                  : null
              }
              peerMoving={token.id === peerSelectedTokenId && peerIsMoving}
            />
          );
        })}
      {fireEffect && <FireBolts effect={fireEffect} size={size} />}
    </svg>
  );
}

export default BattleBoard;
