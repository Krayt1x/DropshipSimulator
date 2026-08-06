const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'units', label: 'Units' },
  { id: 'dice', label: 'Dice' },
];

// A one-panel-at-a-time tab bar replacing the old slide-in overlays (#101).
// On mobile it's a fixed bottom bar; on desktop it's a top strip using the
// same panel-switching model instead of a permanent 3-column layout (#249).
// Dice and Log used to be separate tabs but always shared one stacked
// column on desktop anyway, so both variants now combine them into "Dice"
// too (#248) instead of a 4th tab.
function MobileTabBar({ activeTab, onSelectTab, position = 'bottom' }) {
  return (
    <nav className={`mobile-tab-bar mobile-tab-bar-${position}`}>
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
