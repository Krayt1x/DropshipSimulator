import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import MapEditorPage from './MapEditorPage.jsx';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('MapEditorPage', () => {
  it('restores a built-in terrain type an older save is missing, on load (#194)', () => {
    window.localStorage.setItem(
      'dropshipsimulator:mapEditor:tileTypes',
      JSON.stringify([
        { id: 'plain', name: 'Plain', color: '#78716c' },
        { id: 'buildings', name: 'Buildings', color: '#9ca3af' },
      ]),
    );

    render(<MapEditorPage />);

    expect(screen.getByRole('button', { name: 'Forest' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Water' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Objective' })).toBeDefined();
  });

  it('paints a hex with the selected terrain type', () => {
    render(<MapEditorPage />);

    const hex = screen.getByTestId('hex-0,0');
    expect(hex.getAttribute('style') ?? '').not.toContain('background-color');

    fireEvent.click(hex);
    expect(hex.style.fill).toBe('rgb(120, 113, 108)');
  });

  it('erases a painted hex when the eraser tool is active', () => {
    render(<MapEditorPage />);

    const hex = screen.getByTestId('hex-0,0');
    fireEvent.click(hex);
    expect(hex.style.fill).toBe('rgb(120, 113, 108)');

    fireEvent.click(screen.getByRole('button', { name: /eraser/i }));
    fireEvent.click(hex);
    expect(hex.style.fill).toBe('');
  });

  it('adds a new terrain type and selects it as the active tool', () => {
    render(<MapEditorPage />);

    fireEvent.change(screen.getByLabelText('New terrain type'), {
      target: { value: 'Rubble' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add terrain type' }));

    expect(screen.getByRole('button', { name: 'Rubble' }).className).toContain(
      'selected',
    );
  });

  it('lets a new terrain type block line of sight and/or movement (#178)', () => {
    render(<MapEditorPage />);

    fireEvent.change(screen.getByLabelText('New terrain type'), {
      target: { value: 'Rubble' },
    });
    fireEvent.click(screen.getByLabelText('Blocks line of sight'));
    fireEvent.click(screen.getByLabelText('Blocks movement'));
    fireEvent.click(screen.getByRole('button', { name: 'Add terrain type' }));

    const stored = JSON.parse(
      window.localStorage.getItem('dropshipsimulator:mapEditor:tileTypes'),
    );
    const rubble = stored.find((t) => t.name === 'Rubble');
    expect(rubble.blocksLineOfSight).toBe(true);
    expect(rubble.blocksMovement).toBe(true);
    expect(rubble.isObjective).toBe(false);
  });

  it('shows a pill for each status effect a terrain type has set (#215)', () => {
    render(<MapEditorPage />);

    // Buildings blocks both movement and line of sight; Plain blocks
    // neither and gets no pills at all.
    const buildingsRow = screen
      .getByRole('button', { name: 'Buildings' })
      .closest('.tile-swatch-row');
    expect(
      within(buildingsRow).getByText('Blocks movement'),
    ).toBeDefined();
    expect(within(buildingsRow).getByText('Blocks LOS')).toBeDefined();
    expect(within(buildingsRow).queryByText('Objective')).toBeNull();

    const plainRow = screen
      .getByRole('button', { name: 'Plain' })
      .closest('.tile-swatch-row');
    expect(within(plainRow).queryByText('Blocks movement')).toBeNull();
    expect(within(plainRow).queryByText('Blocks LOS')).toBeNull();

    // Objective blocks both, per #194's fix to its default flags.
    const objectiveRow = screen
      .getByRole('button', { name: 'Objective' })
      .closest('.tile-swatch-row');
    expect(
      within(objectiveRow).getByText('Objective', {
        selector: '.terrain-flag-pill-objective',
      }),
    ).toBeDefined();
    expect(
      within(objectiveRow).getByText('Blocks movement'),
    ).toBeDefined();

    // The pills don't leak into the button's accessible name.
    expect(screen.getByRole('button', { name: 'Buildings' })).toBeDefined();
  });

  it('resizes the board and drops out-of-range tiles', () => {
    render(<MapEditorPage />);

    fireEvent.click(screen.getByTestId('hex-0,0'));

    const colsInput = screen.getByLabelText('Columns');
    fireEvent.change(colsInput, { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Rows'), {
      target: { value: '2' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resize board' }));

    expect(screen.queryByTestId('hex-3,3')).toBeNull();
    expect(screen.getByTestId('hex-0,0').style.fill).toBe('rgb(120, 113, 108)');
  });

  it('exports the current map as JSON reflecting a painted tile (#176)', () => {
    render(<MapEditorPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Water' }));
    fireEvent.click(screen.getByTestId('hex-1,1'));

    const exportText = screen.getByLabelText('Export').value;
    const exported = JSON.parse(exportText);
    expect(exported.tiles['1,1']).toBe('water');
    expect(exported.dimensions).toEqual({ cols: 24, rows: 24 });
  });

  it('imports a pasted map export and repaints the board to match (#176)', () => {
    render(<MapEditorPage />);

    const imported = JSON.stringify({
      dimensions: { cols: 3, rows: 3 },
      tileTypes: [{ id: 'plain', name: 'Plain', color: '#78716c' }],
      tiles: { '0,0': 'plain' },
    });
    fireEvent.change(screen.getByLabelText('Import'), {
      target: { value: imported },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    expect(screen.getByText(/3 × 3/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Use this map' }));

    expect(screen.queryByTestId('hex-5,5')).toBeNull();
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:dimensions')),
    ).toEqual({ cols: 3, rows: 3 });
  });
});
