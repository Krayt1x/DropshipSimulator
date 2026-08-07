import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  DIE_TYPES,
  DICE_COLORS,
  rollDie,
  isWordDie,
  summarizeDicePoolLine,
} from './dice.js';
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

describe('summarizeDicePoolLine (#286)', () => {
  it('groups unused dice by value in Move/Action/Attack order', () => {
    const pool = [
      { id: 1, label: 'Red', value: 'Attack', used: false },
      { id: 2, label: 'Blue', value: 'Move', used: false },
      { id: 3, label: 'Green', value: 'Move', used: false },
      { id: 4, label: 'Yellow', value: 'Action', used: false },
    ];
    expect(summarizeDicePoolLine(pool)).toBe(
      'Dice Pool: 2 Move, 1 Action, 1 Attack left unused',
    );
  });

  it('ignores used dice when summarizing', () => {
    const pool = [
      { id: 1, label: 'Red', value: 'Attack', used: true },
      { id: 2, label: 'Blue', value: 'Move', used: false },
    ];
    expect(summarizeDicePoolLine(pool)).toBe('Dice Pool: 1 Move left unused');
  });

  it('reports nothing left when every die has been used', () => {
    const pool = [{ id: 1, label: 'Red', value: 'Attack', used: true }];
    expect(summarizeDicePoolLine(pool)).toBe('Dice Pool: nothing left unused');
  });
});
