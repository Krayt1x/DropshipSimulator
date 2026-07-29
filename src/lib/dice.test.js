import { describe, it, expect, vi, afterEach } from 'vitest';
import { DIE_TYPES, DICE_COLORS, rollDie, isWordDie } from './dice.js';
import actionDice from '../data/actionDice.json';

afterEach(() => vi.restoreAllMocks());

describe('colored action dice (#114)', () => {
  it("builds a die type for every color in DropshipBuilder's actionDice.json", () => {
    DICE_COLORS.forEach((color) => {
      const dieType = DIE_TYPES.find((d) => d.id === color);
      const entry = actionDice.find((d) => d.color === color);
      expect(dieType).toBeDefined();
      expect(dieType.faces).toEqual([
        entry.side1,
        entry.side2,
        entry.side3,
        entry.side4,
        entry.side5,
        entry.side6,
      ]);
    });
  });

  it('rolls a colored die to one of its synced faces', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.999999);
    const blue = DIE_TYPES.find((d) => d.id === 'blue');
    expect(rollDie(blue)).toBe(blue.faces[5]);
  });

  it('treats every colored die as a word die', () => {
    DICE_COLORS.forEach((color) => {
      const dieType = DIE_TYPES.find((d) => d.id === color);
      expect(isWordDie(dieType.label)).toBe(true);
    });
  });
});
