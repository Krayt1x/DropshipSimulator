import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
} from '@testing-library/react';
import PlayPage from './PlayPage.jsx';

beforeEach(() => window.localStorage.clear());
afterEach(() => {
  cleanup();
  window.location.hash = '';
  vi.unstubAllGlobals();
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

  it('offers Sandbox and Vs CPU tiles before starting a fresh single-player game (#184)', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    expect(screen.getByText('How do you want to play?')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Sandbox/ }));

    // Picking a mode doesn't start the game yet — the map stage still needs
    // an answer (#176), and stays visible below the mode tiles rather than
    // replacing them (#184).
    expect(window.location.hash).toBe('');
    expect(
      screen.getByRole('button', { name: /Sandbox/ }).className,
    ).toContain('selected');
    expect(screen.getByText('Which map do you want to play?')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(window.localStorage.getItem('dropshipsimulator:gameMode')).toBe(
      JSON.stringify('sandbox'),
    );
  });

  it('asks for a difficulty, then a roster, then a map, before starting a vs-computer game (#173, #176, #184)', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    expect(screen.getByText('Choose a difficulty')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /Tactical/ }));

    // Picking a difficulty alone doesn't start the game yet — a
    // manufacturer (#198) and then a roster still need an answer.
    expect(window.location.hash).toBe('');
    const botManufacturerStage = screen
      .getByText('Which manufacturer should the computer play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(botManufacturerStage).getByRole('button', { name: 'Corp A' }),
    );

    expect(
      screen.getByText('Which list should the computer play?'),
    ).toBeDefined();
    expect(window.location.hash).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Random' }));

    // Nor does picking the bot's roster — the human picks their own list
    // next (#202), then the map stage (#176).
    expect(window.location.hash).toBe('');
    const playerManufacturerStage = screen
      .getByText('Which manufacturer will you play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(playerManufacturerStage).getByRole('button', { name: 'Corp A' }),
    );
    expect(screen.getByText('Which list will you play?')).toBeDefined();
    expect(window.location.hash).toBe('');
    const playerRosterStage = screen
      .getByText('Which list will you play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(playerRosterStage).getByRole('button', { name: 'Random' }),
    );

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
      JSON.stringify({ type: 'random', manufacturer: 'Corp A' }),
    );
    expect(window.localStorage.getItem('dropshipsimulator:playerRoster')).toBe(
      JSON.stringify({ type: 'random', manufacturer: 'Corp A' }),
    );
  });

  it('lists each catalogue manufacturer, then only that manufacturer\'s default rosters (#198)', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    fireEvent.click(screen.getByRole('button', { name: /Simple/ }));

    expect(
      screen.getByText('Which manufacturer should the computer play?'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Corp A' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Corp B' })).toBeDefined();
    // The roster stage doesn't appear until a manufacturer is chosen.
    expect(
      screen.queryByText('Which list should the computer play?'),
    ).toBeNull();

    // Corp B has no default rosters in this catalogue — only Random and
    // Import should be on offer, with a note explaining why.
    fireEvent.click(screen.getByRole('button', { name: 'Corp B' }));
    expect(screen.getByRole('button', { name: 'Random' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Import…' })).toBeDefined();
    expect(screen.queryByText('Default A Corp List')).toBeNull();
    expect(screen.getByText(/No default lists for Corp B yet/)).toBeDefined();

    // Switching to Corp A shows its own default rosters instead.
    fireEvent.click(screen.getByRole('button', { name: 'Corp A' }));
    expect(
      screen.getByRole('button', { name: 'Default A Corp List' }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Flame Chicken Spam' }),
    ).toBeDefined();
  });

  it("lets the human pick a specific default roster for the bot straight off the list (#173, #184)", () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    fireEvent.click(screen.getByRole('button', { name: /Simple/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Corp A' }));

    fireEvent.click(
      screen.getByRole('button', { name: 'Flame Chicken Spam' }),
    );
    expect(
      screen.getByRole('button', { name: 'Flame Chicken Spam' }).className,
    ).toContain('selected');

    const playerManufacturerStage = screen
      .getByText('Which manufacturer will you play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(playerManufacturerStage).getByRole('button', { name: 'Corp A' }),
    );
    const playerRosterStage = screen
      .getByText('Which list will you play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(playerRosterStage).getByRole('button', {
        name: 'Default A Corp List',
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(window.localStorage.getItem('dropshipsimulator:botRoster')).toBe(
      JSON.stringify({ type: 'specific', name: 'Flame Chicken Spam' }),
    );
    expect(window.localStorage.getItem('dropshipsimulator:playerRoster')).toBe(
      JSON.stringify({ type: 'specific', name: 'Default A Corp List' }),
    );
  });

  it('lets the human import a custom roster for the bot to play (#173)', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    fireEvent.click(screen.getByRole('button', { name: /Simple/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Corp A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Import…' }));

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

    const playerManufacturerStage = screen
      .getByText('Which manufacturer will you play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(playerManufacturerStage).getByRole('button', { name: 'Corp A' }),
    );
    const playerRosterStage = screen
      .getByText('Which list will you play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(playerRosterStage).getByRole('button', { name: 'Random' }),
    );

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
    fireEvent.click(screen.getByRole('button', { name: /Sandbox/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Select map' }));
    fireEvent.click(
      within(screen.getByText('Choose a map').closest('.map-picker-modal')).getByRole(
        'button',
        { name: /Blank/ },
      ),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:tiles')),
    ).toEqual({});
  });

  it('lists every pre-existing map in the picker modal, not just Blank (#222)', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sandbox/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Select map' }));

    const modal = screen.getByText('Choose a map').closest('.map-picker-modal');
    fireEvent.click(within(modal).getByRole('button', { name: /Map 1/ }));
    // The picker closes and a caption below the opener button now shows the
    // chosen map (#228) — the button itself always just says "Select map".
    expect(screen.queryByText('Choose a map')).toBeNull();
    expect(screen.getByRole('button', { name: 'Select map' })).toBeDefined();
    expect(screen.getByText('Map 1')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(
      JSON.parse(
        window.localStorage.getItem('dropshipsimulator:mapEditor:tiles'),
      )['7,12'],
    ).toBe('objective');
  });

  it('leaves the saved map alone when "Current map" is kept (#176)', () => {
    window.localStorage.setItem(
      'dropshipsimulator:mapEditor:tiles',
      JSON.stringify({ '0,0': 'buildings' }),
    );
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sandbox/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:tiles')),
    ).toEqual({ '0,0': 'buildings' });
  });

  it('drops emoji icons from the difficulty and map tiles, and drops the map import option (#189, #190, #191)', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    expect(screen.getByRole('button', { name: 'Simple' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tactical' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Expert' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Tactical' }));
    const botManufacturerStage = screen
      .getByText('Which manufacturer should the computer play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(botManufacturerStage).getByRole('button', { name: 'Corp A' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Random' }));
    const playerManufacturerStage = screen
      .getByText('Which manufacturer will you play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(playerManufacturerStage).getByRole('button', { name: 'Corp A' }),
    );
    const playerRosterStage = screen
      .getByText('Which list will you play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(playerRosterStage).getByRole('button', { name: 'Random' }),
    );

    const mapStage = screen
      .getByText('Which map do you want to play?')
      .closest('.cascade-stage');
    fireEvent.click(
      within(mapStage).getByRole('button', { name: 'Select map' }),
    );
    const mapPickerModal = screen
      .getByText('Choose a map')
      .closest('.map-picker-modal');
    expect(
      within(mapPickerModal).getByRole('button', { name: /Current map/ }),
    ).toBeDefined();
    expect(
      within(mapPickerModal).getByRole('button', { name: /Blank/ }),
    ).toBeDefined();
    expect(
      within(mapPickerModal).queryByRole('button', { name: /Import/ }),
    ).toBeNull();
    expect(screen.queryByLabelText('Map export')).toBeNull();
  });

  it('Cancel dismisses the mode picker without starting a game', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('How do you want to play?')).toBeNull();
    expect(window.location.hash).toBe('');
  });
});

describe('PlayPage mobile roster picker (#224)', () => {
  function stubMobile() {
    vi.stubGlobal('matchMedia', () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
    }));
  }

  it('shows the player and CPU pickers side by side instead of the sequential desktop stages', () => {
    stubMobile();
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tactical' }));

    expect(screen.queryByText('Which manufacturer should the computer play?')).toBeNull();
    expect(screen.queryByText('Which manufacturer will you play?')).toBeNull();

    const stage = screen
      .getByText("Choose your list and the computer's")
      .closest('.cascade-stage');
    expect(within(stage).getByText('You')).toBeDefined();
    expect(within(stage).getByText('Computer')).toBeDefined();
  });

  it('lets the player and CPU be picked independently, in either order', () => {
    stubMobile();
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tactical' }));

    const stage = screen
      .getByText("Choose your list and the computer's")
      .closest('.cascade-stage');
    const playerColumn = within(stage).getByText('You').parentElement;
    const cpuColumn = within(stage).getByText('Computer').parentElement;

    // Pick the player's list first...
    fireEvent.click(within(playerColumn).getByRole('button', { name: 'Corp A' }));
    fireEvent.click(
      within(playerColumn).getByRole('button', { name: 'Default A Corp List' }),
    );
    // ...then the CPU's — picking the CPU's list afterward shouldn't wipe out
    // the player's already-finalized choice (#224).
    fireEvent.click(within(cpuColumn).getByRole('button', { name: 'Corp A' }));
    fireEvent.click(within(cpuColumn).getByRole('button', { name: 'Random' }));

    expect(
      within(playerColumn).getByRole('button', { name: 'Default A Corp List' })
        .className,
    ).toContain('selected');
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:playerRoster')),
    ).toEqual({ type: 'specific', name: 'Default A Corp List' });
  });

  it('expands a list\'s description underneath it when picked', () => {
    stubMobile();
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tactical' }));

    const stage = screen
      .getByText("Choose your list and the computer's")
      .closest('.cascade-stage');
    const cpuColumn = within(stage).getByText('Computer').parentElement;

    fireEvent.click(within(cpuColumn).getByRole('button', { name: 'Corp A' }));
    expect(within(cpuColumn).queryByText(/Weight:/)).toBeNull();

    fireEvent.click(
      within(cpuColumn).getByRole('button', { name: 'Default A Corp List' }),
    );
    expect(within(cpuColumn).getByText(/Weight:/)).toBeDefined();

    // Picking a different list collapses the first one's description.
    fireEvent.click(
      within(cpuColumn).getByRole('button', { name: 'Flame Chicken Spam' }),
    );
    expect(
      within(cpuColumn).getAllByText(/Weight:/).length,
    ).toBe(1);
  });

  it('still lets the map be picked once both lists are chosen on mobile', () => {
    stubMobile();
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tactical' }));

    const stage = screen
      .getByText("Choose your list and the computer's")
      .closest('.cascade-stage');
    const playerColumn = within(stage).getByText('You').parentElement;
    const cpuColumn = within(stage).getByText('Computer').parentElement;

    fireEvent.click(within(playerColumn).getByRole('button', { name: 'Corp A' }));
    fireEvent.click(within(playerColumn).getByRole('button', { name: 'Random' }));
    fireEvent.click(within(cpuColumn).getByRole('button', { name: 'Corp A' }));
    fireEvent.click(within(cpuColumn).getByRole('button', { name: 'Random' }));

    expect(screen.getByText('Which map do you want to play?')).toBeDefined();
  });
});

describe('PlayPage grid layout (#231)', () => {
  it('marks the Single Player/Multiplayer and Sandbox/Vs CPU grids so they stay 2-up on mobile', () => {
    render(<PlayPage />);

    const topGrid = screen.getByRole('link', { name: /Multiplayer/ }).closest('.home-tile-grid');
    expect(topGrid.className).toContain('two-col-mobile-grid');

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    const modeGrid = screen.getByRole('button', { name: /Sandbox/ }).closest('.home-tile-grid');
    expect(modeGrid.className).toContain('two-col-mobile-grid');
  });

  it('marks the difficulty grid so it stays 3-up in one row on mobile', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));

    const difficultyGrid = screen
      .getByRole('button', { name: 'Simple' })
      .closest('.home-tile-grid');
    expect(difficultyGrid.className).toContain('play-difficulty-grid');
  });

  it('renders the manufacturer picker as small wrapping tiles instead of a full-width list', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tactical' }));

    const corpABtn = screen.getByRole('button', { name: 'Corp A' });
    expect(corpABtn.className).toContain('manufacturer-tile');
    expect(corpABtn.closest('.manufacturer-tile-list')).not.toBeNull();
  });

  it('drops every issue-number reference from the visible page text', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Vs CPU/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Tactical' }));
    fireEvent.click(screen.getByRole('button', { name: 'Corp A' }));
    fireEvent.click(screen.getByRole('button', { name: 'Random' }));

    expect(document.body.textContent).not.toMatch(/\(#\d+\)/);
  });
});

