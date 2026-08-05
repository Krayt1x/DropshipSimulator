import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  parseArmor,
  rollAttackDice,
  countHits,
  calculateDamage,
  armorPlateBonus,
  effectiveSideArmor,
} from './combat.js';

const ARMOR_PLATE = {
  id: 16,
  name: 'Armor Plate',
  type: 'Weapon',
  effect_stats: [{ stat: 'tags', amount: 'armor_plate' }],
};
const equipment = [ARMOR_PLATE, { id: 99, name: 'Long Range Bolt', type: 'Weapon' }];

function makeToken({ equippedIds, weaponState }) {
  return { equippedIds, weaponState };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('parseArmor', () => {
  it('splits a front/left/right/rear armor string in that order', () => {
    expect(parseArmor('2/2/2/1')).toEqual({
      front: 2,
      left: 2,
      right: 2,
      rear: 1,
    });
  });

  it('returns null for a malformed armor string', () => {
    expect(parseArmor('2/2/2')).toBeNull();
    expect(parseArmor('')).toBeNull();
    expect(parseArmor(undefined)).toBeNull();
  });
});

describe('rollAttackDice', () => {
  it('rolls the stated count of dice at the stated die size', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = rollAttackDice('3d6');
    expect(result).toEqual({ rolls: [1, 1, 1], sides: 6 });
  });

  it('returns null for hit dice that are not a simple NdM', () => {
    expect(rollAttackDice('')).toBeNull();
    expect(rollAttackDice('special')).toBeNull();
  });
});

describe('countHits', () => {
  it('counts rolls at or under the target number as hits', () => {
    expect(countHits([1, 4, 5, 8], 4)).toBe(2);
    expect(countHits([5, 6, 7], 4)).toBe(0);
  });
});

describe('calculateDamage', () => {
  it('multiplies (die size - armor) by the number of hits', () => {
    expect(calculateDamage(8, 2, 2)).toBe(12);
  });

  it('floors at 0 damage when armor meets or beats the die size', () => {
    expect(calculateDamage(6, 6, 3)).toBe(0);
    expect(calculateDamage(6, 9, 3)).toBe(0);
  });

  it('is 0 with no hits regardless of armor', () => {
    expect(calculateDamage(8, 0, 0)).toBe(0);
  });
});

describe('armorPlateBonus (#203)', () => {
  it('adds +1 to whichever side a Left/Right-slotted plate protects', () => {
    const token = makeToken({
      equippedIds: [16],
      weaponState: { 0: { broken: false, side: 'left' } },
    });
    expect(armorPlateBonus(token, 'left', equipment)).toBe(1);
    expect(armorPlateBonus(token, 'right', equipment)).toBe(0);
    expect(armorPlateBonus(token, 'front', equipment)).toBe(0);
  });

  it('adds +1 to both front and rear for a Head-slotted plate (no side recorded)', () => {
    const token = makeToken({
      equippedIds: [16],
      weaponState: { 0: { broken: false, side: undefined } },
    });
    expect(armorPlateBonus(token, 'front', equipment)).toBe(1);
    expect(armorPlateBonus(token, 'rear', equipment)).toBe(1);
    expect(armorPlateBonus(token, 'left', equipment)).toBe(0);
  });

  it('grants no bonus once broken', () => {
    const token = makeToken({
      equippedIds: [16],
      weaponState: { 0: { broken: true, side: 'left' } },
    });
    expect(armorPlateBonus(token, 'left', equipment)).toBe(0);
  });

  it('stacks multiple unbroken plates on the same side', () => {
    const token = makeToken({
      equippedIds: [16, 16],
      weaponState: {
        0: { broken: false, side: 'right' },
        1: { broken: false, side: 'right' },
      },
    });
    expect(armorPlateBonus(token, 'right', equipment)).toBe(2);
  });

  it('ignores equipment without the armor_plate tag', () => {
    const token = makeToken({
      equippedIds: [99],
      weaponState: { 0: { broken: false, side: 'left' } },
    });
    expect(armorPlateBonus(token, 'left', equipment)).toBe(0);
  });
});

describe('effectiveSideArmor (#203)', () => {
  it('adds the plate bonus on top of the unit’s base armor', () => {
    const unit = { armor: '2/2/2/1' };
    const token = makeToken({
      equippedIds: [16],
      weaponState: { 0: { broken: false, side: 'left' } },
    });
    expect(effectiveSideArmor(token, unit, 'left', equipment)).toBe(3);
    expect(effectiveSideArmor(token, unit, 'right', equipment)).toBe(2);
  });
});
