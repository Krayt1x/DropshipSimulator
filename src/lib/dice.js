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
