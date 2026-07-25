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

// Buckets `target` into one of the 6 neighbor directions from `origin` by
// snapping the pixel-space angle between them to whichever neighbor cell's
// own angle is closest — used to restrict a weapon's range indicator to its
// mounted side's arc (#92).
export function hexDirection(origin, target, size = hexSize()) {
  const o = hexToPixel(origin.col, origin.row, size);
  const t = hexToPixel(target.col, target.row, size);
  const angle = Math.atan2(t.y - o.y, t.x - o.x);
  let best = 0;
  let bestDiff = Infinity;
  for (let dir = 0; dir < 6; dir++) {
    const n = neighborHex(origin.col, origin.row, dir);
    const np = hexToPixel(n.col, n.row, size);
    const nAngle = Math.atan2(np.y - o.y, np.x - o.x);
    let diff = Math.abs(nAngle - angle);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    if (diff < bestDiff) {
      bestDiff = diff;
      best = dir;
    }
  }
  return best;
}

// A right-mounted weapon covers the facing direction plus the next two
// clockwise (facing, +1, +2); a left-mounted one covers the facing direction
// plus the previous two (facing, -1, -2) — both share the forward direction.
export function weaponArcDirections(facing, side) {
  const offsets = side === 'right' ? [0, 1, 2] : [4, 5, 0];
  return offsets.map((o) => (facing + o) % 6);
}
