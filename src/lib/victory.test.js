import { describe, it, expect } from 'vitest';
import { computeObjectiveVp } from './victory.js';
import { DEFAULT_TERRAIN_TYPES } from './terrain.js';

const terrainTypes = DEFAULT_TERRAIN_TYPES;

function token(id, owner, position) {
  return { id, owner, position, destroyed: false };
}

describe('computeObjectiveVp', () => {
  it('awards 0 with no objective tiles on the map', () => {
    const tiles = {};
    const tokens = [token('a', 'p1', { col: 0, row: 0 })];
    expect(
      computeObjectiveVp({ tokens, tiles, terrainTypes, owner: 'p1' }),
    ).toBe(0);
  });

  it('awards 1 VP per own model adjacent to an uncontested objective', () => {
    const tiles = { '0,1': 'objective' };
    const tokens = [
      token('a', 'p1', { col: 0, row: 0 }), // adjacent to the objective
      token('b', 'p1', { col: 10, row: 10 }), // nowhere near it
    ];
    expect(
      computeObjectiveVp({ tokens, tiles, terrainTypes, owner: 'p1' }),
    ).toBe(1);
  });

  it('does not award a point when an enemy is adjacent to the scoring model', () => {
    const tiles = { '0,1': 'objective' };
    const tokens = [
      token('a', 'p1', { col: 0, row: 0 }),
      token('e', 'p2', { col: 1, row: 0 }), // adjacent to 'a'
    ];
    expect(
      computeObjectiveVp({ tokens, tiles, terrainTypes, owner: 'p1' }),
    ).toBe(0);
  });

  it('does not award a point when an enemy is adjacent to the same objective', () => {
    const tiles = { '0,2': 'objective' };
    const tokens = [
      token('a', 'p1', { col: 0, row: 1 }), // adjacent to the objective
      token('e', 'p2', { col: 0, row: 3 }), // also adjacent to the objective
    ];
    expect(
      computeObjectiveVp({ tokens, tiles, terrainTypes, owner: 'p1' }),
    ).toBe(0);
  });

  it('never scores a model more than once even with several uncontested objectives nearby', () => {
    const tiles = { '0,1': 'objective', '1,0': 'objective' };
    const tokens = [token('a', 'p1', { col: 0, row: 0 })];
    expect(
      computeObjectiveVp({ tokens, tiles, terrainTypes, owner: 'p1' }),
    ).toBe(1);
  });
});
