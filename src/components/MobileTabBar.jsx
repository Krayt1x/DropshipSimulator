const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'units', label: 'Units' },
  { id: 'dice', label: 'Dice' },
  { id: 'log', label: 'Log' },
];

// A bottom app-style tab bar replacing the old slide-in overlays (#101) —
// only shown on narrow viewports via CSS; on desktop all 4 panels render
// simultaneously in the existing 3-column layout regardless of activeTab.
function MobileTabBar({ activeTab, onSelectTab }) {
  return (
    <nav className="mobile-tab-bar">
      {TABS.map((tab) => (
        <button
          type="button"
          key={tab.id}
          className={`mobile-tab-btn ${tab.id === activeTab ? 'active' : ''}`}
          onClick={() => onSelectTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

export default MobileTabBar;
