import { describe, it, expect } from 'vitest';
import { matchesSlotType } from './rosterEntry.js';

describe('matchesSlotType (#203)', () => {
  it('matches an item whose own type equals the required type', () => {
    expect(matchesSlotType({ type: 'Weapon' }, 'Weapon')).toBe(true);
    expect(matchesSlotType({ type: 'Augment' }, 'Augment')).toBe(true);
    expect(matchesSlotType({ type: 'Weapon' }, 'Augment')).toBe(false);
  });

  it('lets an armor_plate-tagged Weapon into the Head slot too', () => {
    const armorPlate = {
      type: 'Weapon',
      effect_stats: [{ stat: 'tags', amount: 'armor_plate' }],
    };
    expect(matchesSlotType(armorPlate, 'Weapon')).toBe(true);
    expect(matchesSlotType(armorPlate, 'Augment')).toBe(true);
    expect(matchesSlotType(armorPlate, 'Movement')).toBe(false);
  });

  it('does not extend the Head exception to an untagged Weapon', () => {
    expect(matchesSlotType({ type: 'Weapon' }, 'Augment')).toBe(false);
  });
});
