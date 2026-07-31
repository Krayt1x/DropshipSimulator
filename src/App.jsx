import { useEffect, useState } from 'react';
import ThemeToggle from './components/ThemeToggle.jsx';
import HomePage from './pages/HomePage.jsx';
import PlayPage from './pages/PlayPage.jsx';
import BuilderPage from './pages/BuilderPage.jsx';
import MapEditorPage from './pages/MapEditorPage.jsx';
import BattlePage from './pages/BattlePage.jsx';
import ConnectPage from './pages/ConnectPage.jsx';
import {
  MultiplayerProvider,
  useMultiplayer,
} from './context/MultiplayerContext.jsx';
import { useLocalStorageState } from './lib/storage.js';
import { OWNERS } from './lib/tokens.js';
import { resetActiveGame } from './lib/gameState.js';

const DROPSHIP_BUILDER_URL = 'https://Krayt1x.github.io/DropshipBuilder';

function currentPage() {
  const path = window.location.hash.split('?')[0];
  if (path === '#map') return 'map';
  if (path === '#play') return 'play';
  if (path === '#builder') return 'builder';
  if (path === '#battle') return 'battle';
  if (path === '#connect') return 'connect';
  return 'home';
}

// Once connected, this expands in place into a small pill (role +
// Disconnect) instead of linking out to the full Connect page (#115) — the
// permanent "Multiplayer" card there is gone once connected, so this badge
// is the only way to see status or disconnect.
function ConnectionBadge() {
  const mp = useMultiplayer();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (mp?.phase !== 'connected') setExpanded(false);
  }, [mp?.phase]);

  if (!mp || mp.phase === 'idle') return null;

  if (mp.phase === 'connected') {
    if (expanded) {
      return (
        <div className="connection-badge-expanded">
          <button
            type="button"
            className="connection-badge-role"
            onClick={() => setExpanded(false)}
          >
            ● {mp.role === 'host' ? 'Host' : 'Guest'}
          </button>
          <button
            type="button"
            className="connection-badge-disconnect"
            onClick={mp.disconnect}
          >
            Disconnect
          </button>
        </div>
      );
    }
    return (
      <button
        type="button"
        className="connection-badge connection-badge-live"
        onClick={() => setExpanded(true)}
      >
        ● Connected ({mp.role})
      </button>
    );
  }

  const label =
    mp.phase === 'offer-ready' ? 'Waiting for peer…' : 'Connecting…';
  return (
    <a href="#connect" className="connection-badge">
      ● {label}
    </a>
  );
}

// Moved here from BattlePage (#132) so it's reachable from the top menu bar
// rather than buried at the bottom of the sidebar. resetActiveGame() only
// touches localStorage/syncBus directly, so it needs no BattlePage state —
// navigating to #home afterward unmounts BattlePage either way.
function EndGameButton() {
  function endGame() {
    if (
      !window.confirm(
        'End this game? This will delete all deployed units and reset the board.',
      )
    ) {
      return;
    }
    resetActiveGame();
    window.location.hash = '#home';
  }

  return (
    <button type="button" className="danger topnav-end-game" onClick={endGame}>
      End Game
    </button>
  );
}

