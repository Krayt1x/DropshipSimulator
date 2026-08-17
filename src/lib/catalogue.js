// Backs the in-app Manage page (#199, ported from DropshipBuilder) — the
// unit/equipment/manufacturer catalogue that used to live only in
// DropshipBuilder is now editable here too, stored in localStorage the same
// way tokens/tiles/etc. already are (see useLocalStorageState), seeded once
// from this repo's own bundled JSON. Multiple mounted call sites (BattlePage,
// PlayPage, BuilderPage, ManagePage) share the same live state automatically
// via useLocalStorageState's syncBus wiring, the same mechanism tileTypes
// already relies on (#194) — no context/prop-drilling needed.
//
// Known limitation: a multiplayer match only syncs token references
// (unitId/equippedIds), not full catalogue records, so a custom unit/item
// one player added locally will show up blank on an opponent's client whose
// catalogue doesn't have that id. Fine for sandbox/vs-computer play; worth
// revisiting if custom content needs to work in synced multiplayer too.
import { useEffect } from 'react';
import { useLocalStorageState } from './storage.js';
import manufacturersSeed from '../data/manufacturers.json';
import unitsSeed from '../data/units.json';
import equipmentSeed from '../data/equipment.json';

// The bundled JSON only seeds a browser's very first load — once a value's
// written to localStorage it wins over the seed on every load after that
// (see useLocalStorageState), so renaming Corp A/B to Central Order/The
// Hive (#310, #311) in the seed files did nothing for anyone who'd already
// played the game before that rename shipped (#312) — their cached
// catalogue kept the old names forever. This migrates a cached catalogue
// still carrying the old names in place, once, rather than requiring
// everyone to notice and use the Manage page's "reset to defaults" (which
// would also throw away any custom units/equipment they'd added).
const MANUFACTURER_RENAMES = { 'Corp A': 'Central Order', 'Corp B': 'The Hive' };

function renameManufacturer(name) {
  return MANUFACTURER_RENAMES[name] ?? name;
}

function renameManufacturerMentions(text) {
  return Object.entries(MANUFACTURER_RENAMES).reduce(
    (result, [from, to]) => result.split(from).join(to),
    text ?? '',
  );
}

export function useCatalogue() {
  const [manufacturers, setManufacturers] = useLocalStorageState(
    'dropshipsimulator:catalogue:manufacturers',
    manufacturersSeed,
  );
  const [units, setUnits] = useLocalStorageState(
    'dropshipsimulator:catalogue:units',
    unitsSeed,
  );
  const [equipment, setEquipment] = useLocalStorageState(
    'dropshipsimulator:catalogue:equipment',
    equipmentSeed,
  );

  // Combines two migrations into one pass so they can never race against
  // each other's still-stale closure of `manufacturers` (they did, when
  // written as two separate effects — the new-manufacturer check needs to
  // run against the *renamed* list, not the raw cached one, or it also
  // re-adds Central Order/The Hive as if they were new alongside whatever
  // manufacturer actually is).
  useEffect(() => {
    const needsRename = manufacturers.some((m) => m in MANUFACTURER_RENAMES);
    const renamedManufacturers = needsRename
      ? manufacturers.map(renameManufacturer)
      : manufacturers;

    // A brand-new manufacturer added to the bundled seed after this
    // browser's catalogue was already cached (e.g. Machines, #314) would
    // otherwise never show up — same root cause as the Corp A/B rename
    // above, just for wholly new content instead of a rename. Existing
    // manufacturers are left alone even if the seed later adds more to
    // them — merging those could silently resurrect something a player
    // deliberately deleted via the Manage page, which a manufacturer that
    // never existed in their cache before now couldn't have had happen to it.
    const newManufacturers = manufacturersSeed.filter(
      (m) => !renamedManufacturers.includes(m),
    );

    if (!needsRename && newManufacturers.length === 0) return;

    setManufacturers([...renamedManufacturers, ...newManufacturers]);
    setUnits([
      ...(needsRename
        ? units.map((u) => ({
            ...u,
            manufacturer: renameManufacturer(u.manufacturer),
          }))
        : units),
      ...unitsSeed.filter((u) => newManufacturers.includes(u.manufacturer)),
    ]);
    setEquipment([
      ...(needsRename
        ? equipment.map((e) => ({
            ...e,
            manufacturer: renameManufacturer(e.manufacturer),
            name: renameManufacturerMentions(e.name),
          }))
        : equipment),
      ...equipmentSeed.filter((e) => newManufacturers.includes(e.manufacturer)),
    ]);
  }, [
    manufacturers,
    units,
    equipment,
    setManufacturers,
    setUnits,
    setEquipment,
  ]);

  return {
    manufacturers,
    setManufacturers,
    units,
    setUnits,
    equipment,
    setEquipment,
  };
}

export function nextId(items) {
  return (
    items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0) + 1
  );
}

export function purgeCatalogueCache() {
  window.localStorage.removeItem('dropshipsimulator:catalogue:manufacturers');
  window.localStorage.removeItem('dropshipsimulator:catalogue:units');
  window.localStorage.removeItem('dropshipsimulator:catalogue:equipment');
  window.location.reload();
}
