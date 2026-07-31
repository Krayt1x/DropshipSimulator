// Terrain types (#177 renamed from "tile types") gained real gameplay effects
// in #178 — previously they were purely a color/tooltip, matched into
// MapEditorPage.jsx and BattlePage.jsx independently as two copies of the
// same literal. This is now the single source of truth for both.
import { hexLine } from './hex.js';

export const DEFAULT_TERRAIN_TYPES = [
  {
    id: 'plain',
    name: 'Plain',
    color: '#78716c',
    blocksLineOfSight: false,
    blocksMovement: false,
    isObjective: false,
  },
  {
    id: 'buildings',
    name: 'Buildings',
    color: '#9ca3af',
    blocksLineOfSight: true,
    blocksMovement: true,
    isObjective: false,
  },
  {
    id: 'forest',
    name: 'Forest',
    color: '#14532d',
    blocksLineOfSight: true,
    blocksMovement: false,
    isObjective: false,
  },
  {
    id: 'water',
    name: 'Water',
    color: '#3b82f6',
    blocksLineOfSight: false,
    blocksMovement: true,
    isObjective: false,
  },
  {
    id: 'objective',
    name: 'Objective',
    color: '#f97316',
    blocksLineOfSight: true,
    blocksMovement: true,
    isObjective: true,
  },
];

// A browser whose saved terrain types predate one of the built-ins above
// (or that had one deleted from the Map Editor's palette) would otherwise
// never see it again, since useLocalStorageState's initial value only
// applies when the key is completely unset (#194). Called once on mount by
// both MapEditorPage and BattlePage, this adds back any built-in missing by
// id, leaving everything else — including a user's own edits to a built-in
// that's still present, and any custom terrain types they've added — alone.
export function mergeDefaultTerrainTypes(current) {
  const existingIds = new Set((current ?? []).map((t) => t.id));
  const missing = DEFAULT_TERRAIN_TYPES.filter((t) => !existingIds.has(t.id));
  if (missing.length === 0) return current;
  return [...(current ?? []), ...missing];
}

// Terrain types saved before #178 (or added since without the checkboxes
// ticked) won't have these flags at all — default every one of them to false
// so old maps behave exactly as they used to (no blocking anywhere).
export function terrainAt(tiles, terrainTypes, hex) {
  const id = tiles[`${hex.col},${hex.row}`];
  if (!id) return null;
  return terrainTypes.find((t) => t.id === id) ?? null;
}

export function blocksLineOfSight(tiles, terrainTypes, hex) {
  return Boolean(terrainAt(tiles, terrainTypes, hex)?.blocksLineOfSight);
}

export function blocksMovement(tiles, terrainTypes, hex) {
  return Boolean(terrainAt(tiles, terrainTypes, hex)?.blocksMovement);
}

export function isObjectiveHex(tiles, terrainTypes, hex) {
  return Boolean(terrainAt(tiles, terrainTypes, hex)?.isObjective);
}

// Only hexes strictly between the two endpoints can obstruct — standing next
// to (or firing from/at) a blocking tile is unaffected by it.
export function hasLineOfSight(from, to, tiles, terrainTypes) {
  const line = hexLine(from, to);
  return !line
    .slice(1, -1)
    .some((hex) => blocksLineOfSight(tiles, terrainTypes, hex));
}

// The destination counts (you can't land on blocking terrain) as well as
// every hex passed through along the way; the origin doesn't, since you
// start there regardless of what's under you.
export function isMovementPathBlocked(from, to, tiles, terrainTypes) {
  const line = hexLine(from, to);
  return line.slice(1).some((hex) => blocksMovement(tiles, terrainTypes, hex));
}

export function objectiveHexesFrom(tiles, terrainTypes) {
  return Object.keys(tiles)
    .filter((key) => {
      const [col, row] = key.split(',').map(Number);
      return isObjectiveHex(tiles, terrainTypes, { col, row });
    })
    .map((key) => {
      const [col, row] = key.split(',').map(Number);
      return { col, row };
    });
}
