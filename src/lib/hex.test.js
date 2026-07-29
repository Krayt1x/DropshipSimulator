import { describe, it, expect } from 'vitest';
import {
  generateGrid,
  tileKey,
  hexToPixel,
  boardPixelSize,
  hexDistance,
  neighborHex,
  isInWeaponArc,
  hexLine,
  nearestSide,
  visibleSides,
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

  it('puts the direct neighbor in the direction facing right (and not its opposite)', () => {
    const origin = { col: 4, row: 4 };
    const north = neighborHex(origin.col, origin.row, 0);
    expect(isInWeaponArc(origin, north, 0, 'right')).toBe(true);
    expect(isInWeaponArc(origin, north, 3, 'right')).toBe(false);
  });

  it('excludes a hex sitting exactly on the shared boundary from both arcs it borders (#101)', () => {
    // Regression case: facing North from (6,5), hexes (3,0)/(4,2)/(5,3) sit
    // exactly on the boundary between the facing direction and its
    // counter-clockwise neighbor — previously bucketed into a single
    // direction first, which silently claimed them for whichever side won
    // that tie. They're ambiguous, so neither the right arc (which the tie
    // used to leak into) should claim them...
    const origin = { col: 6, row: 5 };
    ['3,0', '4,2', '5,3'].forEach((s) => {
      const [col, row] = s.split(',').map(Number);
      expect(isInWeaponArc(origin, { col, row }, 0, 'right')).toBe(false);
    });
  });

  it('gives right and left arcs mirror-symmetric coverage on every ring', () => {
    const origin = { col: 7, row: 7 };
    for (let facing = 0; facing < 6; facing++) {
      for (let d = 1; d <= 6; d++) {
        const ring = generateGrid(15, 15).filter(
          (t) => hexDistance(origin, t) === d,
        );
        const rightCount = ring.filter((t) =>
          isInWeaponArc(origin, t, facing, 'right'),
        ).length;
        const leftCount = ring.filter((t) =>
          isInWeaponArc(origin, t, facing, 'left'),
        ).length;
        expect(rightCount).toBe(leftCount);
      }
    }
  });

  it('unions both arcs for "both", excluding only hexes directly behind', () => {
    const origin = { col: 7, row: 7 };
    const behind = neighborHex(origin.col, origin.row, 3);
    expect(isInWeaponArc(origin, behind, 0, 'both')).toBe(false);
    [0, 1, 2, 4, 5].forEach((dir) => {
      const target = neighborHex(origin.col, origin.row, dir);
      expect(isInWeaponArc(origin, target, 0, 'both')).toBe(true);
    });
  });

  describe('nearestSide (#123, #126)', () => {
    const target = { col: 6, row: 6 };
    const facing = 0;

    it('picks front/rear for the hex directly ahead/behind the facing', () => {
      expect(
        nearestSide(target, facing, neighborHex(target.col, target.row, 0)),
      ).toBe('front');
      expect(
        nearestSide(target, facing, neighborHex(target.col, target.row, 3)),
      ).toBe('rear');
    });

    it('picks right/left for hexes on those sides regardless of exact angle', () => {
      [1, 2].forEach((dir) => {
        expect(
          nearestSide(target, facing, neighborHex(target.col, target.row, dir)),
        ).toBe('right');
      });
      [4, 5].forEach((dir) => {
        expect(
          nearestSide(target, facing, neighborHex(target.col, target.row, dir)),
        ).toBe('left');
      });
    });

    it('is symmetric under a 180° facing flip', () => {
      const from = neighborHex(target.col, target.row, 1);
      const side = nearestSide(target, 0, from);
      const opposite = nearestSide(target, 3, from);
      expect([side, opposite].sort()).toEqual(['left', 'right']);
    });
  });

  describe('visibleSides (#126)', () => {
    const target = { col: 6, row: 6 };
    const facing = 0;

    it('always includes the nearest side', () => {
      [0, 1, 2, 3, 4, 5].forEach((dir) => {
        const from = neighborHex(target.col, target.row, dir);
        const sides = visibleSides(target, facing, from);
        expect(sides).toContain(nearestSide(target, facing, from));
      });
    });

    it('returns exactly 2 distinct sides for every direction', () => {
      [0, 1, 2, 3, 4, 5].forEach((dir) => {
        const from = neighborHex(target.col, target.row, dir);
        const sides = visibleSides(target, facing, from);
        expect(sides).toHaveLength(2);
        expect(new Set(sides).size).toBe(2);
      });
    });

    it('leans toward whichever neighbor is angularly closer within the nearest quadrant', () => {
      // dir 1 sits nearer the front/right boundary than the right/rear one.
      const leansFront = visibleSides(
        target,
        facing,
        neighborHex(target.col, target.row, 1),
      );
      expect(leansFront).toEqual(['right', 'front']);

      // dir 2 sits nearer the right/rear boundary than the front/right one.
      const leansRear = visibleSides(
        target,
        facing,
        neighborHex(target.col, target.row, 2),
      );
      expect(leansRear).toEqual(['right', 'rear']);
    });

    it('never includes the side directly opposite the nearest one', () => {
      [0, 1, 2, 3, 4, 5].forEach((dir) => {
        const from = neighborHex(target.col, target.row, dir);
        const sides = visibleSides(target, facing, from);
        const opposite = {
          front: 'rear',
          rear: 'front',
          left: 'right',
          right: 'left',
        };
        expect(sides).not.toContain(opposite[sides[0]]);
      });
    });
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
