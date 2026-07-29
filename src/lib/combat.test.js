import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  parseArmor,
  rollAttackDice,
  countHits,
  calculateDamage,
} from './combat.js';

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
