import { parseHitDice } from './dice.js';
import { itemHasTag, parseHeatRating } from './tokens.js';

// "2/2/2/1" -> { front: 2, left: 2, right: 2, rear: 1 } (#212 in DropshipBuilder
// establishes this front/left/right/rear slash order).
export function parseArmor(armor) {
  const parts = String(armor ?? '')
    .split('/')
    .map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [front, left, right, rear] = parts;
  return { front, left, right, rear };
}

// Armor Plate (#203) adds +1 armor to whichever side it's equipped on while
// unbroken — Left/Right slot plates protect that side only, a Head-slot one
// (no side recorded, same as any other Augment) protects front and rear.
export function armorPlateBonus(token, side, equipment) {
  if (!token?.equippedIds) return 0;
  return token.equippedIds.reduce((bonus, id, index) => {
    const item = equipment.find((e) => Number(e.id) === Number(id));
    if (!item || !itemHasTag(item, 'armor_plate')) return bonus;
    if (token.weaponState[index]?.broken) return bonus;
    const plateSide = token.weaponState[index]?.side;
    if (plateSide === 'left' || plateSide === 'right') {
      return side === plateSide ? bonus + 1 : bonus;
    }
    return side === 'front' || side === 'rear' ? bonus + 1 : bonus;
  }, 0);
}

// parseArmor's base value for `side`, plus whatever Armor Plates the token
// itself has equipped there (#203) — the single point every attack
// resolution should read armor through instead of parseArmor alone.
export function effectiveSideArmor(token, unit, side, equipment) {
  const base = parseArmor(unit?.armor)?.[side] ?? 0;
  return base + armorPlateBonus(token, side, equipment);
}

// Heat Sink (#245) — after the end-of-turn -1 heat cooldown, each Heat Sink
// (in equip order, top-down) pulls exactly 1 point of heat off the first
// still-hot non-Heat-Sink item that shares its physical slot ('left'/'right'/
// 'head'/'movement' — see createToken's equippedSlots), capped at the sink's
// own heat rating's max. Heat Sinks never donate to one another.
export function applyHeatSinkTransfers(token, equipment) {
  if (!token?.equippedIds) return token?.weaponState ?? {};
  const weaponState = { ...token.weaponState };
  const itemAt = (index) =>
    equipment.find((e) => Number(e.id) === Number(token.equippedIds[index]));

  const bySlot = new Map();
  token.equippedIds.forEach((_, index) => {
    const slot = weaponState[index]?.slot;
    if (!bySlot.has(slot)) bySlot.set(slot, []);
    bySlot.get(slot).push(index);
  });

  bySlot.forEach((indices) => {
    indices
      .filter((index) => itemHasTag(itemAt(index), 'heat_sink'))
      .forEach((sinkIndex) => {
        const sinkState = weaponState[sinkIndex];
        const { max: sinkMax } = parseHeatRating(itemAt(sinkIndex)?.heat_rating);
        if (!sinkState || sinkState.heat >= sinkMax) return;
        const donorIndex = indices.find(
          (index) =>
            index !== sinkIndex &&
            !itemHasTag(itemAt(index), 'heat_sink') &&
            (weaponState[index]?.heat ?? 0) > 0,
        );
        if (donorIndex === undefined) return;
        weaponState[donorIndex] = {
          ...weaponState[donorIndex],
          heat: weaponState[donorIndex].heat - 1,
        };
        weaponState[sinkIndex] = { ...sinkState, heat: sinkState.heat + 1 };
      });
  });

  return weaponState;
}

export function rollAttackDice(hitDice) {
  const parsed = parseHitDice(hitDice);
  if (!parsed) return null;
  const sides = Number(parsed.dieId.slice(1));
  const rolls = Array.from(
    { length: parsed.count },
    () => 1 + Math.floor(Math.random() * sides),
  );
  return { rolls, sides };
}

// A roll at or under the target's size is a hit.
export function countHits(rolls, targetNumber) {
  return rolls.filter((roll) => roll <= targetNumber).length;
}

export function calculateDamage(dieSides, sideArmor, hits) {
  return Math.max(0, dieSides - sideArmor) * hits;
}
