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
  {
    name: 'Map 1',
    dimensions: DEFAULT_MAP_DIMENSIONS,
    tileTypes: DEFAULT_TERRAIN_TYPES,
    // #220 — a lake down the west side, two forest thickets flanking the
    // center, buildings clustered around each of the two objectives, and
    // forest cover in the northeast/southeast corners.
    tiles: {
      '7,12': 'objective',
      '16,12': 'objective',
      '0,13': 'water',
      '0,14': 'water',
      '0,16': 'water',
      '0,15': 'water',
      '1,14': 'water',
      '1,13': 'water',
      '2,14': 'water',
      '2,13': 'water',
      '3,12': 'water',
      '3,13': 'water',
      '4,12': 'water',
      '4,13': 'water',
      '3,11': 'water',
      '4,11': 'water',
      '3,10': 'water',
      '4,10': 'water',
      '3,9': 'water',
      '4,9': 'forest',
      '2,10': 'forest',
      '2,9': 'forest',
      '4,8': 'forest',
      '3,8': 'forest',
      '3,6': 'forest',
      '2,8': 'forest',
      '3,7': 'forest',
      '4,7': 'forest',
      '2,7': 'forest',
      '1,7': 'forest',
      '1,8': 'forest',
      '1,9': 'forest',
      '0,9': 'forest',
      '0,10': 'forest',
      '0,8': 'forest',
      '10,13': 'buildings',
      '10,12': 'buildings',
      '11,12': 'buildings',
      '12,10': 'buildings',
      '14,10': 'buildings',
      '13,10': 'buildings',
      '13,9': 'buildings',
      '19,13': 'buildings',
      '20,13': 'buildings',
      '20,12': 'buildings',
      '19,12': 'buildings',
      '23,5': 'forest',
      '22,7': 'forest',
      '22,6': 'forest',
      '23,7': 'forest',
      '23,6': 'forest',
      '23,21': 'forest',
      '22,21': 'forest',
      '21,20': 'forest',
      '22,20': 'forest',
      '23,20': 'forest',
      '23,19': 'forest',
      '23,18': 'forest',
      '22,19': 'forest',
    },
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
