import ThemeToggle from './components/ThemeToggle.jsx';
import MapEditorPage from './pages/MapEditorPage.jsx';

function App() {
  return (
    <>
      <nav className="topnav">
        <strong>Dropship Simulator</strong>
        <ThemeToggle />
      </nav>
      <MapEditorPage />
    </>
  );
}

export default App;
