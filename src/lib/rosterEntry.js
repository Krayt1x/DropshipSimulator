// Ported from DropshipBuilder's src/lib/rosterEntry.js (#188), pointed at
// this repo's own builderConstants.js instead.
import {
  SLOTS,
  DROP_POD_SIZE,
  weaponSlotCost,
  armorLabel,
} from './builderConstants.js';

export const WEIGHT_SEGMENT_COLORS = [
  '#1d4ed8',
  '#2563eb',
  '#3b82f6',
  '#60a5fa',
  '#93c5fd',
];

export function requiredTypeForSlot(slot) {
  if (slot === 'Movement') return 'Movement';
  if (slot === 'Head') return 'Augment';
  return 'Weapon';
}

function actionDiceSummary(item) {
  return item?.action_dice_color ? ` · +1 ${item.action_dice_color} die` : '';
}

export function itemStatSummary(item) {
  if (!item) return '';
  const itemType = item.type ?? 'Movement';
  const dice = actionDiceSummary(item);
  if (itemType === 'Weapon') {
    const slots = weaponSlotCost(item);
    return `${item.size ?? 'Small'} (${slots} slot${slots > 1 ? 's' : ''}) · ${item.weight ?? 0}t · Range ${item.range || '—'} · Heat ${item.heat_rating || '—'} · ${item.hit_dice || '—'} · HP ${item.hp ?? '—'}${dice}`;
  }
  if (itemType === 'Movement') {
    return `${item.movement ?? 0} move · ${item.weight ?? 0}t · Heat ${item.heat_rating || '—'}${dice}`;
  }
  if (itemType === 'Augment') {
    const slots = weaponSlotCost(item);
    return `${slots} slot${slots > 1 ? 's' : ''} · ${item.weight ?? 0}t${dice}`;
  }
  return `${item.weight ?? 0}t${dice}`;
}

export function computeRosterStats(entry, units, equipment, totalWeight) {
  const { unit } = entry;
  const isDropPod = unit.size === DROP_POD_SIZE;
  const unitEquipment = equipment.filter(
    (item) => item.manufacturer === unit.manufacturer,
  );
  const dropPodEquipmentId = entry.equipment?.Movement?.[0] ?? 0;
  const dropPodEquipmentOptions = unitEquipment.filter(
    (item) => !item.no_drop_pod,
  );
  const dropPodSelected = dropPodEquipmentOptions.find(
    (item) => Number(item.id) === Number(dropPodEquipmentId),
  );

  function resolveEquippedItems(slot) {
    const requiredType = requiredTypeForSlot(slot);
    const slotOptions = unitEquipment.filter(
      (item) => (item.type ?? 'Movement') === requiredType,
    );
    return (entry.equipment?.[slot] ?? [])
      .map((id) => slotOptions.find((item) => Number(item.id) === Number(id)))
      .filter(Boolean);
  }

  const allEquippedItems = isDropPod
    ? dropPodSelected
      ? [dropPodSelected]
      : []
    : SLOTS.flatMap((slot) => resolveEquippedItems(slot));

  const statBonus = allEquippedItems.reduce(
    (bonus, item) => {
      (item.effect_stats ?? []).forEach(({ stat, amount }) => {
        if (stat in bonus) bonus[stat] += Number(amount) || 0;
      });
      return bonus;
    },
    { base_movement: 0, hp: 0, left_slots: 0, right_slots: 0, head_slots: 0 },
  );

  const effectiveHp = Number(unit.hp ?? 0) + statBonus.hp;

  const slotCounts = {
    Movement: 1,
    Left: Math.max(0, Number(unit.left_slots ?? 1) + statBonus.left_slots),
    Right: Math.max(0, Number(unit.right_slots ?? 1) + statBonus.right_slots),
    Head: Math.max(0, Number(unit.head_slots ?? 0) + statBonus.head_slots),
  };

  const maxWeight = Number(unit.max_weight) || 0;
  const maxDropWeight = Number(unit.max_drop_weight) || 0;
  const overMaxWeight = maxWeight > 0 && totalWeight > maxWeight;
  const overDropWeight =
    !overMaxWeight && maxDropWeight > 0 && totalWeight > maxDropWeight;

  const overCapacitySlots = {};
  if (!isDropPod) {
    ['Left', 'Right', 'Head'].forEach((slot) => {
      const usedCost = resolveEquippedItems(slot).reduce(
        (sum, item) => sum + weaponSlotCost(item),
        0,
      );
      overCapacitySlots[slot] = usedCost > slotCounts[slot];
    });
  }

  const movementItem = isDropPod ? null : resolveEquippedItems('Movement')[0];
  const movementGearStat =
    Number(movementItem?.movement ?? 0) + statBonus.base_movement;
  const excessDropWeight =
    maxDropWeight > 0 ? Math.max(0, totalWeight - maxDropWeight) : 0;
  const effectiveMovement = Math.max(0, movementGearStat - excessDropWeight);

  const statsLine = [
    `Armor ${armorLabel(unit)}`,
    `HP ${effectiveHp}`,
    `Move ${effectiveMovement}`,
  ].join(' · ');

  const equippedWithEffects = [];
  const equippedWeights = [];
  if (isDropPod) {
    if (dropPodSelected?.effects || dropPodSelected?.effect_stats?.length) {
      equippedWithEffects.push({ key: 'equipment', item: dropPodSelected });
    }
    if (dropPodSelected) {
      const weight = Number(dropPodSelected.weight ?? 0);
      if (weight > 0) {
        equippedWeights.push({
          key: 'equipment',
          name: dropPodSelected.name,
          weight,
        });
      }
    }
  } else {
    SLOTS.forEach((slot) => {
      const requiredType = requiredTypeForSlot(slot);
      const slotOptions = unitEquipment.filter(
        (item) => (item.type ?? 'Movement') === requiredType,
      );
      const ids = entry.equipment?.[slot] ?? [];
      ids.forEach((selectedId, i) => {
        const selected = slotOptions.find(
          (item) => Number(item.id) === Number(selectedId),
        );
        if (selected?.effects || selected?.effect_stats?.length) {
          equippedWithEffects.push({ key: `${slot}-${i}`, item: selected });
        }
        if (selected) {
          const weight = Number(selected.weight ?? 0);
          if (weight > 0) {
            equippedWeights.push({
              key: `${slot}-${i}`,
              name: selected.name,
              weight,
            });
          }
        }
      });
    });
  }
  const hullWeight = Math.max(
    0,
    totalWeight - equippedWeights.reduce((sum, item) => sum + item.weight, 0),
  );

  return {
    unit,
    isDropPod,
    unitEquipment,
    dropPodEquipmentId,
    dropPodEquipmentOptions,
    dropPodSelected,
    resolveEquippedItems,
    slotCounts,
    maxWeight,
    maxDropWeight,
    overMaxWeight,
    overDropWeight,
    overCapacitySlots,
    movementGearStat,
    excessDropWeight,
    effectiveMovement,
    statsLine,
    equippedWithEffects,
    equippedWeights,
    hullWeight,
  };
}
