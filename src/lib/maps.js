// Map export/import (#176) — mirrors the roster import convention
// (rosterImport.js's parseRosterExport / RosterImport.jsx's DEFAULT_ROSTERS)
// but for map data instead of unit lists. `background` (a big image blob) is
// deliberately left out of both the export text and the default maps below —
// it's cosmetic only and would make exports unwieldy.
import { DEFAULT_TERRAIN_TYPES } from './terrain.js';

export const DEFAULT_MAP_DIMENSIONS = { cols: 24, rows: 24 };

export const DEFAULT_MAPS = [
  {
    name: 'Blank',
    dimensions: DEFAULT_MAP_DIMENSIONS,
    tileTypes: DEFAULT_TERRAIN_TYPES,
    tiles: {},
  },
];

export function exportMap({ dimensions, tileTypes, tiles }) {
  return JSON.stringify({ dimensions, tileTypes, tiles }, null, 2);
}

// Returns null for anything that isn't a well-formed map export, so callers
// can gate an "Import" action on a successful parse the same way
// parseRosterExport's warnings/entries gate the roster import preview.
export function parseMapExport(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !parsed.dimensions ||
    !Number.isFinite(Number(parsed.dimensions.cols)) ||
    !Number.isFinite(Number(parsed.dimensions.rows)) ||
    !Array.isArray(parsed.tileTypes) ||
    typeof parsed.tiles !== 'object' ||
    parsed.tiles === null
  ) {
    return null;
  }
  return {
    dimensions: {
      cols: Number(parsed.dimensions.cols),
      rows: Number(parsed.dimensions.rows),
    },
    tileTypes: parsed.tileTypes,
    tiles: parsed.tiles,
  };
}
