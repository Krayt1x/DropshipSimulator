import { makeKey } from './storage.js';

export const OWNERS = [
  { id: 'p1', label: 'Player 1', color: '#2563eb' },
  { id: 'p2', label: 'Player 2', color: '#dc2626' },
];

export function ownerColor(ownerId) {
  return OWNERS.find((o) => o.id === ownerId)?.color ?? '#78716c';
}

export function parseHeatRating(heatRating) {
  const [generate, max] = String(heatRating ?? '')
    .split('/')
    .map((n) => Number(n.trim()));
  return {
    generate: Number.isFinite(generate) ? generate : 0,
    max: Number.isFinite(max) ? max : 0,
  };
}

export function createToken({ unit, equippedIds, owner, position }) {
  const weaponState = {};
  equippedIds.forEach((id) => {
    weaponState[id] = { heat: 0, broken: false };
  });
  return {
    id: makeKey('token'),
    unitId: unit.id,
    manufacturer: unit.manufacturer,
    owner,
    position,
    facing: 0,
    currentHp: Number(unit.hp) || 0,
    equippedIds,
    weaponState,
    destroyed: false,
  };
}

export function groupEquipmentByType(items) {
  return items.reduce((groups, item) => {
    const type = item.type ?? 'Movement';
    if (!groups[type]) groups[type] = [];
    groups[type].push(item);
    return groups;
  }, {});
}
