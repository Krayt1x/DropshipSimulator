import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TERRAIN_TYPES,
  hasLineOfSight,
  isMovementPathBlocked,
  objectiveHexesFrom,
} from './terrain.js';

const terrainTypes = DEFAULT_TERRAIN_TYPES;

describe('hasLineOfSight', () => {
  it('is true with nothing in between', () => {
    expect(
      hasLineOfSight({ col: 0, row: 0 }, { col: 0, row: 4 }, {}, terrainTypes),
    ).toBe(true);
  });

  it('is false when a building sits strictly between attacker and target', () => {
    const tiles = { '0,2': 'buildings' };
    expect(
      hasLineOfSight(
        { col: 0, row: 0 },
        { col: 0, row: 4 },
        tiles,
        terrainTypes,
      ),
    ).toBe(false);
  });

  it('forest also blocks line of sight', () => {
    const tiles = { '0,2': 'forest' };
    expect(
      hasLineOfSight(
        { col: 0, row: 0 },
        { col: 0, row: 4 },
        tiles,
        terrainTypes,
      ),
    ).toBe(false);
  });

  it('water does not block line of sight', () => {
    const tiles = { '0,2': 'water' };
    expect(
      hasLineOfSight(
        { col: 0, row: 0 },
        { col: 0, row: 4 },
        tiles,
        terrainTypes,
      ),
    ).toBe(true);
  });

  it('a blocking tile under the attacker or target themselves does not count', () => {
    const tiles = { '0,0': 'buildings', '0,4': 'buildings' };
    expect(
      hasLineOfSight(
        { col: 0, row: 0 },
        { col: 0, row: 4 },
        tiles,
        terrainTypes,
      ),
    ).toBe(true);
  });
});

describe('isMovementPathBlocked', () => {
  it('is false with nothing in the way', () => {
    expect(
      isMovementPathBlocked(
        { col: 0, row: 0 },
        { col: 0, row: 4 },
        {},
        terrainTypes,
      ),
    ).toBe(false);
  });

  it('is true when water sits on the destination', () => {
    const tiles = { '0,4': 'water' };
    expect(
      isMovementPathBlocked(
        { col: 0, row: 0 },
        { col: 0, row: 4 },
        tiles,
        terrainTypes,
      ),
    ).toBe(true);
  });

  it('is true when water sits along the path, not just the destination', () => {
    const tiles = { '0,2': 'water' };
    expect(
      isMovementPathBlocked(
        { col: 0, row: 0 },
        { col: 0, row: 4 },
        tiles,
        terrainTypes,
      ),
    ).toBe(true);
  });

  it('forest does not block movement', () => {
    const tiles = { '0,2': 'forest' };
    expect(
      isMovementPathBlocked(
        { col: 0, row: 0 },
        { col: 0, row: 4 },
        tiles,
        terrainTypes,
      ),
    ).toBe(false);
  });

  it('buildings block movement', () => {
    const tiles = { '0,2': 'buildings' };
    expect(
      isMovementPathBlocked(
        { col: 0, row: 0 },
        { col: 0, row: 4 },
        tiles,
        terrainTypes,
      ),
    ).toBe(true);
  });

  it('a blocking tile under the origin does not count, since you start there', () => {
    const tiles = { '0,0': 'water' };
    expect(
      isMovementPathBlocked(
        { col: 0, row: 0 },
        { col: 0, row: 4 },
        tiles,
        terrainTypes,
      ),
    ).toBe(false);
  });
});

describe('objectiveHexesFrom', () => {
  it('finds every hex painted with an objective terrain type', () => {
    const tiles = { '1,1': 'objective', '2,2': 'plain', '3,3': 'objective' };
    const hexes = objectiveHexesFrom(tiles, terrainTypes);
    expect(hexes).toHaveLength(2);
    expect(hexes).toContainEqual({ col: 1, row: 1 });
    expect(hexes).toContainEqual({ col: 3, row: 3 });
  });

  it('returns an empty array when there are no objective tiles', () => {
    expect(objectiveHexesFrom({ '1,1': 'plain' }, terrainTypes)).toEqual([]);
  });
});
