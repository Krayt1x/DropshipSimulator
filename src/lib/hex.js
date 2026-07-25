// Flat-top hexes laid out in an "odd-q" offset grid (odd columns shifted
// down by half a hex height). Flat-top gives true North/South neighbors
// (and diagonal East/West), so models can face straight up or down.

export function hexSize() {
  return 32;
}

export function hexToPixel(col, row, size = hexSize()) {
  const height = Math.sqrt(3) * size;
  const x = size * 1.5 * col + size;
  const y = height * (row + 0.5 * (col & 1)) + height / 2;
  return { x, y };
}

export function hexCorners(centerX, centerY, size = hexSize()) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push([
      centerX + size * Math.cos(angleRad),
      centerY + size * Math.sin(angleRad),
    ]);
  }
  return corners;
}

export function hexPointsAttr(centerX, centerY, size = hexSize()) {
  return hexCorners(centerX, centerY, size)
    .map(([x, y]) => `${x},${y}`)
    .join(' ');
}

export function tileKey(col, row) {
  return `${col},${row}`;
}

export function generateGrid(cols, rows) {
  const tiles = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      tiles.push({ col, row, key: tileKey(col, row) });
    }
  }
  return tiles;
}

export function boardPixelSize(cols, rows, size = hexSize()) {
  const height = Math.sqrt(3) * size;
  return {
    width: size * 1.5 * cols + size * 1.5,
    height: height * rows + height,
  };
}

export function offsetToAxial(col, row) {
  const q = col;
  const r = row - (col - (col & 1)) / 2;
  return { q, r };
}

export function axialToOffset(q, r) {
  const col = q;
  const row = r + (col - (col & 1)) / 2;
  return { col, row };
}

function cubeRound(q, r) {
  const s = -q - r;
  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);
  const qDiff = Math.abs(rq - q);
  const rDiff = Math.abs(rr - r);
  const sDiff = Math.abs(rs - s);
  if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
  else if (rDiff > sDiff) rr = -rq - rs;
  return { q: rq, r: rr };
}

// The sequence of hexes a token crosses moving from `a` to `b` in a straight
// line, including both endpoints — used to step a moving token through each
// hex it passes rather than jumping straight to the destination (#93).
export function hexLine(a, b) {
  const A = offsetToAxial(a.col, a.row);
  const B = offsetToAxial(b.col, b.row);
  const n = hexDistance(a, b);
  const steps = [];
  for (let i = 0; i <= n; i++) {
    const t = n === 0 ? 0 : i / n;
    const { q, r } = cubeRound(A.q + (B.q - A.q) * t, A.r + (B.r - A.r) * t);
    steps.push(axialToOffset(q, r));
  }
  return steps;
}

export function hexDistance(a, b) {
  const A = offsetToAxial(a.col, a.row);
  const B = offsetToAxial(b.col, b.row);
  return (
    (Math.abs(A.q - B.q) +
      Math.abs(A.q + A.r - B.q - B.r) +
      Math.abs(A.r - B.r)) /
    2
  );
}

// Neighbor offsets for the flat-top "odd-q" grid, indexed 0=N,1=NE,2=SE,
// 3=S,4=SW,5=NW clockwise from North — matching the facing convention used
// throughout (see tokens.js's DEFAULT_FACING_BY_OWNER comment).
const ODD_Q_NEIGHBORS = [
  [0, -1],
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
];
const EVEN_Q_NEIGHBORS = [
  [0, -1],
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [-1, -1],
];

export function neighborHex(col, row, dir) {
  const table = col & 1 ? ODD_Q_NEIGHBORS : EVEN_Q_NEIGHBORS;
  const [dc, dr] = table[((dir % 6) + 6) % 6];
  return { col: col + dc, row: row + dr };
}

function directionAngleDeg(origin, dir, size) {
  const o = hexToPixel(origin.col, origin.row, size);
  const n = neighborHex(origin.col, origin.row, dir);
  const np = hexToPixel(n.col, n.row, size);
  return (Math.atan2(np.y - o.y, np.x - o.x) * 180) / Math.PI;
}

// Normalizes a degree value to (-180, 180].
function normalizeAngle(deg) {
  let d = deg % 360;
  if (d <= -180) d += 360;
  if (d > 180) d -= 360;
  return d;
}

// A right-mounted weapon covers the facing direction plus the next two
// clockwise (a 180° wedge); a left-mounted one covers facing plus the
// previous two — both share the forward direction. 'both' (e.g. Artillery
// with Synchronized Firing Pattern, #97) unions the two arcs, covering
// every direction except directly behind.
//
// This measures `target`'s angle from `origin` directly against the arc's
// boundary angles rather than bucketing it into a single nearest direction
// first (as an earlier version did) — a hex sitting exactly on an arc's
// boundary is equally close to the excluded direction on the other side of
// that boundary, so bucketing it into a direction and then checking that
// direction's arc membership always silently grabbed those boundary hexes
// for whichever side happened to win the tie, making that arc one hex too
// wide right where it meets its excluded neighbor (#98, #101). Checking the
// angle against the arc's own span directly and excluding both boundaries
// outright means a boundary hex belongs to neither adjacent arc, which is
// the least-wrong answer for a hex that's genuinely ambiguous.
const EPSILON_DEG = 1e-6;
export function isInWeaponArc(origin, target, facing, side, size = hexSize()) {
  const o = hexToPixel(origin.col, origin.row, size);
  const t = hexToPixel(target.col, target.row, size);
  const targetAngle = (Math.atan2(t.y - o.y, t.x - o.x) * 180) / Math.PI;
  const facingAngle = directionAngleDeg(origin, facing, size);
  const rel = normalizeAngle(targetAngle - facingAngle);
  if (side === 'right')
    return rel > -30 + EPSILON_DEG && rel < 150 - EPSILON_DEG;
  if (side === 'left')
    return rel > -150 + EPSILON_DEG && rel < 30 - EPSILON_DEG;
  if (side === 'both')
    return rel > -150 + EPSILON_DEG && rel < 150 - EPSILON_DEG;
  return true;
}
