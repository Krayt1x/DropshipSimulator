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

// Buckets `target` into one of the 6 neighbor directions from `origin`,
// measuring the pixel-space angle as a multiple of 60° from direction 0's
// own angle and rounding to the nearest whole direction — used to restrict
// a weapon's range indicator to its mounted side's arc (#92).
//
// Rounding this way (rather than looping over all 6 neighbors and keeping
// whichever has the smallest angle difference) matters: a hex sitting
// exactly on the boundary between two directions is an unavoidable tie, and
// looping in a fixed 0..5 order always resolved those ties toward whichever
// direction came first, silently making direction 0's sector — and any arc
// that includes it — one hex wider than its neighbors on every ring (#98).
// Rounding a single continuous angle instead breaks every boundary tie the
// same (clockwise) way, so each direction wins exactly one boundary and
// loses the other, and every direction's sector ends up the same size.
export function hexDirection(origin, target, size = hexSize()) {
  const o = hexToPixel(origin.col, origin.row, size);
  const t = hexToPixel(target.col, target.row, size);
  const targetAngle = Math.atan2(t.y - o.y, t.x - o.x);
  const n0 = neighborHex(origin.col, origin.row, 0);
  const n0Pixel = hexToPixel(n0.col, n0.row, size);
  const dir0Angle = Math.atan2(n0Pixel.y - o.y, n0Pixel.x - o.x);
  const deltaDeg = ((targetAngle - dir0Angle) * 180) / Math.PI;
  const normalizedDeg = ((deltaDeg % 360) + 360) % 360;
  return Math.round(normalizedDeg / 60) % 6;
}

// A right-mounted weapon covers the facing direction plus the next two
// clockwise (facing, +1, +2); a left-mounted one covers the facing direction
// plus the previous two (facing, -1, -2) — both share the forward direction.
// 'both' (e.g. Artillery with Synchronized Firing Pattern, #97) unions the
// two arcs, covering every direction except directly behind.
export function weaponArcDirections(facing, side) {
  if (side === 'both') {
    const offsets = [4, 5, 0, 1, 2];
    return offsets.map((o) => (facing + o) % 6);
  }
  const offsets = side === 'right' ? [0, 1, 2] : [4, 5, 0];
  return offsets.map((o) => (facing + o) % 6);
}
