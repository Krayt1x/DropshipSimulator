import { describe, it, expect } from 'vitest';
import { parseRosterExport } from './rosterImport.js';
import { DEFAULT_ROSTERS } from '../components/RosterImport.jsx';
import realUnits from '../data/units.json';
import realEquipment from '../data/equipment.json';
import realManufacturers from '../data/manufacturers.json';

const manufacturers = ['Central Order'];
const units = [
  { id: 1, name: 'A10', manufacturer: 'Central Order', hp: 10 },
  { id: 2, name: 'A20', manufacturer: 'Central Order', hp: 20 },
];
const equipment = [
  { id: 5, name: 'Long Range Bolt', manufacturer: 'Central Order' },
  { id: 6, name: 'Chicken Legs', manufacturer: 'Central Order' },
];

describe('parseRosterExport', () => {
  it('parses a DropshipBuilder share export into units + equipped ids', () => {
    const text = [
      'Test List (Central Order)',
      'Weight: 16t / 100t',
      '',
      'A10 - 6t',
      '  Left: Long Range Bolt',
      '  Movement: Chicken Legs',
      '',
      'A20 - 10t',
      '  Movement: Chicken Legs',
    ].join('\n');

    const result = parseRosterExport(text, { units, manufacturers, equipment });

    expect(result.listName).toBe('Test List');
    expect(result.manufacturer).toBe('Central Order');
    expect(result.warnings).toEqual([]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].unit.name).toBe('A10');
    expect(result.entries[0].equippedIds).toEqual([5, 6]);
    expect(result.entries[0].equippedSides).toEqual(['left', undefined]);
    expect(result.entries[1].unit.name).toBe('A20');
    expect(result.entries[1].equippedIds).toEqual([6]);
    expect(result.entries[1].equippedSides).toEqual([undefined]);
  });

  it('matches units against the unit list even with a "(N)" duplicate-copy suffix, keeping it as a label (#151)', () => {
    const text = [
      'Test List (Central Order)',
      'Weight: 12t / 100t',
      '',
      'A10 (1) - 6t',
      '  Left: Long Range Bolt',
      '',
      'A10 (2) - 6t',
    ].join('\n');

    const result = parseRosterExport(text, { units, manufacturers, equipment });

    expect(result.warnings).toEqual([]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].unit.name).toBe('A10');
    expect(result.entries[0].label).toBe('(1)');
    expect(result.entries[0].equippedIds).toEqual([5]);
    expect(result.entries[1].unit.name).toBe('A10');
    expect(result.entries[1].label).toBe('(2)');
  });

  it("captures Left/Right slot labels as each weapon's mounted side", () => {
    const text = [
      'Test List (Central Order)',
      'Weight: 6t / 100t',
      '',
      'A10 - 6t',
      '  Left: Long Range Bolt',
      '  Right: Long Range Bolt',
    ].join('\n');

    const result = parseRosterExport(text, { units, manufacturers, equipment });

    expect(result.entries[0].equippedIds).toEqual([5, 5]);
    expect(result.entries[0].equippedSides).toEqual(['left', 'right']);
  });

  it('also captures the raw slot label (including Head) separately for Heat Sink grouping (#245)', () => {
    const text = [
      'Test List (Central Order)',
      'Weight: 6t / 100t',
      '',
      'A10 - 6t',
      '  Head: Long Range Bolt',
      '  Left: Long Range Bolt',
      '  Right: Long Range Bolt',
      '  Movement: Chicken Legs',
    ].join('\n');

    const result = parseRosterExport(text, { units, manufacturers, equipment });

    // equippedSlots always tracks the raw label, unlike equippedSides, which
    // only ever holds 'left'/'right' for arc-restriction purposes (#92).
    expect(result.entries[0].equippedSlots).toEqual([
      'head',
      'left',
      'right',
      'movement',
    ]);
    expect(result.entries[0].equippedSides).toEqual([
      undefined,
      'left',
      'right',
      undefined,
    ]);
  });

  it('warns on an unrecognized manufacturer and unknown names, without crashing', () => {
    const text = [
      'Test List (Corp Z)',
      'Weight: 6t / 100t',
      '',
      'Mystery Mech - 6t',
      '  Left: Mystery Gun',
    ].join('\n');

    const result = parseRosterExport(text, { units, manufacturers, equipment });

    expect(result.entries).toHaveLength(0);
    expect(result.warnings).toContain(
      'Unrecognized faction "Corp Z" — no units will match.',
    );
    expect(result.warnings).toContain('Unknown unit "Mystery Mech" — skipped.');
  });

  it('reports an error when the header line is missing', () => {
    const result = parseRosterExport('not a valid export', {
      units,
      manufacturers,
      equipment,
    });
    expect(result.entries).toEqual([]);
    expect(result.warnings[0]).toMatch(/DropshipBuilder share export/);
  });

  it.each(DEFAULT_ROSTERS)(
    'parses the "$name" default roster against real data with no warnings (#170)',
    ({ text }) => {
      const result = parseRosterExport(text, {
        units: realUnits,
        manufacturers: realManufacturers,
        equipment: realEquipment,
      });
      expect(result.warnings).toEqual([]);
      expect(result.entries.length).toBeGreaterThan(0);
    },
  );
});
