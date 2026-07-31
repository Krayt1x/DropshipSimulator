// Ported from DropshipBuilder's src/lib/constants.js (#188) — just the
// subset the in-app list builder needs. armorLabel differs from the
// original: DropshipBuilder tracks armor as 4 separate fields, but this
// repo's own units.json already stores the combined "F/L/R/Rear" string
// (see .github/scripts/transform-units.mjs), so this just reads it back.
export const UNIT_SIZES = {
  Micro: 'Micro - 1',
  Small: 'Small - 2',
  Medium: 'Medium - 3',
  Large: 'Large - 4',
  'Drop Pod': 'Drop Pod (special) - 1',
};

export const SLOTS = ['Movement', 'Left', 'Right', 'Head'];
export const DROP_POD_SIZE = 'Drop Pod';
export const EFFECT_STATS = [
  { key: 'base_movement', label: 'Movement' },
  { key: 'hp', label: 'HP' },
  { key: 'left_slots', label: 'Left slots' },
  { key: 'right_slots', label: 'Right slots' },
  { key: 'head_slots', label: 'Head slots' },
];
const WEAPON_SIZE_SLOTS = { Small: 1, Medium: 2, Large: 3 };

export function sizeLabel(size) {
  return UNIT_SIZES[size] ?? size;
}

export function armorLabel(unit) {
  return unit?.armor || '—';
}

export function weaponSlotCost(item) {
  return WEAPON_SIZE_SLOTS[item?.size] ?? 1;
}

export function effectStatLabel(key) {
  return EFFECT_STATS.find((s) => s.key === key)?.label ?? key;
}
