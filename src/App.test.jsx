import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import App from './App.jsx';

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = '';
});

describe('App', () => {
  it('shows the End Game control in the top menu only on the Battle page (#132)', () => {
    window.location.hash = '#home';
    render(<App />);
    expect(screen.queryByRole('button', { name: 'End Game' })).toBeNull();

    cleanup();
    window.location.hash = '#battle';
    render(<App />);
    expect(screen.getByRole('button', { name: 'End Game' })).toBeDefined();
  });

  it('deletes the game after confirming End Game from the top menu (#132)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.location.hash = '#battle';
    render(<App />);

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: ['Test List (Corp A)', 'Weight: 6t / 100t', '', 'A10 - 6t'].join(
          '\n',
        ),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'End Game' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(
      JSON.parse(
        window.localStorage.getItem('dropshipsimulator:battle:tokens'),
      ),
    ).toEqual([]);
    expect(window.location.hash).toBe('#home');

    confirmSpy.mockRestore();
  });

  it('does not reset the game when End Game is canceled', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    window.location.hash = '#battle';
    render(<App />);

    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: {
        value: ['Test List (Corp A)', 'Weight: 6t / 100t', '', 'A10 - 6t'].join(
          '\n',
        ),
      },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Import 1 unit to reserve' }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'End Game' }));

    expect(confirmSpy).toHaveBeenCalled();
    expect(screen.getByText('Reserve (1)')).toBeDefined();

    confirmSpy.mockRestore();
  });
});
