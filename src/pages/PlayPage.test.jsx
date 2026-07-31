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
    expect(screen.getByRole('link', { name: /Single Player/ })).toHaveProperty(
      'href',
      expect.stringContaining('#battle'),
    );
    expect(screen.queryByText('How do you want to play?')).toBeNull();
  });

  it('offers Sandbox vs Computer before starting a fresh single-player game', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    expect(screen.getByText('How do you want to play?')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Sandbox' }));

    // Picking a mode doesn't start the game yet — the map step still needs
    // an answer (#176).
    expect(window.location.hash).toBe('');
    expect(screen.getByText('Which map do you want to play?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(window.localStorage.getItem('dropshipsimulator:gameMode')).toBe(
      JSON.stringify('sandbox'),
    );
  });

  it('asks for a difficulty, then a roster, then a map, before starting a vs-computer game (#173, #176)', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: 'vs Computer' }));
    expect(screen.getByText('Choose a difficulty')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Tactical' }));

    expect(
      screen.getByText('Which list should the computer play?'),
    ).toBeDefined();
    // Choosing a difficulty alone doesn't start the game yet — the roster
    // step still needs an answer.
    expect(window.location.hash).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Random' }));

    // Nor does picking a roster — the map step comes next (#176).
    expect(window.location.hash).toBe('');
    expect(screen.getByText('Which map do you want to play?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(window.localStorage.getItem('dropshipsimulator:gameMode')).toBe(
      JSON.stringify('vs-computer'),
    );
    expect(window.localStorage.getItem('dropshipsimulator:botDifficulty')).toBe(
      JSON.stringify('tactical'),
    );
    // The human always plays Player 1 against the bot.
    expect(window.localStorage.getItem('dropshipsimulator:myPlayer')).toBe(
      JSON.stringify('p1'),
    );
    expect(window.localStorage.getItem('dropshipsimulator:botRoster')).toBe(
      JSON.stringify({ type: 'random' }),
    );
  });

  it('lets the human pick a specific default roster for the bot (#173)', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: 'vs Computer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simple' }));
    fireEvent.click(screen.getByRole('button', { name: 'Specific' }));

    fireEvent.change(screen.getByLabelText('List'), {
      target: { value: 'Flame Chicken Spam' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Use this list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(window.localStorage.getItem('dropshipsimulator:botRoster')).toBe(
      JSON.stringify({ type: 'specific', name: 'Flame Chicken Spam' }),
    );
  });

  it('lets the human import a custom roster for the bot to play (#173)', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: 'vs Computer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simple' }));
    fireEvent.click(screen.getByRole('button', { name: 'Specific' }));

    fireEvent.change(screen.getByLabelText('List'), {
      target: { value: '__import__' },
    });

    const rosterText = [
      'Test List (Corp A)',
      'Weight: 6t / 100t',
      '',
      'A10 - 6t',
    ].join('\n');
    fireEvent.change(screen.getByLabelText('Roster export'), {
      target: { value: rosterText },
    });

    expect(screen.getByRole('button', { name: 'Use this list' }).disabled).toBe(
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preview import' }));
    expect(screen.getByText('1 unit found.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Use this list' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(window.localStorage.getItem('dropshipsimulator:botRoster')).toBe(
      JSON.stringify({ type: 'import', text: rosterText }),
    );
  });

  it('lets the human start a fresh blank map instead of whatever is in the Map Editor (#176)', () => {
    window.localStorage.setItem(
      'dropshipsimulator:mapEditor:tiles',
      JSON.stringify({ '0,0': 'buildings' }),
    );
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sandbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'Blank' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:tiles')),
    ).toEqual({});
  });

  it('leaves the saved map alone when "Current map" is kept (#176)', () => {
    window.localStorage.setItem(
      'dropshipsimulator:mapEditor:tiles',
      JSON.stringify({ '0,0': 'buildings' }),
    );
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Sandbox' }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:tiles')),
    ).toEqual({ '0,0': 'buildings' });
  });

  it('Cancel dismisses the mode picker without starting a game', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('How do you want to play?')).toBeNull();
    expect(window.location.hash).toBe('');
  });
});
