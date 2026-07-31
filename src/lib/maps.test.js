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
});
