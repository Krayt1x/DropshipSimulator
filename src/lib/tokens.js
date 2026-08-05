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
// track their own heat instead of sharing one. `equippedSides` (parallel to
// equippedIds, 'left'/'right'/undefined) comes from a roster import's
// "Left:"/"Right:" labels and drives the weapon arc restriction (#92) —
// weapons imported without that label simply have no side and show their
// full range.
export function createToken({
  unit,
  equippedIds,
  equippedSides,
  owner,
  position,
  label,
}) {
  const weaponState = {};
  equippedIds.forEach((id, index) => {
    weaponState[index] = {
      heat: 0,
      broken: false,
      side: equippedSides?.[index],
    };
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
    // The "(1)"/"(2)" DropshipBuilder appends to tell multiple copies of the
    // same unit apart (#151) — stripped before matching against the unit
    // list, but kept here so the player can still tell their own copies
    // apart everywhere a token's name is shown.
    label: label ?? null,
  };
}

// Reapplies a token's own distinguishing "(1)"/"(2)" label (#151) on top of
// its unit's base name, wherever that name is displayed.
export function withTokenLabel(name, token) {
  return token?.label ? `${name} ${token.label}` : name;
}

// "6" means 0-6 hexes away; "3-9" means a min-range weapon that can't hit
// anything closer than 3 hexes. Returns null for weapons with no usable range.
export function parseWeaponRange(range) {
  const str = String(range ?? '').trim();
  if (!str) return null;
  if (str.includes('-')) {
    const [min, max] = str.split('-').map(Number);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    return { min, max };
  }
  const max = Number(str);
  if (!Number.isFinite(max) || max <= 0) return null;
  return { min: 0, max };
}

const SIZE_NUMBERS = {
  'Drop Pod': 1,
  Micro: 1,
  Small: 2,
  Medium: 3,
  Large: 4,
  Huge: 5,
};

export function sizeNumber(size) {
  return SIZE_NUMBERS[size] ?? null;
}

// Drop pods (e.g. "Delivery Capsule") are deployed mid-game via the drop pod
// mechanic instead of a plain placement click (#157, #158).
export function isDropPodUnit(unit) {
  return unit?.size === 'Drop Pod';
}

// Gameplay tags (#265-#268) are synced over from DropshipBuilder's
// `effect_stats` array (added by #269) as `{ stat: 'tags', amount: <key> }`
// entries — this is the one place that shape gets read.
// Normalizes away case and spacing/underscore differences — DropshipBuilder
// data is synced in from an app we don't control, and its Tags feature
// stores a human-readable label ("Indirect Fire") rather than the
// machine-friendly key ("indirect_fire") this file's own callers use, so an
// exact-string match would silently miss real tagged equipment.
function normalizeTag(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[\s_]+/g, '');
}

export function itemHasTag(item, tag) {
  const target = normalizeTag(tag);
  return (item?.effect_stats ?? []).some(
    (e) => e.stat === 'tags' && normalizeTag(e.amount) === target,
  );
}

// A token "has" a movement tag (e.g. Flying, #265) if its equipped Movement
// item carries it — only one Movement item is ever equipped per token today,
// but this checks by type rather than assuming a fixed slot index.
export function tokenHasMovementTag(token, equipment, tag) {
  return token.equippedIds.some((id) => {
    const item = equipment.find((e) => Number(e.id) === Number(id));
    return item?.type === 'Movement' && itemHasTag(item, tag);
  });
}

export function healthBarColor(fraction) {
  if (fraction <= 0.25) return '#dc2626';
  if (fraction <= 0.5) return '#f59e0b';
  return '#22c55e';
}

// Only models currently deployed on the board contribute to a player's dice
// count — reserve, destroyed, and wrecked (0 HP) models don't count (#205);
// a wrecked model can sit un-destroyed for a turn or two before someone
// clicks "Model Destroyed", and it shouldn't keep feeding the action pool
// in the meantime.
export function deployedDiceByOwner(tokens, units) {
  const totals = emptyDiceTotals();
  tokens.forEach((token) => {
    if (!token.position || token.destroyed || (token.currentHp ?? 0) <= 0) {
      return;
    }
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

// Which slot an item's type occupies on a unit — Weapons go in either a
// Left or Right slot (not pinned to one at equip time), Augments go in the
// Head slot, Movement gear goes in the fixed Movement slot.
const SLOT_BY_TYPE = {
  Weapon: 'Left/Right',
  Augment: 'Head',
  Movement: 'Movement',
};

export function slotForType(type) {
  return SLOT_BY_TYPE[type] ?? '—';
}

// The equipment sitting in a token's left/right slot, for the attack-side
// picker (#204) — front/rear have no slot equipment of their own, so this
// always returns [] for any side other than 'left'/'right'.
export function equippedItemsForSide(token, side, equipment) {
  if (side !== 'left' && side !== 'right') return [];
  if (!token?.equippedIds) return [];
  return token.equippedIds
    .map((id, index) => {
      if (token.weaponState[index]?.side !== side) return null;
      const item = equipment.find((e) => Number(e.id) === Number(id));
      if (!item) return null;
      const maxHp = Number(item.hp) || 0;
      const hp = token.weaponState[index]?.hp ?? maxHp;
      return { name: item.name, hp, maxHp, broken: Boolean(token.weaponState[index]?.broken) };
    })
    .filter(Boolean);
}
