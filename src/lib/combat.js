import { parseHitDice } from './dice.js';

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
