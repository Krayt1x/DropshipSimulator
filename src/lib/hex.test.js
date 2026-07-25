import { describe, it, expect } from 'vitest';
import {
  generateGrid,
  tileKey,
  hexToPixel,
  boardPixelSize,
  hexDistance,
  neighborHex,
  hexDirection,
  weaponArcDirections,
  hexLine,
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

  it('finds true north/south neighbors directly above/below', () => {
    expect(neighborHex(4, 4, 0)).toEqual({ col: 4, row: 3 }); // N
    expect(neighborHex(4, 4, 3)).toEqual({ col: 4, row: 5 }); // S
  });

  it('buckets a hex into the direction it actually sits in', () => {
    const origin = { col: 4, row: 4 };
    for (let dir = 0; dir < 6; dir++) {
      const target = neighborHex(origin.col, origin.row, dir);
      expect(hexDirection(origin, target)).toBe(dir);
    }
  });

  it('splits every ring evenly across the 6 directions, with no direction stealing an extra hex from its neighbor (#98)', () => {
    const origin = { col: 7, row: 7 };
    for (let d = 1; d <= 6; d++) {
      const counts = [0, 0, 0, 0, 0, 0];
      generateGrid(15, 15)
        .filter((t) => hexDistance(origin, t) === d)
        .forEach((t) => counts[hexDirection(origin, t)]++);
      expect(counts).toEqual(Array(6).fill(d));
    }
  });

  it('gives right-mounted weapons the facing + next two clockwise directions', () => {
    expect(weaponArcDirections(0, 'right')).toEqual([0, 1, 2]);
    expect(weaponArcDirections(1, 'right')).toEqual([1, 2, 3]);
  });

  it('gives left-mounted weapons the facing + previous two directions, mirrored', () => {
    expect(weaponArcDirections(0, 'left')).toEqual([4, 5, 0]);
  });

  it('unions both arcs for "both", covering every direction but directly behind', () => {
    expect(weaponArcDirections(0, 'both').sort()).toEqual([0, 1, 2, 4, 5]);
  });

  it('walks a straight hex-by-hex line between two points, including both ends', () => {
    const path = hexLine({ col: 0, row: 0 }, { col: 3, row: 3 });
    expect(path[0]).toEqual({ col: 0, row: 0 });
    expect(path[path.length - 1]).toEqual({ col: 3, row: 3 });
    expect(path.length).toBe(
      hexDistance({ col: 0, row: 0 }, { col: 3, row: 3 }) + 1,
    );
    // each step lands on an adjacent hex
    for (let i = 1; i < path.length; i++) {
      expect(hexDistance(path[i - 1], path[i])).toBe(1);
    }
  });

  it('returns a single hex for a zero-length line', () => {
    expect(hexLine({ col: 2, row: 2 }, { col: 2, row: 2 })).toEqual([
      { col: 2, row: 2 },
    ]);
  });
});
