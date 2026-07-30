import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import PlayPage from './PlayPage.jsx';

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.location.hash = '';
});

describe('PlayPage', () => {
  it('hides Resume Game when there is no active game', () => {
    render(<PlayPage />);
    expect(screen.queryByText('Resume Game')).toBeNull();
  });

  it('shows Resume Game above the tiles when a game is in progress', () => {
    window.localStorage.setItem(
      'dropshipsimulator:battle:tokens',
      JSON.stringify([{ id: 'token-1' }]),
    );
    render(<PlayPage />);
    expect(screen.getByText('Resume Game')).toBeDefined();
    expect(screen.getByRole('link', { name: /Resume Game/ })).toHaveProperty(
      'href',
      expect.stringContaining('#battle'),
    );
  });

  it('links straight to #battle instead of showing the mode picker when a game is already in progress', () => {
    window.localStorage.setItem(
      'dropshipsimulator:battle:tokens',
      JSON.stringify([{ id: 'token-1' }]),
    );
    render(<PlayPage />);
    expect(
      screen.getByRole('link', { name: /Single Player/ }),
    ).toHaveProperty('href', expect.stringContaining('#battle'));
    expect(screen.queryByText('How do you want to play?')).toBeNull();
  });

  it('offers Sandbox vs Computer before starting a fresh single-player game', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    expect(screen.getByText('How do you want to play?')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Sandbox' }));

    expect(window.location.hash).toBe('#battle');
    expect(window.localStorage.getItem('dropshipsimulator:gameMode')).toBe(
      JSON.stringify('sandbox'),
    );
  });

  it('asks for a difficulty before starting a vs-computer game', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: 'vs Computer' }));
    expect(screen.getByText('Choose a difficulty')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Tactical' }));

    expect(window.location.hash).toBe('#battle');
    expect(window.localStorage.getItem('dropshipsimulator:gameMode')).toBe(
      JSON.stringify('vs-computer'),
    );
    expect(
      window.localStorage.getItem('dropshipsimulator:botDifficulty'),
    ).toBe(JSON.stringify('tactical'));
    // The human always plays Player 1 against the bot.
    expect(window.localStorage.getItem('dropshipsimulator:myPlayer')).toBe(
      JSON.stringify('p1'),
    );
  });

  it('Cancel dismisses the mode picker without starting a game', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('How do you want to play?')).toBeNull();
    expect(window.location.hash).toBe('');
  });
});