describe('PlayPage scenario picker (#232)', () => {
  it('shows a scenario stage after the map stage, defaulting to Annihilation', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sandbox/ }));

    expect(
      screen.getByText('Which scenario do you want to play?'),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: /Annihilation/ }).className,
    ).toContain('selected');
    expect(
      screen.getByRole('button', { name: /First to 11/ }).className,
    ).not.toContain('selected');
  });

  it('commits the chosen scenario to storage when Start Game is pressed', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sandbox/ }));
    fireEvent.click(screen.getByRole('button', { name: /First to 11/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(
      window.localStorage.getItem('dropshipsimulator:gameScenario'),
    ).toBe(JSON.stringify('first-to-11'));
  });

  it('defaults to Annihilation in storage when the scenario stage is never touched', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sandbox/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start Game' }));

    expect(
      window.localStorage.getItem('dropshipsimulator:gameScenario'),
    ).toBe(JSON.stringify('annihilation'));
  });
});

describe('PlayPage map picker grid on mobile (#234)', () => {
  it('marks the map picker grid so it stays a grid on mobile instead of stacking', () => {
    render(<PlayPage />);

    fireEvent.click(screen.getByRole('button', { name: /Single Player/ }));
    fireEvent.click(screen.getByRole('button', { name: /Sandbox/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Select map' }));

    const modal = screen.getByText('Choose a map').closest('.map-picker-modal');
    const grid = within(modal).getByRole('button', { name: /Current map/ }).closest('.home-tile-grid');
    expect(grid.className).toContain('two-col-mobile-grid');
  });
});
