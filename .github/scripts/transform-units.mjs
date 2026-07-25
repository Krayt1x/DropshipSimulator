// DropshipBuilder's units.json tracks front/left/right/rear armor as four
// separate numeric fields; DropshipSimulator's UI (UnitCardHeader.jsx) just
// displays a single "armor" string like "2/2/2/1", so the synced copy
// collapses those four fields into that one in the same position, and
// otherwise passes every field through unchanged (see #100).
import { readFileSync, writeFileSync } from 'node:fs';

const [, , inputPath, outputPath] = process.argv;
const units = JSON.parse(readFileSync(inputPath, 'utf8'));

const ARMOR_FIELDS = ['front_armor', 'left_armor', 'right_armor', 'rear_armor'];

const transformed = units.map((unit) => {
  const armor = ARMOR_FIELDS.map((f) => unit[f])
    .filter((v) => v !== undefined)
    .join('/');
  const result = {};
  for (const [key, value] of Object.entries(unit)) {
    if (ARMOR_FIELDS.includes(key)) continue;
    result[key] = value;
    if (key === 'weight') result.armor = armor;
  }
  return result;
});

writeFileSync(outputPath, JSON.stringify(transformed, null, 2) + '\n');
