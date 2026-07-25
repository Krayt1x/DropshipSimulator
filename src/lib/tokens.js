import { makeKey } from './storage.js';
import { DICE_COLORS } from './dice.js';

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

// Facing 0-5 steps clockwise from North (0=N, 1=NE, 2=SE, 3=S, 4=SW, 5=NW),
// matching the flat-top hex grid's six true neighbor directions.
const DEFAULT_FACING_BY_OWNER = { p1: 3, p2: 0 };

// weaponState is keyed by position in equippedIds rather than by equipment
// id, so two of the same weapon (e.g. two Artillery in different slots) each
// track their own heat instead of sharing one.
export function createToken({ unit, equippedIds, owner, position }) {
  const weaponState = {};
  equippedIds.forEach((id, index) => {
    weaponState[index] = { heat: 0, broken: false };
  });
  return {
    id: makeKey('token'),
    unitId: unit.id,
    manufacturer: unit.manufacturer,
    owner,
    position,
    facing: DEFAULT_FACING_BY_OWNER[owner] ?? 0,
    currentHp: Number(unit.hp) || 0,
    equippedIds,
    weaponState,
    destroyed: false,
  };
}

export function healthBarColor(fraction) {
  if (fraction <= 0.25) return '#dc2626';
  if (fraction <= 0.5) return '#f59e0b';
  return '#22c55e';
}

// Only models currently deployed on the board contribute to a player's dice
// count — reserve and destroyed models don't count.
export function deployedDiceByOwner(tokens, units) {
  const totals = emptyDiceTotals();
  tokens.forEach((token) => {
    if (!token.position || token.destroyed) return;
    const bucket = totals[token.owner];
    if (!bucket) return;
    const unit = units.find((u) => Number(u.id) === Number(token.unitId));
    if (!unit) return;
    DICE_COLORS.forEach((color) => {
      bucket[color] += Number(unit[`dice_${color}`]) || 0;
    });
  });
  return totals;
}

export function emptyDiceTotals() {
  return Object.fromEntries(
    OWNERS.map((o) => [
      o.id,
      Object.fromEntries(DICE_COLORS.map((c) => [c, 0])),
    ]),
  );
}

// Combines multiple per-owner dice totals (e.g. dice from deployed models
// plus dice banked from destroyed ones) into a single set of totals.
export function sumDiceTotals(...totalsList) {
  const sum = emptyDiceTotals();
  totalsList.forEach((totals) => {
    OWNERS.forEach((o) => {
      DICE_COLORS.forEach((c) => {
        sum[o.id][c] += totals?.[o.id]?.[c] ?? 0;
      });
    });
  });
  return sum;
}

export function groupEquipmentByType(items) {
  return items.reduce((groups, item) => {
    const type = item.type ?? 'Movement';
    if (!groups[type]) groups[type] = [];
    groups[type].push(item);
    return groups;
  }, {});
}
