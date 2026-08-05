// Some equipment (e.g. "Armor Plate", #203) is a DropshipSimulator-only
// concept that doesn't exist in DropshipBuilder's own data — a plain
// overwrite of this file from DropshipBuilder's copy silently deletes it
// every time this sync runs (#193 investigation). Any item whose id was in
// the previous synced file but isn't in the freshly-fetched upstream one is
// assumed to be local-only and carried forward instead of dropped.
import { readFileSync, writeFileSync } from 'node:fs';

const [, , oldPath, newPath, outputPath] = process.argv;
const oldEquipment = JSON.parse(readFileSync(oldPath, 'utf8'));
const newEquipment = JSON.parse(readFileSync(newPath, 'utf8'));

const newIds = new Set(newEquipment.map((item) => Number(item.id)));
const localOnly = oldEquipment.filter((item) => !newIds.has(Number(item.id)));

writeFileSync(
  outputPath,
  JSON.stringify([...newEquipment, ...localOnly], null, 2) + '\n',
);
