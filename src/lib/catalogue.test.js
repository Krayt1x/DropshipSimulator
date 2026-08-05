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
