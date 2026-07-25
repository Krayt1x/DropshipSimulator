export const DICE_COLORS = ['blue', 'red', 'green'];

export const DIE_TYPES = [
  { id: 'd4', label: 'D4', sides: 4 },
  { id: 'd6', label: 'D6', sides: 6 },
  { id: 'd8', label: 'D8', sides: 8 },
  { id: 'd10', label: 'D10', sides: 10 },
  {
    id: 'blue',
    label: 'Blue',
    faces: ['Attack', 'Attack', 'Action', 'Action', 'Move', 'Move'],
  },
  {
    id: 'red',
    label: 'Red',
    faces: ['Attack', 'Attack', 'Attack', 'Attack', 'Action', 'Move'],
  },
];

export function rollDie(dieType) {
  if (dieType.faces) {
    return dieType.faces[Math.floor(Math.random() * dieType.faces.length)];
  }
  return String(Math.floor(Math.random() * dieType.sides) + 1);
}

function isWordDie(label) {
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

const WORD_ORDER = ['Move', 'Action', 'Attack'];

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