function PlayerIdentityPicker() {
  const [myPlayer, setMyPlayer] = useLocalStorageState(
    'dropshipsimulator:myPlayer',
    null,
  );
  // In vs-computer mode the human is locked to their chosen seat (set once
  // on PlayPage) — letting them swap here would hand control of their own
  // side to the bot and vice versa, since the bot always plays whichever
  // seat `myPlayer` isn't (BattlePage.jsx's `botOwner`).
  const [gameMode] = useLocalStorageState(
    'dropshipsimulator:gameMode',
    'sandbox',
  );
  if (gameMode === 'vs-computer') {
    const me = OWNERS.find((o) => o.id === myPlayer);
    return (
      <div className="player-identity-picker">
        <span className="player-identity-label">You are:</span>
        <span
          className="player-identity-btn selected"
          style={{ borderColor: me?.color, background: me?.color }}
        >
          <span className="tile-swatch" style={{ background: me?.color }} />
          {me?.label ?? 'Player 1'}
        </span>
      </div>
    );
  }
  return (
    <div className="player-identity-picker">
      <span className="player-identity-label">You are:</span>
      {OWNERS.map((o) => {
        const selected = myPlayer === o.id;
        return (
          <button
            type="button"
            key={o.id}
            className={`player-identity-btn ${selected ? 'selected' : ''}`}
            style={{
              borderColor: o.color,
              background: selected ? o.color : undefined,
            }}
            onClick={() =>
              setMyPlayer((current) => (current === o.id ? null : o.id))
            }
          >
            <span className="tile-swatch" style={{ background: o.color }} />
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function AppShell() {
  const [page, setPage] = useState(currentPage);
  // Two independent menus (#172) rather than one shared hamburger: site
  // navigation (Play/Map editor) on the left, settings + in-game controls
  // on the right — each gets its own toggle instead of dumping everything
  // into a single dropdown.
  const [navMenuOpen, setNavMenuOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);

  useEffect(() => {
    function onHashChange() {
      setPage(currentPage());
      setNavMenuOpen(false);
      setSettingsMenuOpen(false);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Play/Map editor already live as tiles in the home page's own body, so
  // the nav's copies of those links would just be noise there (#172).
  const showSiteNav = page !== 'home';

  return (
    <>
      <nav className="topnav">
        <div className="topnav-left">
          <a href="#home" className="topnav-brand" aria-label="Home">
            ⌂
          </a>
          {showSiteNav && (
            <>
              <button
                type="button"
                className="hamburger-btn topnav-menu-btn-left"
                aria-label="Site menu"
                aria-expanded={navMenuOpen}
                onClick={() => setNavMenuOpen((current) => !current)}
              >
                ☰
              </button>
              <div className={`topnav-links ${navMenuOpen ? 'open' : ''}`}>
                <a
                  href="#play"
                  className={
                    ['play', 'battle', 'connect', 'builder'].includes(page)
                      ? 'active'
                      : ''
                  }
                >
                  Play
                </a>
                <a href="#map" className={page === 'map' ? 'active' : ''}>
                  Map editor
                </a>
              </div>
            </>
          )}
        </div>

        {/* BattlePage portals its TurnTracker in here (#136) so the turn
            counter + End Turn button live in the menu bar instead of the
            page body, without lifting all of BattlePage's turn state up.
            Centered in the bar (#172) via absolute positioning so it stays
            centered regardless of how wide the menus on either side are. */}
        {page === 'battle' && (
          <div id="topnav-turn-slot" className="topnav-turn-slot" />
        )}

        <div className="topnav-right">
          <ConnectionBadge />
          <button
            type="button"
            className="hamburger-btn topnav-menu-btn-right"
            aria-label="Settings menu"
            aria-expanded={settingsMenuOpen}
            onClick={() => setSettingsMenuOpen((current) => !current)}
          >
            ☰
          </button>
          <div
            className={`topnav-settings-menu ${settingsMenuOpen ? 'open' : ''}`}
          >
            {(page === 'battle' || page === 'connect') && (
              <PlayerIdentityPicker />
            )}
            {page === 'battle' && <EndGameButton />}
            <a href={DROPSHIP_BUILDER_URL} target="_blank" rel="noreferrer">
              Dropship Builder ↗
            </a>
            <ThemeToggle />
          </div>
        </div>
      </nav>
      {page === 'battle' ? (
        <BattlePage />
      ) : page === 'connect' ? (
        <ConnectPage />
      ) : page === 'map' ? (
        <MapEditorPage />
      ) : page === 'builder' ? (
        <BuilderPage />
      ) : page === 'play' ? (
        <PlayPage />
      ) : (
        <HomePage />
      )}
    </>
  );
}

function App() {
  return (
    <MultiplayerProvider>
      <AppShell />
    </MultiplayerProvider>
  );
}

export default App;
