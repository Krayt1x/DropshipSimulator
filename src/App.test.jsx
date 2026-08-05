import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  within,
} from '@testing-library/react';
import App from './App.jsx';

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.location.hash = '';
});

// The End Game control, dark mode toggle, Dropship Builder link, and
// player identity picker all live behind the settings menu now (#172).
function openSettingsMenu() {
  fireEvent.click(screen.getByRole('button', { name: 'Settings menu' }));
}

describe('App', () => {
  it('shows the End Game control in the top menu only on the Battle page (#132)', () => {
    window.location.hash = '#home';
    render(<App />);
    openSettingsMenu();
    expect(screen.queryByRole('button', { name: 'End Game' })).toBeNull();

    cleanup();
    window.location.hash = '#battle';
    render(<App />);
    openSettingsMenu();
    expect(screen.getByRole('button', { name: 'End Game' })).toBeDefined();
  });

  it('deletes the game after confirming End Game from the top menu (#132)', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    window.location.hash = '#battle';
    render(<App />);
    openSettingsMenu();

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
    openSettingsMenu();

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

  it('renders the in-app list builder at #builder (#188)', () => {
    window.location.hash = '#builder';
    render(<App />);

    expect(screen.getByText('Build your list')).toBeDefined();
  });

  it('renders the catalogue Manage page at #manage, with its own top-nav menu item (#199)', () => {
    window.location.hash = '#manage';
    render(<App />);

    expect(screen.getByText('Manage available models')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Manage' }).className).toContain(
      'active',
    );
  });

  it('gives the Builder page its own top-nav menu item (#192)', () => {
    window.location.hash = '#play';
    render(<App />);

    const builderLink = screen.getByRole('link', { name: 'Builder' });
    expect(builderLink).toHaveProperty(
      'href',
      expect.stringContaining('#builder'),
    );
    expect(builderLink.className).not.toContain('active');

    cleanup();
    window.location.hash = '#builder';
    render(<App />);
    expect(screen.getByRole('link', { name: 'Builder' }).className).toContain(
      'active',
    );
  });

  it('moves Builder/Manage into the settings menu, with dark mode last (#217)', () => {
    window.location.hash = '#play';
    render(<App />);

    const siteMenu = screen
      .getByRole('button', { name: 'Site menu' })
      .parentElement.querySelector('.topnav-links');
    expect(within(siteMenu).queryByRole('link', { name: 'Builder' })).toBeNull();
    expect(within(siteMenu).queryByRole('link', { name: 'Manage' })).toBeNull();

    const settingsMenu = screen
      .getByRole('button', { name: 'Settings menu' })
      .parentElement.querySelector('.topnav-settings-menu');
    expect(
      within(settingsMenu).getByRole('link', { name: 'Builder' }),
    ).toBeDefined();
    expect(
      within(settingsMenu).getByRole('link', { name: 'Manage' }),
    ).toBeDefined();

    // Dark mode toggle is the last item, regardless of what else shows.
    expect(settingsMenu.lastElementChild).toBe(
      screen.getByRole('button', { name: 'Toggle dark mode' }),
    );
  });

  it('portals the turn tracker into the top menu bar and drops the battle board blurb (#136)', () => {
    window.location.hash = '#battle';
    const { container } = render(<App />);

    const slot = container.querySelector('#topnav-turn-slot');
    expect(slot).not.toBeNull();
    expect(slot.querySelector('.split-tracker')).not.toBeNull();
    expect(
      slot.contains(screen.getByRole('button', { name: 'End Turn' })),
    ).toBe(true);

    expect(screen.queryByText(/Place units from the catalogue/)).toBeNull();
  });
});
