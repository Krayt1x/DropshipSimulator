import actionDice from '../data/actionDice.json';

export const DICE_COLORS = ['blue', 'red', 'green', 'yellow', 'purple', 'orange'];
export const ACTION_DICE_SIDE_KEYS = [
  'side1',
  'side2',
  'side3',
  'side4',
  'side5',
  'side6',
];

// The colored action dice's face layouts come from DropshipBuilder's Action
// Dice Creator (synced daily into actionDice.json) rather than being
// hardcoded here, so a manufacturer's custom die shows up automatically.
const coloredDieTypes = DICE_COLORS.map((color) => {
  const entry = actionDice.find((d) => d.color === color);
  const faces = entry
    ? [1, 2, 3, 4, 5, 6].map((side) => entry[`side${side}`])
    : [];
  return {
    id: color,
    label: color.charAt(0).toUpperCase() + color.slice(1),
    faces,
  };
});

export const DIE_TYPES = [
  { id: 'd4', label: 'D4', sides: 4 },
  { id: 'd6', label: 'D6', sides: 6 },
  { id: 'd8', label: 'D8', sides: 8 },
  { id: 'd10', label: 'D10', sides: 10 },
  ...coloredDieTypes,
];

export function rollDie(dieType) {
  if (dieType.faces) {
    return dieType.faces[Math.floor(Math.random() * dieType.faces.length)];
  }
  return String(Math.floor(Math.random() * dieType.sides) + 1);
}

// "2d8" -> { count: 2, dieId: 'd8' }; returns null for anything else (word
// dice pools, blank hit dice, etc. aren't rollable into the numeric pool).
export function parseHitDice(hitDice) {
  const match = String(hitDice ?? '')
    .trim()
    .match(/^(\d+)d(\d+)$/i);
  if (!match) return null;
  const count = Number(match[1]);
  const dieId = `d${match[2]}`;
  if (!DIE_TYPES.some((d) => d.id === dieId)) return null;
  return { count, dieId };
}

export function isWordDie(label) {
  return Boolean(DIE_TYPES.find((d) => d.label === label)?.faces);
}

// Groups a flat roll result list by die label, preserving first-appearance
// order (which follows DIE_TYPES order since that's how rolls are built).
export function countRollsByLabel(rolled) {
  const counts = [];
  const byLabel = new Map();
  rolled.forEach(({ label }) => {
    if (!byLabel.has(label)) {
      const entry = { label, count: 0 };
      byLabel.set(label, entry);
      counts.push(entry);
    }
    byLabel.get(label).count += 1;
  });
  return counts;
}

export const WORD_ORDER = ['Move', 'Action', 'Attack'];

// Summarizes roll outcomes by value — colored (word) dice grouped separately
// from numerical dice, since "3 Move" and "3 x 6's" read very differently.
export function summarizeRollResults(rolled) {
  const wordCounts = {};
  const numberCounts = {};
  rolled.forEach(({ label, value }) => {
    const counts = isWordDie(label) ? wordCounts : numberCounts;
    counts[value] = (counts[value] ?? 0) + 1;
  });
  const words = Object.entries(wordCounts).sort(
    (a, b) => WORD_ORDER.indexOf(a[0]) - WORD_ORDER.indexOf(b[0]),
  );
  const numbers = Object.entries(numberCounts).sort(
    (a, b) => Number(a[0]) - Number(b[0]),
  );
  return { words, numbers };
}

export function formatRollLogMessage(rolled) {
  const countLines = countRollsByLabel(rolled)
    .map(({ label, count }) =>
      isWordDie(label)
        ? `Rolled ${count} ${label.toLowerCase()} ${count === 1 ? 'die' : 'dice'}`
        : `Rolled ${count}${label.toLowerCase()}`,
    )
    .join('\n');
  const resultsLine = rolled.map((r) => `${r.label} ${r.value}`).join(', ');
  return `${countLines}\n\nResults:\n${resultsLine}`;
}
