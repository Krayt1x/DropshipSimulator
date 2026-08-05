import { describe, it, expect } from 'vitest';
import { exportMap, parseMapExport, DEFAULT_MAPS } from './maps.js';

describe('exportMap / parseMapExport', () => {
  it('round-trips dimensions, tileTypes, and tiles through export text', () => {
    const map = {
      dimensions: { cols: 10, rows: 8 },
      tileTypes: DEFAULT_MAPS[0].tileTypes,
      tiles: { '1,1': 'water' },
    };
    const text = exportMap(map);
    const parsed = parseMapExport(text);
    expect(parsed).toEqual(map);
  });

  it('returns null for text that is not valid JSON', () => {
    expect(parseMapExport('not json')).toBeNull();
  });

  it('returns null when required fields are missing', () => {
    expect(parseMapExport(JSON.stringify({ dimensions: { cols: 1 } }))).toBeNull();
    expect(
      parseMapExport(JSON.stringify({ dimensions: { cols: 1, rows: 1 } })),
    ).toBeNull();
  });
});

describe('DEFAULT_MAPS', () => {
  it('includes a Blank map with no tiles painted', () => {
    const blank = DEFAULT_MAPS.find((m) => m.name === 'Blank');
    expect(blank).toBeDefined();
    expect(blank.tiles).toEqual({});
  });

  it('includes "Map 1" with its lake, forests, and two objectives (#220)', () => {
    const map1 = DEFAULT_MAPS.find((m) => m.name === 'Map 1');
    expect(map1).toBeDefined();
    expect(map1.dimensions).toEqual({ cols: 24, rows: 24 });
    expect(map1.tiles['7,12']).toBe('objective');
    expect(map1.tiles['16,12']).toBe('objective');
    expect(map1.tiles['0,13']).toBe('water');
    expect(map1.tiles['10,13']).toBe('buildings');
    expect(Object.keys(map1.tiles)).toHaveLength(59);
  });
});
