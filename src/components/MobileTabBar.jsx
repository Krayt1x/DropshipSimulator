const TABS = [
  { id: 'board', label: 'Board' },
  { id: 'units', label: 'Units' },
  { id: 'dice', label: 'Dice' },
];

// A one-panel-at-a-time fixed bottom tab bar replacing the old slide-in
// overlays (#101) — mobile only now (desktop has its own always-visible
// board + Units/Dice sidebar instead, #261). Dice and Log used to be
// separate tabs but always shared one stacked column anyway, so both are
// combined into "Dice" (#248) instead of a 4th tab.
function MobileTabBar({ activeTab, onSelectTab }) {
  return (
    <nav className="mobile-tab-bar mobile-tab-bar-bottom">
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
