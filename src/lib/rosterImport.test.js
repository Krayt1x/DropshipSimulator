import { describe, it, expect } from 'vitest';
import { parseRosterExport } from './rosterImport.js';

const manufacturers = ['Corp A'];
const units = [
  { id: 1, name: 'A10', manufacturer: 'Corp A', hp: 10 },
  { id: 2, name: 'A20', manufacturer: 'Corp A', hp: 20 },
];
const equipment = [
  { id: 5, name: 'Long Range Bolt', manufacturer: 'Corp A' },
  { id: 6, name: 'Chicken Legs', manufacturer: 'Corp A' },
];

describe('parseRosterExport', () => {
  it('parses a DropshipBuilder share export into units + equipped ids', () => {
    const text = [
      'Test List (Corp A)',
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
    expect(result.manufacturer).toBe('Corp A');
    expect(result.warnings).toEqual([]);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0].unit.name).toBe('A10');
    expect(result.entries[0].equippedIds).toEqual([5, 6]);
    expect(result.entries[1].unit.name).toBe('A20');
    expect(result.entries[1].equippedIds).toEqual([6]);
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
      'Unrecognized manufacturer "Corp Z" — no units will match.',
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
});
