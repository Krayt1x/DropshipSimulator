import { describe, it, expect } from 'vitest';
import { directionFromD6, resolveDropPod } from './dropPod.js';

describe('directionFromD6', () => {
  it('maps 1 to North (top) and 4 to South (bottom), clockwise between', () => {
    expect(directionFromD6(1)).toBe(0);
    expect(directionFromD6(2)).toBe(1);
    expect(directionFromD6(3)).toBe(2);
    expect(directionFromD6(4)).toBe(3);
    expect(directionFromD6(5)).toBe(4);
    expect(directionFromD6(6)).toBe(5);
  });
});

describe('resolveDropPod', () => {
  it('lands (d4Roll - 1) hexes away in the d6Roll direction when the path is empty (#163)', () => {
    const result = resolveDropPod({
      aim: { col: 5, row: 5 },
      d4Roll: 2,
      d6Roll: 1, // North
      dimensions: { cols: 20, rows: 20 },
      findTokenAt: () => null,
    });
    expect(result.hex).toEqual({ col: 5, row: 4 });
    expect(result.hits).toEqual([]);
  });

  it('lands exactly on the aim tile when d4Roll is 1 (distance 0) (#163)', () => {
    const result = resolveDropPod({
      aim: { col: 5, row: 5 },
      d4Roll: 1,
      d6Roll: 1,
      dimensions: { cols: 20, rows: 20 },
      findTokenAt: () => null,
    });
    expect(result.hex).toEqual({ col: 5, row: 5 });
  });

  it('clamps at the board edge instead of going out of bounds', () => {
    const result = resolveDropPod({
      aim: { col: 1, row: 1 },
      d4Roll: 4,
      d6Roll: 1, // North
      dimensions: { cols: 20, rows: 20 },
      findTokenAt: () => null,
    });
    expect(result.hex.row).toBeGreaterThanOrEqual(0);
    expect(result.hex.col).toBeGreaterThanOrEqual(0);
  });

  it('hits an occupying model and deviates one further hex in the same direction', () => {
    const occupantHex = { col: 5, row: 4 };
    const beyondHex = { col: 5, row: 3 };
    const occupant = { id: 'enemy-1', position: occupantHex };
    const result = resolveDropPod({
      aim: { col: 5, row: 5 },
      d4Roll: 2,
      d6Roll: 1, // North
      dimensions: { cols: 20, rows: 20 },
      findTokenAt: (hex) =>
        hex.col === occupantHex.col && hex.row === occupantHex.row
          ? occupant
          : null,
    });
    expect(result.hits).toHaveLength(1);
    expect(result.hits[0].token).toBe(occupant);
    expect(result.hex).toEqual(beyondHex);
  });

  it('chains through multiple stacked occupants until it finds an empty hex', () => {
    const occupiedHexes = [
      { col: 5, row: 4 },
      { col: 5, row: 3 },
    ];
    const findTokenAt = (hex) =>
      occupiedHexes.some((h) => h.col === hex.col && h.row === hex.row)
        ? { id: `at-${hex.col},${hex.row}` }
        : null;
    const result = resolveDropPod({
      aim: { col: 5, row: 5 },
      d4Roll: 2,
      d6Roll: 1,
      dimensions: { cols: 20, rows: 20 },
      findTokenAt,
    });
    expect(result.hits).toHaveLength(2);
    expect(result.hex).toEqual({ col: 5, row: 2 });
  });
});
