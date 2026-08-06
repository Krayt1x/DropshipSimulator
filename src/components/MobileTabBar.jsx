const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'units', label: 'Units' },
  { id: 'dice', label: 'Dice' },
];

// A bottom app-style tab bar replacing the old slide-in overlays (#101) —
// only shown on narrow viewports via CSS; on desktop all panels render
// simultaneously in the existing 3-column layout regardless of activeTab.
// Dice and Log used to be separate tabs but always shared one stacked
// column on desktop anyway, so mobile now combines them into "Dice" too
// (#248) instead of a 4th tab.
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
