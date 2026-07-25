import { describe, it, expect } from 'vitest';
import {
  generateGrid,
  tileKey,
  hexToPixel,
  boardPixelSize,
  hexDistance,
  rowBoundaryY,
  rowBoundaryPolyline,
} from './hex.js';

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

  it('offsets odd columns vertically relative to even columns', () => {
    const evenCol = hexToPixel(0, 0, 10);
    const oddCol = hexToPixel(1, 0, 10);
    expect(oddCol.y).toBeGreaterThan(evenCol.y);
  });

  it('moves straight across columns at the same row height for even columns', () => {
    const a = hexToPixel(0, 3, 10);
    const b = hexToPixel(2, 3, 10);
    expect(a.y).toBe(b.y);
    expect(b.x).toBeGreaterThan(a.x);
  });

  it('grows the board pixel size with more columns and rows', () => {
    const small = boardPixelSize(2, 2, 10);
    const large = boardPixelSize(4, 4, 10);
    expect(large.width).toBeGreaterThan(small.width);
    expect(large.height).toBeGreaterThan(small.height);
  });

  it('reports zero distance from a hex to itself', () => {
    expect(hexDistance({ col: 3, row: 3 }, { col: 3, row: 3 })).toBe(0);
  });

  it('gives adjacent hexes a distance of 1', () => {
    // true north/south neighbors on a flat-top grid
    expect(hexDistance({ col: 2, row: 2 }, { col: 2, row: 1 })).toBe(1);
    expect(hexDistance({ col: 2, row: 2 }, { col: 2, row: 3 })).toBe(1);
    // diagonal neighbor via an odd column
    expect(hexDistance({ col: 2, row: 2 }, { col: 3, row: 2 })).toBe(1);
  });

  it('is symmetric', () => {
    const a = { col: 1, row: 1 };
    const b = { col: 5, row: 4 };
    expect(hexDistance(a, b)).toBe(hexDistance(b, a));
  });

  it('places a row boundary between the two rows it separates', () => {
    const rowTwoCenter = hexToPixel(0, 2, 10).y;
    const rowThreeCenter = hexToPixel(0, 3, 10).y;
    const boundary = rowBoundaryY(2, 10);
    expect(boundary).toBeGreaterThan(rowTwoCenter);
    expect(boundary).toBeLessThan(rowThreeCenter);
  });

  it('builds one boundary point per column for the zigzag polyline', () => {
    const points = rowBoundaryPolyline(5, 2, 10);
    expect(points).toHaveLength(5);
    // x coordinates should be strictly increasing across columns
    for (let i = 1; i < points.length; i++) {
      expect(points[i][0]).toBeGreaterThan(points[i - 1][0]);
    }
  });
});
