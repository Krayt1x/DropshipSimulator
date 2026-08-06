import { describe, it, expect } from 'vitest';
import {
  createToken,
  groupEquipmentByType,
  parseHeatRating,
  itemHasTag,
  deployedDiceByOwner,
  equippedItemsForSide,
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

  it("carries each weapon's mounted side (from a roster import) into weaponState", () => {
    const unit = { id: 1, hp: 20 };
    const token = createToken({
      unit,
      equippedIds: [5, 6],
      equippedSides: ['left', 'right'],
      owner: 'p1',
      position: null,
    });

    expect(token.weaponState[0].side).toBe('left');
    expect(token.weaponState[1].side).toBe('right');
  });

  it('carries each item\'s raw equip slot into weaponState (#245)', () => {
    const unit = { id: 1, hp: 20 };
    const token = createToken({
      unit,
      equippedIds: [5, 6, 7],
      equippedSides: ['left', 'right', undefined],
      equippedSlots: ['left', 'right', 'head'],
      owner: 'p1',
      position: null,
    });

    expect(token.weaponState[0].slot).toBe('left');
    expect(token.weaponState[1].slot).toBe('right');
    expect(token.weaponState[2].slot).toBe('head');
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

  describe('itemHasTag', () => {
    it('matches the exact machine key', () => {
      const item = { effect_stats: [{ stat: 'tags', amount: 'fire' }] };
      expect(itemHasTag(item, 'fire')).toBe(true);
      expect(itemHasTag(item, 'splash')).toBe(false);
    });

    it('ignores case and spacing so a synced human-readable label still matches', () => {
      // DropshipBuilder's live data has been observed storing the display
      // label ("Indirect Fire") as the tag value instead of the key
      // ("indirect_fire") this app's own callers use — the sync is from an
      // app this repo doesn't control, so this has to tolerate it.
      const item = {
        effect_stats: [{ stat: 'tags', amount: 'Indirect Fire' }],
      };
      expect(itemHasTag(item, 'indirect_fire')).toBe(true);
    });

    it('is false with no matching tag or no effect_stats at all', () => {
      expect(itemHasTag({ effect_stats: [] }, 'fire')).toBe(false);
      expect(itemHasTag({}, 'fire')).toBe(false);
      expect(itemHasTag(null, 'fire')).toBe(false);
    });
  });

  describe('deployedDiceByOwner', () => {
    const unit = { id: 1, dice_red: 1, dice_blue: 2, dice_green: 0 };

    it("excludes a wrecked (0 HP) model's dice, same as reserve/destroyed (#205)", () => {
      const tokens = [
        {
          owner: 'p1',
          unitId: 1,
          position: { col: 0, row: 0 },
          destroyed: false,
          currentHp: 0,
        },
        {
          owner: 'p1',
          unitId: 1,
          position: { col: 1, row: 0 },
          destroyed: false,
          currentHp: 5,
        },
      ];
      const totals = deployedDiceByOwner(tokens, [unit]);
      expect(totals.p1).toEqual({
        red: 1,
        blue: 2,
        green: 0,
        yellow: 0,
        purple: 0,
        orange: 0,
      });
    });
  });

  describe('equippedItemsForSide (#204)', () => {
    const equipment = [
      { id: 1, name: 'Long Range Bolt', hp: 5 },
      { id: 2, name: 'Flame Thrower', hp: 3 },
    ];
    const token = {
      equippedIds: [1, 2],
      weaponState: {
        0: { heat: 0, broken: false, side: 'right' },
        1: { heat: 0, broken: true, side: 'left', hp: 0 },
      },
    };

    it('lists the item equipped in the given side, with its current HP', () => {
      expect(equippedItemsForSide(token, 'right', equipment)).toEqual([
        { name: 'Long Range Bolt', hp: 5, maxHp: 5, broken: false },
      ]);
    });

    it('reports a broken item and its reduced HP', () => {
      expect(equippedItemsForSide(token, 'left', equipment)).toEqual([
        { name: 'Flame Thrower', hp: 0, maxHp: 3, broken: true },
      ]);
    });

    it('returns nothing for front/rear, which have no slot equipment', () => {
      expect(equippedItemsForSide(token, 'front', equipment)).toEqual([]);
      expect(equippedItemsForSide(token, 'rear', equipment)).toEqual([]);
    });

    it('returns nothing for a token with no equipment', () => {
      expect(equippedItemsForSide(null, 'right', equipment)).toEqual([]);
    });
  });
});
