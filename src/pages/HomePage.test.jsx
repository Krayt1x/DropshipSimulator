import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import HomePage from './HomePage.jsx';

afterEach(cleanup);

describe('HomePage (#235)', () => {
  it('marks the Play/Map editor grid so it stays 2-up on mobile instead of stacking', () => {
    render(<HomePage />);

    const grid = screen.getByRole('link', { name: /Play/ }).closest('.home-tile-grid');
    expect(grid.className).toContain('two-col-mobile-grid');
    expect(
      screen.getByRole('link', { name: /Map editor/ }).closest('.home-tile-grid'),
    ).toBe(grid);
  });

  it('shows the app version and commit hash at the bottom (#272)', () => {
    render(<HomePage />);

    expect(
      screen.getByText(new RegExp(`v${__APP_VERSION__}`)),
    ).toBeDefined();
    expect(screen.getByText(new RegExp(__COMMIT_HASH__))).toBeDefined();
  });
});
