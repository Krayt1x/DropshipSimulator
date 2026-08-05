import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import MapThumbnail from './MapThumbnail.jsx';

afterEach(cleanup);

describe('MapThumbnail (#226)', () => {
  it('renders one hex polygon per tile in the grid', () => {
    const { container } = render(
      <MapThumbnail
        dimensions={{ cols: 3, rows: 2 }}
        tileTypes={[{ id: 'plain', color: '#78716c' }]}
        tiles={{}}
      />,
    );

    expect(container.querySelectorAll('polygon')).toHaveLength(6);
  });

  it('colors each hex by its terrain type, falling back to a neutral fill for unset tiles', () => {
    const { container } = render(
      <MapThumbnail
        dimensions={{ cols: 2, rows: 1 }}
        tileTypes={[{ id: 'water', color: '#3b82f6' }]}
        tiles={{ '0,0': 'water' }}
      />,
    );

    const polygons = container.querySelectorAll('polygon');
    expect(polygons[0].getAttribute('fill')).toBe('#3b82f6');
    expect(polygons[1].getAttribute('fill')).toBe('var(--bg-track)');
  });
});
