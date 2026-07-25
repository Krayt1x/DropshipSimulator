import { useEffect, useState } from 'react';
import ThemeToggle from './components/ThemeToggle.jsx';
import MapEditorPage from './pages/MapEditorPage.jsx';
import BattlePage from './pages/BattlePage.jsx';

function currentPage() {
  return window.location.hash === '#battle' ? 'battle' : 'map';
}

function App() {
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
        <ThemeToggle />
      </nav>
      {page === 'battle' ? <BattlePage /> : <MapEditorPage />}
    </>
  );
}

export default App;
