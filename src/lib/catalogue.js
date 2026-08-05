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
import { useLocalStorageState } from './storage.js';
import manufacturersSeed from '../data/manufacturers.json';
import unitsSeed from '../data/units.json';
import equipmentSeed from '../data/equipment.json';

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
