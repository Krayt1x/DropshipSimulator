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
export const EQUIPMENT_TYPES = ['Movement', 'Weapon', 'Augment'];
export const WEAPON_SIZES = ['Small', 'Medium', 'Large'];
export const EFFECT_STATS = [
  { key: 'base_movement', label: 'Movement' },
  { key: 'hp', label: 'HP' },
  { key: 'left_slots', label: 'Left slots' },
  { key: 'right_slots', label: 'Right slots' },
  { key: 'head_slots', label: 'Head slots' },
  { key: 'dice', label: 'Dice' },
  { key: 'tags', label: 'Tags' },
];
// Gameplay tags the simulator's own rules key off of (#265-#268) — the `key`
// values here are the wire format read off effect_stats entries with
// `stat === 'tags'` (see itemHasTag in tokens.js), not just display text.
export const EQUIPMENT_TAGS = [
  { key: 'flying', label: 'Flying' },
  { key: 'fire', label: 'Fire' },
  { key: 'splash', label: 'Splash' },
  { key: 'indirect_fire', label: 'Indirect Fire' },
  { key: 'armor_plate', label: 'Armor Plate' },
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

export function effectStatChipText(effect) {
  if (effect.stat === 'dice') {
    const color = String(effect.amount ?? '');
    const label = color ? color.charAt(0).toUpperCase() + color.slice(1) : '';
    return `+1 ${label} die`;
  }
  if (effect.stat === 'tags') {
    return (
      EQUIPMENT_TAGS.find((t) => t.key === effect.amount)?.label ??
      effect.amount
    );
  }
  const sign = effect.amount > 0 ? '+' : '';
  return `${sign}${effect.amount} ${effectStatLabel(effect.stat)}`;
}

// DropshipBuilder tracks a unit's armor as 4 separate fields
// (front_armor/left_armor/right_armor/rear_armor); this repo stores the
// combined "F/L/R/Rear" string instead (see .github/scripts/
// transform-units.mjs) — these two convert between the two shapes so
// UnitForm (ported verbatim) can keep using 4 separate inputs.
export function armorStringToFields(armor) {
  const parts = String(armor ?? '')
    .split('/')
    .map((p) => Number(p.trim()));
  const [front, left, right, rear] = parts.length === 4 ? parts : [0, 0, 0, 0];
  return {
    front_armor: Number.isFinite(front) ? front : 0,
    left_armor: Number.isFinite(left) ? left : 0,
    right_armor: Number.isFinite(right) ? right : 0,
    rear_armor: Number.isFinite(rear) ? rear : 0,
  };
}

export function armorFieldsToString({
  front_armor: front,
  left_armor: left,
  right_armor: right,
  rear_armor: rear,
}) {
  return [front, left, right, rear].map((v) => Math.max(0, Number(v) || 0)).join('/');
}
