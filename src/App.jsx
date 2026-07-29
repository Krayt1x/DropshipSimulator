import { useEffect, useState } from 'react';
import ThemeToggle from './components/ThemeToggle.jsx';
import HomePage from './pages/HomePage.jsx';
import PlayPage from './pages/PlayPage.jsx';
import MapEditorPage from './pages/MapEditorPage.jsx';
import BattlePage from './pages/BattlePage.jsx';
import ConnectPage from './pages/ConnectPage.jsx';
import {
  MultiplayerProvider,
  useMultiplayer,
} from './context/MultiplayerContext.jsx';
import { useLocalStorageState } from './lib/storage.js';
import { OWNERS } from './lib/tokens.js';

const DROPSHIP_BUILDER_URL = 'https://Krayt1x.github.io/DropshipBuilder';

function currentPage() {
  const path = window.location.hash.split('?')[0];
  if (path === '#map') return 'map';
  if (path === '#play') return 'play';
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

function PlayerIdentityPicker() {
  const [myPlayer, setMyPlayer] = useLocalStorageState(
    'dropshipsimulator:myPlayer',
    null,
  );
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    function onHashChange() {
      setPage(currentPage());
      setMenuOpen(false);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <>
      <nav className="topnav">
        <a href="#home" className="topnav-brand">
          <strong>Dropship Simulator</strong>
        </a>
        <button
          type="button"
          className="hamburger-btn"
          aria-label="Menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
        >
          ☰
        </button>
        <div className={`topnav-links ${menuOpen ? 'open' : ''}`}>
          <a
            href="#play"
            className={
              ['play', 'battle', 'connect'].includes(page) ? 'active' : ''
            }
          >
            Play
          </a>
          <a href="#map" className={page === 'map' ? 'active' : ''}>
            Map editor
          </a>
          <div className="topnav-right">
            {(page === 'battle' || page === 'connect') && (
              <PlayerIdentityPicker />
            )}
            <ConnectionBadge />
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
