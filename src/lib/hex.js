// Pointy-top hexes laid out in an "odd-r" offset grid (odd rows shifted
// right by half a hex width) — a common layout for rectangular hex boards.

export function hexSize() {
  return 32;
}

export function oddRToPixel(col, row, size = hexSize()) {
  const width = Math.sqrt(3) * size;
  const x = width * (col + 0.5 * (row & 1)) + width / 2;
  const y = size * 1.5 * row + size;
  return { x, y };
}

export function hexCorners(centerX, centerY, size = hexSize()) {
  const corners = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i - 30;
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
  const width = Math.sqrt(3) * size;
  return {
    width: width * cols + width,
    height: size * 1.5 * rows + size * 1.5,
  };
}
