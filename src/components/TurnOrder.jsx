import { useState } from 'react';

const PHASES = [
  { title: 'Pre-Maintenance Phase', steps: ['Start of Turn Effects'] },
  { title: 'Roll dice in the Dice Pool', steps: [] },
  {
    title: 'Model Activation',
    steps: [
      'Movement and Facing',
      'Combat',
      'Drop Pods',
      'Equipping Additional Equipment',
    ],
  },
  {
    title: 'Post-Maintenance Phase',
    steps: ['End of Turn Effects', 'Reduce Weapon Heat by 1'],
  },
];

function TurnOrder() {
  const [collapsed, setCollapsed] = useState(true);

  return (
    <div className="card">
      <div className="reserve-header">
        <p className="unit-name">Turn order</p>
        <button
          type="button"
          className="ghost"
          onClick={() => setCollapsed((current) => !current)}
        >
          {collapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!collapsed && (
        <ol className="turn-order-list">
          {PHASES.map((phase) => (
            <li key={phase.title}>
              {phase.title}
              {phase.steps.length > 0 && (
                <ul>
                  {phase.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default TurnOrder;
