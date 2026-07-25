import { useState } from 'react';
import { useLocalStorageState } from '../lib/storage.js';
import { createToken } from '../lib/tokens.js';
import BattleBoard from '../components/BattleBoard.jsx';
import TokenForm from '../components/TokenForm.jsx';
import TokenCard from '../components/TokenCard.jsx';
import manufacturers from '../data/manufacturers.json';
import units from '../data/units.json';
import equipment from '../data/equipment.json';

const DEFAULT_TILE_TYPES = [{ id: 'plain', name: 'Plain', color: '#78716c' }];
const DEFAULT_DIMENSIONS = { cols: 14, rows: 10 };

function BattlePage() {
  const [tileTypes] = useLocalStorageState(
    'dropshipsimulator:mapEditor:tileTypes',
    DEFAULT_TILE_TYPES,
  );
  const [dimensions] = useLocalStorageState(
    'dropshipsimulator:mapEditor:dimensions',
    DEFAULT_DIMENSIONS,
  );
  const [tiles] = useLocalStorageState('dropshipsimulator:mapEditor:tiles', {});
  const [tokens, setTokens] = useLocalStorageState(
    'dropshipsimulator:battle:tokens',
    [],
  );
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [movingTokenId, setMovingTokenId] = useState(null);

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null;
  const selectedUnit = selectedToken
    ? units.find((u) => Number(u.id) === Number(selectedToken.unitId))
    : null;

  function tokenAt(key) {
    return tokens.find(
      (t) => t.position && `${t.position.col},${t.position.row}` === key,
    );
  }

  function handleHexClick(key) {
    const [col, row] = key.split(',').map(Number);

    if (draft) {
      if (tokenAt(key)) return;
      const token = createToken({ ...draft, position: { col, row } });
      setTokens((current) => [...current, token]);
      setDraft(null);
      setSelectedTokenId(token.id);
      return;
    }

    if (movingTokenId) {
      setTokens((current) =>
        current.map((t) =>
          t.id === movingTokenId ? { ...t, position: { col, row } } : t,
        ),
      );
      setMovingTokenId(null);
      return;
    }

    const existing = tokenAt(key);
    setSelectedTokenId(existing ? existing.id : null);
  }

  function updateSelected(patch) {
    setTokens((current) =>
      current.map((t) =>
        t.id === selectedTokenId ? { ...t, ...patch(t) } : t,
      ),
    );
  }

  function adjustHp(delta) {
    updateSelected((t) => ({ currentHp: t.currentHp + delta }));
  }

  function rotate(delta) {
    updateSelected((t) => ({ facing: (t.facing + delta + 6) % 6 }));
  }

  function setHeat(weaponId, heat) {
    updateSelected((t) => ({
      weaponState: {
        ...t.weaponState,
        [weaponId]: { ...t.weaponState[weaponId], heat },
      },
    }));
  }

  function toggleBroken(weaponId) {
    updateSelected((t) => ({
      weaponState: {
        ...t.weaponState,
        [weaponId]: {
          ...t.weaponState[weaponId],
          broken: !t.weaponState[weaponId]?.broken,
        },
      },
    }));
  }

  function removeSelected() {
    if (!window.confirm('Remove this unit from the board?')) return;
    setTokens((current) => current.filter((t) => t.id !== selectedTokenId));
    setSelectedTokenId(null);
    setMovingTokenId(null);
  }

  return (
    <div className="container-wide">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Battle board</h1>
      <p className="unit-meta" style={{ marginBottom: 20 }}>
        Place units from the catalogue, move them around, and track HP and
        weapon heat as you play. This tool manages state only — it's on you
        and your opponent to know and apply the rules.
      </p>

      <div className="map-editor-layout">
        <div className="map-editor-board">
          <BattleBoard
            cols={dimensions.cols}
            rows={dimensions.rows}
            tiles={tiles}
            tileTypes={tileTypes}
            tokens={tokens}
            units={units}
            selectedTokenId={selectedTokenId}
            onHexClick={handleHexClick}
          />
        </div>
        <div>
          {selectedToken ? (
            <TokenCard
              token={selectedToken}
              unit={selectedUnit}
              equipment={equipment}
              moving={movingTokenId === selectedToken.id}
              onAdjustHp={adjustHp}
              onRotate={rotate}
              onArmMove={() =>
                setMovingTokenId((current) =>
                  current === selectedToken.id ? null : selectedToken.id,
                )
              }
              onSetHeat={setHeat}
              onToggleBroken={toggleBroken}
              onRemove={removeSelected}
              onDeselect={() => setSelectedTokenId(null)}
            />
          ) : (
            <TokenForm
              manufacturers={manufacturers}
              units={units}
              equipment={equipment}
              armed={Boolean(draft)}
              onArm={(next) =>
                setDraft((current) => (current ? null : next))
              }
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default BattlePage;
