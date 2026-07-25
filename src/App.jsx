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
  if (window.location.hash === '#map') return 'map';
  if (window.location.hash === '#play') return 'play';
  if (window.location.hash === '#battle') return 'battle';
  if (window.location.hash === '#connect') return 'connect';
  return 'home';
}

function ConnectionBadge() {
  const mp = useMultiplayer();
  if (!mp || mp.phase === 'idle') return null;
  const label =
    mp.phase === 'connected'
      ? `Connected (${mp.role})`
      : mp.phase === 'offer-ready'
        ? 'Waiting for peer…'
        : 'Connecting…';
  return (
    <a
      href="#connect"
      className={`connection-badge ${mp.phase === 'connected' ? 'connection-badge-live' : ''}`}
    >
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
          <a href={DROPSHIP_BUILDER_URL} target="_blank" rel="noreferrer">
            Dropship Builder ↗
          </a>
          {(page === 'battle' || page === 'connect') && (
            <PlayerIdentityPicker />
          )}
          <ConnectionBadge />
          <ThemeToggle />
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
