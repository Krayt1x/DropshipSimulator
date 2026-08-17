import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ManagePage from './ManagePage.jsx';

beforeEach(() => {
  window.localStorage.clear();
  // Every current manufacturer, not just the one these tests exercise —
  // otherwise the #314 new-manufacturer-sync migration in useCatalogue()
  // would treat the others as newly added to this fixture's cache and pull
  // their units/equipment in too, polluting assertions that expect an exact,
  // minimal catalogue.
  window.localStorage.setItem(
    'dropshipsimulator:catalogue:manufacturers',
    JSON.stringify(['Central Order', 'The Hive', 'Machines']),
  );
  window.localStorage.setItem(
    'dropshipsimulator:catalogue:units',
    JSON.stringify([
      {
        id: 1,
        name: 'A10',
        manufacturer: 'Central Order',
        size: 'Small',
        weight: 6,
        armor: '2/2/2/1',
        hp: 5,
      },
    ]),
  );
  window.localStorage.setItem(
    'dropshipsimulator:catalogue:equipment',
    JSON.stringify([]),
  );
});
afterEach(cleanup);

describe('ManagePage (#199)', () => {
  it('adds a new manufacturer and a free Standard Movement item for it', () => {
    render(<ManagePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add faction' }));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Homebrew Corp' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add faction' }));

    expect(
      screen.getByText('Added faction "Homebrew Corp".'),
    ).toBeDefined();
    expect(
      JSON.parse(
        window.localStorage.getItem('dropshipsimulator:catalogue:manufacturers'),
      ),
    ).toContain('Homebrew Corp');
    const equipment = JSON.parse(
      window.localStorage.getItem('dropshipsimulator:catalogue:equipment'),
    );
    expect(equipment).toEqual([
      expect.objectContaining({
        name: 'Standard Movement',
        manufacturer: 'Homebrew Corp',
        type: 'Movement',
      }),
    ]);
  });

  it('adds a unit with 4 separate armor fields, storing them combined (#199)', () => {
    render(<ManagePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Add unit' }));
    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'A20' },
    });
    fireEvent.change(screen.getByLabelText('Front armor'), {
      target: { value: '4' },
    });
    fireEvent.change(screen.getByLabelText('Left armor'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText('Right armor'), {
      target: { value: '3' },
    });
    fireEvent.change(screen.getByLabelText('Rear armor'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add unit' }));

    const units = JSON.parse(
      window.localStorage.getItem('dropshipsimulator:catalogue:units'),
    );
    const added = units.find((u) => u.name === 'A20');
    expect(added.armor).toBe('4/3/3/2');
    expect(screen.getByText('4/3/3/2')).toBeDefined();
  });

  it('pre-fills the edit form from the combined armor string, and saves it back combined', () => {
    render(<ManagePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByLabelText('Front armor').value).toBe('2');
    expect(screen.getByLabelText('Left armor').value).toBe('2');
    expect(screen.getByLabelText('Right armor').value).toBe('2');
    expect(screen.getByLabelText('Rear armor').value).toBe('1');

    fireEvent.change(screen.getByLabelText('Front armor'), {
      target: { value: '9' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    const units = JSON.parse(
      window.localStorage.getItem('dropshipsimulator:catalogue:units'),
    );
    expect(units[0].armor).toBe('9/2/2/1');
  });

  it('deletes a unit from the catalogue', () => {
    render(<ManagePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    const units = JSON.parse(
      window.localStorage.getItem('dropshipsimulator:catalogue:units'),
    );
    expect(units).toEqual([]);
    expect(screen.getByText(/Removed "A10"/)).toBeDefined();
  });

  it('purges the local catalogue only after the user confirms', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.stubGlobal('location', { ...window.location, reload: vi.fn() });
    render(<ManagePage />);

    fireEvent.click(screen.getByRole('button', { name: 'Purge cache' }));
    expect(
      window.localStorage.getItem('dropshipsimulator:catalogue:units'),
    ).not.toBeNull();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole('button', { name: 'Purge cache' }));
    expect(
      window.localStorage.getItem('dropshipsimulator:catalogue:units'),
    ).toBeNull();

    confirmSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
