import { describe, it, expect } from 'vitest';
import {
  createToken,
  groupEquipmentByType,
  parseHeatRating,
} from './tokens.js';

describe('tokens', () => {
  it('creates a token with full HP and zeroed weapon heat', () => {
    const unit = { id: 1, hp: 20 };
    const token = createToken({
      unit,
      equippedIds: [5, 6],
      owner: 'p1',
      position: { col: 2, row: 3 },
    });

    expect(token.currentHp).toBe(20);
    expect(token.position).toEqual({ col: 2, row: 3 });
    expect(token.facing).toBe(3);
    expect(token.weaponState).toEqual({
      0: { heat: 0, broken: false },
      1: { heat: 0, broken: false },
    });
  });

  it('tracks heat separately for two of the same weapon', () => {
    const unit = { id: 1, hp: 20 };
    const token = createToken({
      unit,
      equippedIds: [7, 7],
      owner: 'p1',
      position: null,
    });

    expect(token.weaponState).toEqual({
      0: { heat: 0, broken: false },
      1: { heat: 0, broken: false },
    });
  });

  it('defaults facing toward the opposing side for each owner', () => {
    const unit = { id: 1, hp: 20 };
    const p1Token = createToken({
      unit,
      equippedIds: [],
      owner: 'p1',
      position: null,
    });
    const p2Token = createToken({
      unit,
      equippedIds: [],
      owner: 'p2',
      position: null,
    });

    expect(p1Token.facing).toBe(3);
    expect(p2Token.facing).toBe(0);
  });

  it('groups equipment by type', () => {
    const items = [
      { id: 1, type: 'Weapon' },
      { id: 2, type: 'Movement' },
      { id: 3, type: 'Weapon' },
    ];
    expect(groupEquipmentByType(items)).toEqual({
      Weapon: [items[0], items[2]],
      Movement: [items[1]],
    });
  });

  it('parses a heat rating string into generate/max', () => {
    expect(parseHeatRating('2/4')).toEqual({ generate: 2, max: 4 });
    expect(parseHeatRating('')).toEqual({ generate: 0, max: 0 });
  });
});
