import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import MapViewPage from './MapViewPage.jsx';
import { DEFAULT_MAPS } from '../lib/maps.js';

beforeEach(() => window.localStorage.clear());
afterEach(cleanup);

describe('MapViewPage (#218)', () => {
  it('lists every pre-made layout plus a "Create your own" tile, all linking to the Creator', () => {
    render(<MapViewPage />);

    const blankTile = screen.getByRole('link', { name: /Blank/ });
    expect(blankTile).toHaveProperty('href', expect.stringContaining('#map/edit'));

    const createTile = screen.getByRole('link', { name: /Create your own/ });
    expect(createTile).toHaveProperty('href', expect.stringContaining('#map/edit'));
  });

  it('loads the chosen layout into the Map Editor localStorage keys when picked', () => {
    render(<MapViewPage />);

    fireEvent.click(screen.getByRole('link', { name: /Blank/ }));

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
  });

  it('leaves the current editor state alone when "Create your own" is picked', () => {
    window.localStorage.setItem(
      'dropshipsimulator:mapEditor:tiles',
      JSON.stringify({ '0,0': 'plain' }),
    );

    render(<MapViewPage />);
    fireEvent.click(screen.getByRole('link', { name: /Create your own/ }));

    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:tiles')),
    ).toEqual({ '0,0': 'plain' });
  });
});
