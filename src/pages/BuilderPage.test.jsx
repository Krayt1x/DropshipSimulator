import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BuilderPage from './BuilderPage.jsx';

const manufacturers = ['Corp A'];
const units = [
  { id: 1, name: 'A10', manufacturer: 'Corp A', size: 'Medium', weight: 10 },
];
const movementItem = {
  id: 1,
  name: 'Heavy Legs',
  manufacturer: 'Corp A',
  type: 'Movement',
  weight: 2,
  movement: 5,
};
const weaponItem = {
  id: 2,
  name: 'Long Range Bolt',
  manufacturer: 'Corp A',
  type: 'Weapon',
  weight: 4,
  size: 'Large',
  range: '9',
  heat_rating: '4/6',
  hit_dice: '2d8',
  hp: 5,
};

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.location.hash = '';
});

function goToBuilder() {
  fireEvent.click(screen.getByRole('button', { name: /Build roster/ }));
}

describe('BuilderPage', () => {
  it('adds a catalog unit to the roster', () => {
    render(
      <BuilderPage
        manufacturers={manufacturers}
        units={units}
        equipment={[]}
      />,
    );
    goToBuilder();

    expect(screen.getByText('No units added yet.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(screen.queryByText('No units added yet.')).toBeNull();
    expect(screen.getAllByText('A10')).toHaveLength(2);
  });

  it('removes a unit from the roster', () => {
    render(
      <BuilderPage
        manufacturers={manufacturers}
        units={units}
        equipment={[]}
      />,
    );
    goToBuilder();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(screen.getByText('No units added yet.')).toBeDefined();
  });

  it('disables "Use this list" until at least one unit is added, then hands off a battle-ready roster (#188)', () => {
    render(
      <BuilderPage
        manufacturers={manufacturers}
        units={units}
        equipment={[movementItem, weaponItem]}
      />,
    );
    goToBuilder();

    expect(
      screen.getByRole('button', { name: 'Use this list' }).disabled,
    ).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(screen.getByRole('button', { name: 'Use this list' }));

    expect(window.location.hash).toBe('#battle');
    const handoff = JSON.parse(
      window.localStorage.getItem('dropshipsimulator:builder:handoff'),
    );
    expect(handoff.manufacturer).toBe('Corp A');
    expect(handoff.entries).toHaveLength(1);
    expect(handoff.entries[0].unit.name).toBe('A10');
    // The unit's cheapest Movement item auto-equips on Add (mirroring
    // DropshipBuilder's own builder), so the handoff already carries it.
    expect(handoff.entries[0].equippedIds).toEqual([1]);
  });

  it('numbers duplicate units, keeping the catalog copy unnumbered', () => {
    render(
      <BuilderPage
        manufacturers={manufacturers}
        units={units}
        equipment={[]}
      />,
    );
    goToBuilder();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getAllByText('A10')).toHaveLength(2);
    expect(screen.queryByText('A10 (1)')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getAllByText('A10')).toHaveLength(1);
    expect(screen.getByText('A10 (1)')).toBeDefined();
    expect(screen.getByText('A10 (2)')).toBeDefined();
  });
});
