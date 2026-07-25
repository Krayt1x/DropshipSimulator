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
