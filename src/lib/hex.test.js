import { describe, it, expect } from 'vitest';
import { generateGrid, tileKey, oddRToPixel, boardPixelSize } from './hex.js';

describe('hex', () => {
  it('generates a full rectangular grid of col/row tiles', () => {
    const tiles = generateGrid(3, 2);
    expect(tiles).toHaveLength(6);
    expect(tiles).toContainEqual({ col: 0, row: 0, key: '0,0' });
    expect(tiles).toContainEqual({ col: 2, row: 1, key: '2,1' });
  });

  it('builds a stable key from col/row', () => {
    expect(tileKey(4, 7)).toBe('4,7');
  });

  it('offsets odd rows horizontally relative to even rows', () => {
    const evenRow = oddRToPixel(0, 0, 10);
    const oddRow = oddRToPixel(0, 1, 10);
    expect(oddRow.x).toBeGreaterThan(evenRow.x);
  });

  it('grows the board pixel size with more columns and rows', () => {
    const small = boardPixelSize(2, 2, 10);
    const large = boardPixelSize(4, 4, 10);
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.height).toBeGreaterThan(small.height);
  });
});
