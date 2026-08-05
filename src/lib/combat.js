import { parseHitDice } from './dice.js';
import { itemHasTag } from './tokens.js';

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
