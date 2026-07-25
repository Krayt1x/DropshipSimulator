import { useEffect, useState } from 'react';
import ThemeToggle from './components/ThemeToggle.jsx';
import MapEditorPage from './pages/MapEditorPage.jsx';
import BattlePage from './pages/BattlePage.jsx';
import ConnectPage from './pages/ConnectPage.jsx';
import { MultiplayerProvider, useMultiplayer } from './context/MultiplayerContext.jsx';

function currentPage() {
  if (window.location.hash === '#battle') return 'battle';
  if (window.location.hash === '#connect') return 'connect';
  return 'map';
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

function AppShell() {
  const [page, setPage] = useState(currentPage);

  useEffect(() => {
    function onHashChange() {
      setPage(currentPage());
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  return (
    <>
      <nav className="topnav">
        <strong>Dropship Simulator</strong>
        <a href="#map" className={page === 'map' ? 'active' : ''}>
          Map editor
        </a>
        <a href="#battle" className={page === 'battle' ? 'active' : ''}>
          Battle board
        </a>
        <a href="#connect" className={page === 'connect' ? 'active' : ''}>
          Multiplayer
        </a>
        <ConnectionBadge />
        <ThemeToggle />
      </nav>
      {page === 'battle' ? (
        <BattlePage />
      ) : page === 'connect' ? (
        <ConnectPage />
      ) : (
        <MapEditorPage />
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
