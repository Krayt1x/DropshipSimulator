import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import MapViewPage from './MapViewPage.jsx';
import { DEFAULT_MAPS } from '../lib/maps.js';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('MapViewPage (#218, #223)', () => {
  it('shows just two tiles: Pre-made maps and Map creator', () => {
    render(<MapViewPage />);

    expect(
      screen.getByRole('button', { name: /Pre-made maps/ }),
    ).toBeDefined();
    const creatorTile = screen.getByRole('link', { name: /Map creator/ });
    expect(creatorTile).toHaveProperty('href', expect.stringContaining('#map/edit'));
  });

  it('opens a modal listing every pre-made layout when Pre-made maps is pressed', () => {
    render(<MapViewPage />);

    expect(screen.queryByText('Choose a map')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Pre-made maps/ }));

    expect(screen.getByText('Choose a map')).toBeDefined();
    for (const map of DEFAULT_MAPS) {
      expect(screen.getByRole('button', { name: new RegExp(map.name) })).toBeDefined();
    }
  });

  it('loads the chosen layout into the Map Editor localStorage keys, closes the modal, and stays on the page', () => {
    render(<MapViewPage />);

    fireEvent.click(screen.getByRole('button', { name: /Pre-made maps/ }));
    fireEvent.click(screen.getByRole('button', { name: /Blank/ }));

    const blank = DEFAULT_MAPS.find((m) => m.name === 'Blank');
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:dimensions')),
    ).toEqual(blank.dimensions);
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:tileTypes')),
    ).toEqual(blank.tileTypes);
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:tiles')),
    ).toEqual(blank.tiles);
    expect(screen.queryByText('Choose a map')).toBeNull();
    expect(screen.getByRole('link', { name: /Map creator/ })).toBeDefined();
  });

  it('shows which map was last loaded on the Map creator tile', () => {
    render(<MapViewPage />);

    fireEvent.click(screen.getByRole('button', { name: /Pre-made maps/ }));
    fireEvent.click(screen.getByRole('button', { name: /Map 1/ }));

    expect(screen.getByText(/Currently: Map 1/)).toBeDefined();
  });

  it('cancels out of the picker without loading anything', () => {
    window.localStorage.setItem(
      'dropshipsimulator:mapEditor:tiles',
      JSON.stringify({ '0,0': 'plain' }),
    );

    render(<MapViewPage />);
    fireEvent.click(screen.getByRole('button', { name: /Pre-made maps/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Choose a map')).toBeNull();
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:tiles')),
    ).toEqual({ '0,0': 'plain' });
  });

  it('marks the map picker grid so it stays a grid on mobile instead of stacking (#234)', () => {
    render(<MapViewPage />);
    fireEvent.click(screen.getByRole('button', { name: /Pre-made maps/ }));

    const grid = screen.getByText('Choose a map').nextElementSibling;
    expect(grid.className).toContain('two-col-mobile-grid');
  });
});
