import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import {
  render,
  screen,
  cleanup,
  fireEvent,
  within,
  act,
} from '@testing-library/react';
import PlayPage from './PlayPage.jsx';
import { MultiplayerProvider } from '../context/MultiplayerContext.jsx';

beforeEach(() => {
  window.localStorage.clear();
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  window.location.hash = '';
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// Picking a wizard tile now waits half a second before advancing to the next
// stage (#256), so every click in these tests needs to flush that timer
// before asserting on what comes next — a plain fireEvent.click would leave
// the previous stage still on screen. Advancing time is a no-op for clicks
// that don't schedule a delayed transition (manufacturer picks, rail-tab
// navigation, Continue), so this is safe to use for every click uniformly.
function click(el) {
  fireEvent.click(el);
  act(() => {
    vi.advanceTimersByTime(500);
  });
}

// The wizard's rail buttons put the numbered dot span before the label span
// (#247), so the accessible name concatenates as e.g. "3Rosters" — matching
// on the label span directly sidesteps that instead of fighting it with a
// regex.
function railTab(name) {
  return screen
    .getByText(name, { selector: '.wizard-rail-label' })
    .closest('button');
}

function pickSinglePlayer() {
  click(screen.getByRole('button', { name: /Single Player/ }));
}

function pickSandbox() {
  pickSinglePlayer();
  click(screen.getByRole('button', { name: /Sandbox/ }));
}

// Reaches the Rosters stage of a Vs CPU game at the given difficulty.
function reachRostersStage(difficultyName = 'Simple') {
  pickSinglePlayer();
  click(screen.getByRole('button', { name: /Vs CPU/ }));
  click(
    screen.getByRole('button', { name: new RegExp(`^${difficultyName}$`) }),
  );
}

// The wizard shows exactly one stage at a time, so scoping to .wizard-body
// is enough to isolate the Rosters stage's You/Computer columns.
function rosterColumns() {
  const stage = screen
    .getByText("Choose your list and the computer's")
    .closest('.wizard-body');
  return {
    stage,
    playerColumn: within(stage).getByText('You').parentElement,
    cpuColumn: within(stage).getByText('Computer').parentElement,
  };
}

function pickRoster(column, manufacturer, listName) {
  click(within(column).getByRole('button', { name: manufacturer }));
  click(within(column).getByRole('button', { name: listName }));
}

// Reaches the Map stage of a Vs CPU game with both sides given a random
// roster from the same manufacturer.
function reachMapStageCpu(difficultyName = 'Simple') {
  reachRostersStage(difficultyName);
  const { cpuColumn, playerColumn } = rosterColumns();
  pickRoster(cpuColumn, 'Corp A', 'Random');
  pickRoster(playerColumn, 'Corp A', 'Random');
}

// Reaches the First player stage of a Vs CPU game, accepting the Scenario
// stage's default (Destruction) via Continue along the way.
function reachFirstPlayerStage(difficultyName = 'Simple') {
  reachMapStageCpu(difficultyName);
  click(screen.getByRole('button', { name: 'Continue' }));
  click(screen.getByRole('button', { name: 'Continue' }));
}

describe('PlayPage', () => {
  it('hides Resume Game when there is no active game', () => {
    render(<PlayPage />);
    expect(screen.queryByText('Resume Game')).toBeNull();
  });

  it('shows Resume Game above the picker when a game is in progress', () => {
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

  it('shows a resume message instead of the picker while a game is already in progress', () => {
    window.localStorage.setItem(
      'dropshipsimulator:battle:tokens',
      JSON.stringify([{ id: 'token-1' }]),
    );
    render(<PlayPage />);
    expect(screen.queryByText('How do you want to play?')).toBeNull();
    expect(
      screen.getByText(
        'A game is already in progress — use Resume Game above, or End Game to start a new one.',
      ),
    ).toBeDefined();
  });

  it("offers Single Player and Multiplayer as the wizard's first stage (#250)", () => {
    render(<PlayPage />);
    expect(screen.getByText('How do you want to play?')).toBeDefined();
    expect(screen.getByRole('button', { name: /Single Player/ })).toBeDefined();
    expect(screen.getByRole('button', { name: /Multiplayer/ })).toBeDefined();
  });

  it('walks a full Sandbox game from Platform to Start Game (#184)', () => {
    render(<PlayPage />);
    pickSinglePlayer();
    expect(screen.getByText('Sandbox or Vs CPU?')).toBeDefined();

    click(screen.getByRole('button', { name: /Sandbox/ }));

    // Picking Sandbox replaces the Mode stage with Map — one stage at a
    // time (#247, #251) rather than the old cascade stacking both — and
    // doesn't start the game yet, since the map stage still needs an
    // answer (#176).
    expect(window.location.hash).toBe('');
    expect(screen.queryByText('Sandbox or Vs CPU?')).toBeNull();
    expect(screen.getByText('Which map do you want to play?')).toBeDefined();

    click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Review & start')).toBeDefined();
    click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(window.localStorage.getItem('dropshipsimulator:gameMode')).toBe(
      JSON.stringify('sandbox'),
    );
  });

  it('walks a full Vs CPU game through every stage to Start Game (#173, #176, #184, #239)', () => {
    render(<PlayPage />);
    pickSinglePlayer();
    click(screen.getByRole('button', { name: /Vs CPU/ }));
    expect(screen.getByText('Choose a difficulty')).toBeDefined();

    click(screen.getByRole('button', { name: /Tactical/ }));

    // Picking a difficulty alone doesn't start the game yet — a
    // manufacturer (#198) and roster still need an answer for both sides
    // (#241).
    expect(window.location.hash).toBe('');
    const { cpuColumn, playerColumn } = rosterColumns();
    pickRoster(cpuColumn, 'Corp A', 'Random');

    // Picking only one side doesn't advance yet.
    expect(
      screen.getByText("Choose your list and the computer's"),
    ).toBeDefined();
    pickRoster(playerColumn, 'Corp A', 'Random');

    expect(window.location.hash).toBe('');
    expect(screen.getByText('Which map do you want to play?')).toBeDefined();
    click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.getByText('Which scenario do you want to play?'),
    ).toBeDefined();
    click(screen.getByRole('button', { name: /Scenario Control/ }));

    expect(screen.getByText('Who plays first?')).toBeDefined();
    // Start Game only appears on the Review stage, reached once who goes
    // first is answered (#239).
    click(screen.getByRole('button', { name: 'Player', exact: true }));

    expect(screen.getByText('Review & start')).toBeDefined();
    click(screen.getByRole('button', { name: 'Start Game' }));

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
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:battle:turn')),
    ).toEqual({ number: 1, active: 'p1' });
  });

  describe('who plays first (#239)', () => {
    it("lets the human pick either side directly, writing Turn 1's active owner", () => {
      render(<PlayPage />);
      reachFirstPlayerStage();

      expect(screen.getByText('Who plays first?')).toBeDefined();

      click(screen.getByRole('button', { name: 'CPU' }));
      // Picking auto-advances straight to Review, so the pick itself is
      // only visible afterward via the rail's summary, not a lingering
      // "selected" tile.
      expect(screen.getByText('Review & start')).toBeDefined();
      expect(within(railTab('First player')).getByText('CPU')).toBeDefined();

      click(screen.getByRole('button', { name: 'Start Game' }));
      expect(window.location.hash).toBe('#battle');
      expect(
        JSON.parse(window.localStorage.getItem('dropshipsimulator:battle:turn')),
      ).toEqual({ number: 1, active: 'p2' });
    });

    it("writes Player (p1) as Turn 1's active owner when Player is picked", () => {
      render(<PlayPage />);
      reachFirstPlayerStage();

      click(screen.getByRole('button', { name: 'Player', exact: true }));
      click(screen.getByRole('button', { name: 'Start Game' }));

      expect(
        JSON.parse(window.localStorage.getItem('dropshipsimulator:battle:turn')),
      ).toEqual({ number: 1, active: 'p1' });
    });

    it('rolls the die, flickering between both sides before settling and advancing to Review', () => {
      vi.useFakeTimers();
      render(<PlayPage />);
      reachFirstPlayerStage();

      click(
        screen.getByRole('button', { name: 'Randomize who goes first' }),
      );

      // Mid-roll: still flickering, the die is disabled, and Review hasn't
      // been reached yet.
      expect(
        screen.getByRole('button', { name: 'Randomize who goes first' })
          .disabled,
      ).toBe(true);
      expect(screen.queryByText('Review & start')).toBeNull();

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(screen.getByText('Review & start')).toBeDefined();
      const turnActive = JSON.parse(
        window.localStorage.getItem('dropshipsimulator:battle:turn') ?? 'null',
      );
      // Not written until Start Game is actually pressed.
      expect(turnActive).toBeNull();
    });

    it('does not gate reaching Start Game on a first-player pick in Sandbox mode', () => {
      render(<PlayPage />);
      pickSandbox();
      click(screen.getByRole('button', { name: 'Continue' }));

      expect(screen.queryByText('Who plays first?')).toBeNull();
      expect(screen.getByRole('button', { name: 'Start Game' }).disabled).toBe(
        false,
      );
    });
  });

  it("lists each catalogue manufacturer, then only that manufacturer's default rosters (#198)", () => {
    render(<PlayPage />);
    reachRostersStage();
    const { cpuColumn } = rosterColumns();

    expect(within(cpuColumn).getByRole('button', { name: 'Corp A' })).toBeDefined();
    expect(within(cpuColumn).getByRole('button', { name: 'Corp B' })).toBeDefined();
    // The roster list doesn't appear until a manufacturer is chosen.
    expect(within(cpuColumn).queryByText('Default A Corp List')).toBeNull();

    // Corp B has no default rosters in this catalogue — only Random and
    // Import should be on offer, with a note explaining why.
    click(within(cpuColumn).getByRole('button', { name: 'Corp B' }));
    expect(within(cpuColumn).getByRole('button', { name: 'Random' })).toBeDefined();
    expect(within(cpuColumn).getByRole('button', { name: 'Import…' })).toBeDefined();
    expect(within(cpuColumn).queryByText('Default A Corp List')).toBeNull();
    expect(
      within(cpuColumn).getByText(/No default lists for Corp B yet/),
    ).toBeDefined();

    // Switching to Corp A shows its own default rosters instead.
    click(within(cpuColumn).getByRole('button', { name: 'Corp A' }));
    expect(
      within(cpuColumn).getByRole('button', { name: 'Default A Corp List' }),
    ).toBeDefined();
    expect(
      within(cpuColumn).getByRole('button', { name: 'Flame Chicken Spam' }),
    ).toBeDefined();
  });

  it("lets the human pick a specific default roster for the bot straight off the list (#173, #184)", () => {
    render(<PlayPage />);
    reachRostersStage();
    const { cpuColumn, playerColumn } = rosterColumns();
    click(within(cpuColumn).getByRole('button', { name: 'Corp A' }));

    click(
      within(cpuColumn).getByRole('button', { name: 'Flame Chicken Spam' }),
    );
    expect(
      within(cpuColumn).getByRole('button', { name: 'Flame Chicken Spam' })
        .className,
    ).toContain('selected');

    pickRoster(playerColumn, 'Corp A', 'Default A Corp List');

    click(screen.getByRole('button', { name: 'Continue' }));
    click(screen.getByRole('button', { name: 'Continue' }));
    click(screen.getByRole('button', { name: 'Player', exact: true }));
    click(screen.getByRole('button', { name: 'Start Game' }));

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
    reachRostersStage();
    const { cpuColumn, playerColumn } = rosterColumns();
    click(within(cpuColumn).getByRole('button', { name: 'Corp A' }));
    click(within(cpuColumn).getByRole('button', { name: 'Import…' }));

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

    click(screen.getByRole('button', { name: 'Preview import' }));
    expect(screen.getByText('1 unit found.')).toBeDefined();

    click(screen.getByRole('button', { name: 'Use this list' }));

    pickRoster(playerColumn, 'Corp A', 'Random');

    click(screen.getByRole('button', { name: 'Continue' }));
    click(screen.getByRole('button', { name: 'Continue' }));
    click(screen.getByRole('button', { name: 'Player', exact: true }));
    click(screen.getByRole('button', { name: 'Start Game' }));

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
    pickSandbox();
    click(screen.getByRole('button', { name: 'Select map' }));
    click(
      within(screen.getByText('Choose a map').closest('.map-picker-modal')).getByRole(
        'button',
        { name: /Blank/ },
      ),
    );
    expect(screen.getByText('Review & start')).toBeDefined();
    click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:tiles')),
    ).toEqual({});
  });

  it('lists every pre-existing map in the picker modal, not just Blank (#222)', () => {
    render(<PlayPage />);
    pickSandbox();
    click(screen.getByRole('button', { name: 'Select map' }));

    const modal = screen.getByText('Choose a map').closest('.map-picker-modal');
    click(within(modal).getByRole('button', { name: /Map 1/ }));
    // The picker closes and picking a map auto-advances straight to Review
    // (#247), which shows the chosen map in its own summary line (#228).
    expect(screen.queryByText('Choose a map')).toBeNull();
    expect(screen.getByText('Review & start')).toBeDefined();
    expect(screen.getAllByText('Map 1').length).toBeGreaterThan(0);

    click(screen.getByRole('button', { name: 'Start Game' }));

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
    pickSandbox();
    click(screen.getByRole('button', { name: 'Continue' }));
    click(screen.getByRole('button', { name: 'Start Game' }));

    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:mapEditor:tiles')),
    ).toEqual({ '0,0': 'buildings' });
  });

  it('drops emoji icons from the difficulty and map tiles, and drops the map import option (#189, #190, #191)', () => {
    render(<PlayPage />);
    reachMapStageCpu('Tactical');
    expect(screen.getByText('Which map do you want to play?')).toBeDefined();

    click(screen.getByRole('button', { name: 'Select map' }));
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

  it('confirms the difficulty tiles have no emoji icons', () => {
    render(<PlayPage />);
    pickSinglePlayer();
    click(screen.getByRole('button', { name: /Vs CPU/ }));

    expect(screen.getByRole('button', { name: 'Simple' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Tactical' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Expert' })).toBeDefined();
  });

  it('Cancel resets the picker all the way back to the Platform stage', () => {
    render(<PlayPage />);
    pickSandbox();
    // Picking Sandbox auto-advances past the Mode stage (#247), so the
    // choice only shows afterward via the rail's summary.
    expect(within(railTab('Mode')).getByText('Sandbox')).toBeDefined();

    click(screen.getByRole('button', { name: 'Cancel' }));

    // Still on the picker (it's part of the New Game card, not a
    // dismissible overlay) but back to an unpicked Platform stage.
    expect(screen.getByText('How do you want to play?')).toBeDefined();
    expect(screen.queryByRole('button', { name: /Sandbox/ })).toBeNull();
    expect(window.location.hash).toBe('');
  });
});

describe('PlayPage roster picker (#224, #241)', () => {
  it('shows the player and CPU pickers side by side', () => {
    render(<PlayPage />);
    reachRostersStage('Tactical');

    expect(
      screen.queryByText('Which manufacturer should the computer play?'),
    ).toBeNull();
    expect(screen.queryByText('Which manufacturer will you play?')).toBeNull();

    const { stage } = rosterColumns();
    expect(within(stage).getByText('You')).toBeDefined();
    expect(within(stage).getByText('Computer')).toBeDefined();
  });

  it('lets the player and CPU be picked independently, in either order', () => {
    render(<PlayPage />);
    reachRostersStage('Tactical');
    const { cpuColumn, playerColumn } = rosterColumns();

    // Pick the player's list first...
    pickRoster(playerColumn, 'Corp A', 'Default A Corp List');
    // ...then the CPU's — picking the CPU's list afterward shouldn't wipe
    // out the player's already-finalized choice (#224).
    pickRoster(cpuColumn, 'Corp A', 'Random');

    expect(
      within(playerColumn).getByRole('button', { name: 'Default A Corp List' })
        .className,
    ).toContain('selected');
    expect(
      JSON.parse(window.localStorage.getItem('dropshipsimulator:playerRoster')),
    ).toEqual({ type: 'specific', name: 'Default A Corp List' });
  });

  it("expands a list's description underneath it when picked", () => {
    render(<PlayPage />);
    reachRostersStage('Tactical');
    const { cpuColumn } = rosterColumns();

    click(within(cpuColumn).getByRole('button', { name: 'Corp A' }));
    expect(within(cpuColumn).queryByText(/Weight:/)).toBeNull();

    click(
      within(cpuColumn).getByRole('button', { name: 'Default A Corp List' }),
    );
    expect(within(cpuColumn).getByText(/Weight:/)).toBeDefined();

    // Picking a different list collapses the first one's description.
    click(
      within(cpuColumn).getByRole('button', { name: 'Flame Chicken Spam' }),
    );
    expect(within(cpuColumn).getAllByText(/Weight:/).length).toBe(1);
  });

  it('advances to the Map stage once both lists are chosen', () => {
    render(<PlayPage />);
    reachMapStageCpu('Tactical');
    expect(screen.getByText('Which map do you want to play?')).toBeDefined();
  });
});

describe('PlayPage grid layout (#231)', () => {
  it('marks the Sandbox/Vs CPU grid so it stays 2-up on mobile', () => {
    render(<PlayPage />);
    pickSinglePlayer();
    const modeGrid = screen.getByRole('button', { name: /Sandbox/ }).closest('.home-tile-grid');
    expect(modeGrid.className).toContain('two-col-mobile-grid');
  });

  it('marks the difficulty grid so it stays 3-up in one row on mobile', () => {
    render(<PlayPage />);
    pickSinglePlayer();
    click(screen.getByRole('button', { name: /Vs CPU/ }));

    const difficultyGrid = screen
      .getByRole('button', { name: 'Simple' })
      .closest('.home-tile-grid');
    expect(difficultyGrid.className).toContain('play-difficulty-grid');
  });

  it('renders the manufacturer picker as small wrapping tiles instead of a full-width list', () => {
    render(<PlayPage />);
    reachRostersStage('Tactical');

    const [corpABtn] = screen.getAllByRole('button', { name: 'Corp A' });
    expect(corpABtn.className).toContain('manufacturer-tile');
    expect(corpABtn.closest('.manufacturer-tile-list')).not.toBeNull();
  });

  it('drops every issue-number reference from the visible page text', () => {
    render(<PlayPage />);
    reachRostersStage('Tactical');
    const { cpuColumn } = rosterColumns();
    pickRoster(cpuColumn, 'Corp A', 'Random');

    expect(document.body.textContent).not.toMatch(/\(#\d+\)/);
  });
});

describe('PlayPage scenario picker (#232, #242)', () => {
  it('shows a scenario stage after the map stage in vs-computer mode, defaulting to Destruction (#260)', () => {
    render(<PlayPage />);
    reachMapStageCpu();
    click(screen.getByRole('button', { name: 'Continue' }));

    const body = document.querySelector('.wizard-body');
    expect(
      within(body).getByText('Which scenario do you want to play?'),
    ).toBeDefined();
    expect(
      within(body).getByRole('button', { name: /Destruction/ }).className,
    ).toContain('selected');
    expect(
      within(body).getByRole('button', { name: /Scenario Control/ }).className,
    ).not.toContain('selected');
  });

  it('commits the chosen scenario to storage when Start Game is pressed', () => {
    render(<PlayPage />);
    reachMapStageCpu();
    click(screen.getByRole('button', { name: 'Continue' }));

    click(screen.getByRole('button', { name: /Scenario Control/ }));
    click(screen.getByRole('button', { name: 'Player', exact: true }));
    click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(
      window.localStorage.getItem('dropshipsimulator:gameScenario'),
    ).toBe(JSON.stringify('first-to-11'));
  });

  it("defaults to Destruction (stored as 'annihilation') when the scenario stage is never touched", () => {
    render(<PlayPage />);
    reachFirstPlayerStage();

    click(screen.getByRole('button', { name: 'Player', exact: true }));
    click(screen.getByRole('button', { name: 'Start Game' }));

    expect(
      window.localStorage.getItem('dropshipsimulator:gameScenario'),
    ).toBe(JSON.stringify('annihilation'));
  });

  it('never shows the scenario picker in Sandbox mode and always commits Destruction (#242)', () => {
    render(<PlayPage />);
    pickSandbox();

    expect(
      screen.queryByText('Which scenario do you want to play?'),
    ).toBeNull();

    click(screen.getByRole('button', { name: 'Continue' }));
    click(screen.getByRole('button', { name: 'Start Game' }));

    expect(window.location.hash).toBe('#battle');
    expect(
      window.localStorage.getItem('dropshipsimulator:gameScenario'),
    ).toBe(JSON.stringify('annihilation'));
  });
});

describe('PlayPage map picker grid on mobile (#234)', () => {
  it('marks the map picker grid so it stays a grid on mobile instead of stacking', () => {
    render(<PlayPage />);
    pickSandbox();
    click(screen.getByRole('button', { name: 'Select map' }));

    const modal = screen.getByText('Choose a map').closest('.map-picker-modal');
    const grid = within(modal).getByRole('button', { name: /Current map/ }).closest('.home-tile-grid');
    expect(grid.className).toContain('two-col-mobile-grid');
  });
});

describe('PlayPage wizard (#247, #251)', () => {
  it('shows a compact tab rail with Platform as the first stage, one at a time', () => {
    render(<PlayPage />);

    expect(document.querySelector('.wizard-rail')).not.toBeNull();
    expect(screen.getByText('How do you want to play?')).toBeDefined();
    expect(railTab('Play as')).toBeDefined();
    // Nothing else exists as a tab yet — Platform hasn't been picked.
    expect(screen.queryByText('Sandbox or Vs CPU?')).toBeNull();

    pickSinglePlayer();

    expect(screen.getByText('Sandbox or Vs CPU?')).toBeDefined();
    // Difficulty/Rosters/Scenario/First player don't exist as tabs yet —
    // mode hasn't been picked, so the wizard doesn't know it's a Vs CPU game.
    expect(screen.queryByText('Choose a difficulty')).toBeNull();
    expect(railTab('Mode')).toBeDefined();
    expect(railTab('Map')).toBeDefined();
    expect(railTab('Review')).toBeDefined();
  });

  it('auto-advances to the next stage as soon as Sandbox is picked', () => {
    render(<PlayPage />);
    pickSandbox();

    expect(screen.getByText('Which map do you want to play?')).toBeDefined();
    expect(railTab('Mode').className).toContain('done');
  });

  it('waits half a second after a pick before swapping in the next stage (#256)', () => {
    render(<PlayPage />);
    pickSinglePlayer();

    const body = document.querySelector('.wizard-body');
    fireEvent.click(within(body).getByRole('button', { name: /Sandbox/ }));
    // The pick registers immediately (the tile shows selected)...
    expect(
      within(body).getByRole('button', { name: /Sandbox/ }).className,
    ).toContain('selected');
    // ...but the stage itself hasn't swapped yet.
    expect(screen.queryByText('Which map do you want to play?')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(screen.queryByText('Which map do you want to play?')).toBeNull();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByText('Which map do you want to play?')).toBeDefined();
  });

  it("lets Continue accept a stage's default without an explicit pick", () => {
    render(<PlayPage />);
    pickSandbox();

    expect(screen.getByText('Which map do you want to play?')).toBeDefined();
    click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Review & start')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Start Game' }).disabled).toBe(
      false,
    );
  });

  it('lets clicking a completed rail tab jump back and revise an earlier choice', () => {
    render(<PlayPage />);
    pickSandbox();

    expect(screen.getByText('Which map do you want to play?')).toBeDefined();
    click(railTab('Mode'));
    expect(screen.getByText('Sandbox or Vs CPU?')).toBeDefined();

    click(screen.getByRole('button', { name: /Vs CPU/ }));
    expect(screen.getByText('Choose a difficulty')).toBeDefined();
  });

  it("doesn't let you skip ahead to a tab that isn't reachable yet", () => {
    render(<PlayPage />);
    pickSinglePlayer();
    click(screen.getByRole('button', { name: /Vs CPU/ }));

    expect(railTab('Rosters').disabled).toBe(true);
  });

  it('narrows the rail below 700px instead of falling back to a stacked cascade (#251)', () => {
    render(<PlayPage />);
    // No matchMedia-driven branch exists anymore — the same rail+body
    // markup renders regardless of viewport, with only CSS (untestable in
    // jsdom) narrowing it below 700px. This just confirms the wizard markup
    // itself never swaps for a `.cascade-stage` layout.
    expect(document.querySelector('.wizard-rail')).not.toBeNull();
    expect(document.querySelector('.cascade-stage')).toBeNull();
  });
});

describe("PlayPage Single Player/Multiplayer as the wizard's first stage (#250)", () => {
  it('picking Multiplayer stays on the Play page and shows Host/Join instead of Sandbox/Vs CPU', () => {
    render(<PlayPage />);

    click(screen.getByRole('button', { name: /Multiplayer/ }));

    // Multiplayer used to navigate away to #connect (#231) — it's the
    // wizard's own next stage now, so picking it must not navigate anywhere.
    expect(window.location.hash).toBe('');
    expect(screen.getByText('Host or join a game?')).toBeDefined();
    expect(screen.queryByText('Sandbox or Vs CPU?')).toBeNull();
  });

  it('embeds the host/join code exchange inline instead of navigating to a separate page', () => {
    render(
      <MultiplayerProvider>
        <PlayPage />
      </MultiplayerProvider>,
    );

    click(screen.getByRole('button', { name: /Multiplayer/ }));
    click(screen.getByRole('button', { name: /Host a game/ }));

    expect(screen.getByRole('button', { name: 'Host a game' })).toBeDefined();
    expect(window.location.hash).toBe('');
  });

  it('switching back to Single Player after picking Multiplayer shows Sandbox/Vs CPU again', () => {
    render(<PlayPage />);

    click(screen.getByRole('button', { name: /Multiplayer/ }));
    // Picking Multiplayer auto-advances past the Platform stage — jump back
    // via the rail to revise the choice (#247).
    click(railTab('Play as'));
    pickSinglePlayer();

    expect(screen.getByText('Sandbox or Vs CPU?')).toBeDefined();
  });

  it('nests the host code exchange in the wizard body next to the Play as/Host or Join rail', () => {
    render(
      <MultiplayerProvider>
        <PlayPage />
      </MultiplayerProvider>,
    );

    click(screen.getByRole('button', { name: /Multiplayer/ }));

    const rail = document.querySelector('.wizard-rail');
    expect(within(rail).getByText('Play as')).toBeDefined();
    expect(within(rail).getByText('Host or Join')).toBeDefined();
    expect(within(rail).getByText('Code exchange')).toBeDefined();

    click(screen.getByRole('button', { name: /Host a game/ }));

    const body = document.querySelector('.wizard-body');
    expect(
      within(body).getByRole('button', { name: 'Host a game' }),
    ).toBeDefined();
  });

  it("doesn't offer the single-player Mode/Map/Review stages on the multiplayer branch", () => {
    render(<PlayPage />);

    click(screen.getByRole('button', { name: /Multiplayer/ }));

    const rail = document.querySelector('.wizard-rail');
    expect(within(rail).queryByText('Mode')).toBeNull();
    expect(within(rail).queryByText('Map')).toBeNull();
    expect(within(rail).queryByText('Review')).toBeNull();
  });
});
