import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useCatalogue, nextId, purgeCatalogueCache } from './catalogue.js';
import manufacturersSeed from '../data/manufacturers.json';
import unitsSeed from '../data/units.json';
import equipmentSeed from '../data/equipment.json';

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('nextId', () => {
  it('returns one past the highest existing id', () => {
    expect(nextId([{ id: 1 }, { id: 5 }, { id: 3 }])).toBe(6);
  });

  it('returns 1 for an empty catalogue', () => {
    expect(nextId([])).toBe(1);
  });
});

describe('useCatalogue (#199)', () => {
  it('seeds from the bundled JSON when nothing is stored yet', () => {
    const { result } = renderHook(() => useCatalogue());
    expect(result.current.manufacturers).toEqual(manufacturersSeed);
    expect(result.current.units).toEqual(unitsSeed);
    expect(result.current.equipment).toEqual(equipmentSeed);
  });

  it('persists an edit and shares it with every other mounted instance', () => {
    const a = renderHook(() => useCatalogue());
    const b = renderHook(() => useCatalogue());

    act(() => {
      a.result.current.setManufacturers((current) => [...current, 'Homebrew Corp']);
    });

    expect(a.result.current.manufacturers).toContain('Homebrew Corp');
    expect(b.result.current.manufacturers).toContain('Homebrew Corp');
    expect(
      JSON.parse(
        window.localStorage.getItem('dropshipsimulator:catalogue:manufacturers'),
      ),
    ).toContain('Homebrew Corp');
  });

  it('migrates a cached catalogue still carrying the pre-rename Corp A/B names (#312)', () => {
    // Machines (and its own units/equipment) is already present here so
    // this test stays isolated to the rename migration — the #314 test
    // below covers a manufacturer actually being new to the cache.
    window.localStorage.setItem(
      'dropshipsimulator:catalogue:manufacturers',
      JSON.stringify(['Corp A', 'Corp B', 'Machines', 'Homebrew Corp']),
    );
    window.localStorage.setItem(
      'dropshipsimulator:catalogue:units',
      JSON.stringify([
        { id: 1, name: 'A10', manufacturer: 'Corp A' },
        { id: 7, name: 'Drone', manufacturer: 'Corp B' },
        ...unitsSeed.filter((u) => u.manufacturer === 'Machines'),
        // A user's own custom unit for a manufacturer that was never
        // renamed — must survive the migration untouched.
        { id: 999, name: 'Homebrew Mech', manufacturer: 'Homebrew Corp' },
      ]),
    );
    window.localStorage.setItem(
      'dropshipsimulator:catalogue:equipment',
      JSON.stringify([
        {
          id: 17,
          name: 'Corp A Heat Management Module',
          manufacturer: 'Corp A',
        },
        ...equipmentSeed.filter((e) => e.manufacturer === 'Machines'),
        { id: 999, name: 'Homebrew Gun', manufacturer: 'Homebrew Corp' },
      ]),
    );

    const { result, rerender } = renderHook(() => useCatalogue());
    rerender();

    expect(result.current.manufacturers).toEqual([
      'Central Order',
      'The Hive',
      'Machines',
      'Homebrew Corp',
    ]);
    expect(result.current.units).toEqual([
      { id: 1, name: 'A10', manufacturer: 'Central Order' },
      { id: 7, name: 'Drone', manufacturer: 'The Hive' },
      ...unitsSeed.filter((u) => u.manufacturer === 'Machines'),
      { id: 999, name: 'Homebrew Mech', manufacturer: 'Homebrew Corp' },
    ]);
    expect(result.current.equipment).toEqual([
      {
        id: 17,
        name: 'Central Order Heat Management Module',
        manufacturer: 'Central Order',
      },
      ...equipmentSeed.filter((e) => e.manufacturer === 'Machines'),
      { id: 999, name: 'Homebrew Gun', manufacturer: 'Homebrew Corp' },
    ]);
  });

  it('does nothing when the cached catalogue has no pre-rename names left', () => {
    const { result, rerender } = renderHook(() => useCatalogue());
    rerender();
    expect(result.current.manufacturers).toEqual(manufacturersSeed);
    expect(result.current.units).toEqual(unitsSeed);
    expect(result.current.equipment).toEqual(equipmentSeed);
  });

  it('syncs in a brand-new seed manufacturer a cached catalogue predates (#314)', () => {
    // A cache from before Machines existed — also missing an A20 the player
    // deleted from Central Order via the Manage page, which must NOT
    // reappear (only a manufacturer that's entirely new to this cache gets
    // synced, existing ones are left exactly as the player left them).
    window.localStorage.setItem(
      'dropshipsimulator:catalogue:manufacturers',
      JSON.stringify(['Central Order', 'The Hive', 'Homebrew Corp']),
    );
    window.localStorage.setItem(
      'dropshipsimulator:catalogue:units',
      JSON.stringify([
        unitsSeed.find((u) => u.name === 'A10'),
        { id: 999, name: 'Homebrew Mech', manufacturer: 'Homebrew Corp' },
      ]),
    );
    window.localStorage.setItem(
      'dropshipsimulator:catalogue:equipment',
      JSON.stringify([
        equipmentSeed.find((e) => e.name === 'Chicken Legs'),
      ]),
    );

    const { result, rerender } = renderHook(() => useCatalogue());
    rerender();

    expect(result.current.manufacturers).toEqual([
      'Central Order',
      'The Hive',
      'Homebrew Corp',
      'Machines',
    ]);
    const machineUnitNames = result.current.units
      .filter((u) => u.manufacturer === 'Machines')
      .map((u) => u.name);
    expect(machineUnitNames.sort()).toEqual(
      unitsSeed
        .filter((u) => u.manufacturer === 'Machines')
        .map((u) => u.name)
        .sort(),
    );
    const machineEquipmentNames = result.current.equipment
      .filter((e) => e.manufacturer === 'Machines')
      .map((e) => e.name);
    expect(machineEquipmentNames.sort()).toEqual(
      equipmentSeed
        .filter((e) => e.manufacturer === 'Machines')
        .map((e) => e.name)
        .sort(),
    );

    // The deliberately-deleted A20 stays gone — Central Order already
    // existed in the cache, so it's untouched by this sync.
    expect(
      result.current.units.some((u) => u.name === 'A20'),
    ).toBe(false);
    // The player's own homebrew content survives too.
    expect(
      result.current.units.some((u) => u.name === 'Homebrew Mech'),
    ).toBe(true);
  });
});

describe('purgeCatalogueCache', () => {
  it('clears every catalogue key so the next load re-seeds from the bundle', () => {
    window.localStorage.setItem(
      'dropshipsimulator:catalogue:manufacturers',
      JSON.stringify(['Homebrew Corp']),
    );
    window.localStorage.setItem(
      'dropshipsimulator:catalogue:units',
      JSON.stringify([{ id: 999 }]),
    );
    window.localStorage.setItem(
      'dropshipsimulator:catalogue:equipment',
      JSON.stringify([{ id: 999 }]),
    );
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() });

    purgeCatalogueCache();

    expect(
      window.localStorage.getItem('dropshipsimulator:catalogue:manufacturers'),
    ).toBeNull();
    expect(
      window.localStorage.getItem('dropshipsimulator:catalogue:units'),
    ).toBeNull();
    expect(
      window.localStorage.getItem('dropshipsimulator:catalogue:equipment'),
    ).toBeNull();
  });
});
