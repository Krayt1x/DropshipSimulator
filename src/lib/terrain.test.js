import { describe, it, expect } from 'vitest';
import {
  DEFAULT_TERRAIN_TYPES,
  hasLineOfSight,
  isMovementPathBlocked,
  objectiveHexesFrom,
  mergeDefaultTerrainTypes,
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

describe('mergeDefaultTerrainTypes', () => {
  it('adds back a built-in missing from an older or edited palette (#194)', () => {
    const stale = DEFAULT_TERRAIN_TYPES.filter((t) => t.id !== 'objective');
    const merged = mergeDefaultTerrainTypes(stale);
    expect(merged.find((t) => t.id === 'objective')).toEqual(
      DEFAULT_TERRAIN_TYPES.find((t) => t.id === 'objective'),
    );
    expect(merged).toHaveLength(DEFAULT_TERRAIN_TYPES.length);
  });

  it('leaves the list untouched when nothing is missing', () => {
    expect(mergeDefaultTerrainTypes(DEFAULT_TERRAIN_TYPES)).toBe(
      DEFAULT_TERRAIN_TYPES,
    );
  });

  it('preserves a custom terrain type and a user edit to an existing built-in', () => {
    const edited = DEFAULT_TERRAIN_TYPES.map((t) =>
      t.id === 'water' ? { ...t, color: '#000000' } : t,
    );
    const withCustom = [
      ...edited,
      { id: 'rubble', name: 'Rubble', color: '#888', blocksMovement: false },
    ];
    const merged = mergeDefaultTerrainTypes(withCustom);
    expect(merged.find((t) => t.id === 'water').color).toBe('#000000');
    expect(merged.find((t) => t.id === 'rubble')).toBeDefined();
    expect(merged).toHaveLength(DEFAULT_TERRAIN_TYPES.length + 1);
  });

  it('rebuilds the full default set from a completely empty palette', () => {
    expect(mergeDefaultTerrainTypes([])).toEqual(DEFAULT_TERRAIN_TYPES);
  });
});

describe('DEFAULT_TERRAIN_TYPES objective entry (#194)', () => {
  it('blocks both line of sight and movement, in addition to granting VP', () => {
    const objective = DEFAULT_TERRAIN_TYPES.find((t) => t.id === 'objective');
    expect(objective.blocksLineOfSight).toBe(true);
    expect(objective.blocksMovement).toBe(true);
    expect(objective.isObjective).toBe(true);
  });
});
