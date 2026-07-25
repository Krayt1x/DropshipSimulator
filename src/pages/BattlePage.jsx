import { useState } from 'react';
import { useLocalStorageState } from '../lib/storage.js';
import { createToken } from '../lib/tokens.js';
import BattleBoard from '../components/BattleBoard.jsx';
import TokenForm from '../components/TokenForm.jsx';
import TokenCard from '../components/TokenCard.jsx';
import RosterImport from '../components/RosterImport.jsx';
import ReserveList from '../components/ReserveList.jsx';
import DestroyedList from '../components/DestroyedList.jsx';
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
  const [deploymentPhase, setDeploymentPhase] = useLocalStorageState(
    'dropshipsimulator:battle:deploymentPhase',
    false,
  );
  const [myPlayer] = useLocalStorageState('dropshipsimulator:myPlayer', null);
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [movingTokenId, setMovingTokenId] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('add');

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null;
  const selectedUnit = selectedToken
    ? units.find((u) => Number(u.id) === Number(selectedToken.unitId))
    : null;
  const reserveTokens = tokens.filter((t) => !t.position && !t.destroyed);
  const destroyedTokens = tokens.filter((t) => t.destroyed);

  function canControl(token) {
    return !myPlayer || token.owner === myPlayer;
  }

  const topBoundaryRow = 2;
  const bottomBoundaryRow = dimensions.rows - 4;
  const deploymentZonesValid = bottomBoundaryRow > topBoundaryRow;
  const deploymentZones =
    deploymentPhase && deploymentZonesValid
      ? { topBoundaryRow, bottomBoundaryRow }
      : null;

  function tokenAt(key) {
    return tokens.find(
      (t) => t.position && `${t.position.col},${t.position.row}` === key,
    );
  }

  function placeTokenAt(tokenId, col, row) {
    setTokens((current) =>
      current.map((t) =>
        t.id === tokenId ? { ...t, position: { col, row } } : t,
      ),
    );
  }

  function handleHexClick(key) {
    const [col, row] = key.split(',').map(Number);

    if (draft) {
      if (tokenAt(key) || !canControl({ owner: draft.owner })) return;
      const token = createToken({ ...draft, position: { col, row } });
      setTokens((current) => [...current, token]);
      setDraft(null);
      setSelectedTokenId(token.id);
      return;
    }

    if (movingTokenId) {
      const movingToken = tokens.find((t) => t.id === movingTokenId);
      if (movingToken && canControl(movingToken)) {
        placeTokenAt(movingTokenId, col, row);
      }
      setMovingTokenId(null);
      return;
    }

    const existing = tokenAt(key);
    setSelectedTokenId(existing ? existing.id : null);
  }

  function handleDropToken(tokenId, col, row) {
    if (tokenAt(`${col},${row}`)) return;
    const token = tokens.find((t) => t.id === tokenId);
    if (!token || !canControl(token)) return;
    placeTokenAt(tokenId, col, row);
    setSelectedTokenId(tokenId);
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

  function destroySelected() {
    updateSelected(() => ({ destroyed: true, position: null }));
    setMovingTokenId(null);
  }

  function returnSelectedToReserve() {
    updateSelected(() => ({ destroyed: false, position: null }));
    setMovingTokenId(null);
  }

  function returnDestroyedToReserve(tokenId) {
    setTokens((current) =>
      current.map((t) =>
        t.id === tokenId ? { ...t, destroyed: false, position: null } : t,
      ),
    );
  }

  function importRoster({ entries, owner }) {
    const imported = entries.map(({ unit, equippedIds }) =>
      createToken({ unit, equippedIds, owner, position: null }),
    );
    setTokens((current) => [...current, ...imported]);
  }

  return (
    <div className="container-wide">
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Battle board</h1>
      <p className="unit-meta" style={{ marginBottom: 20 }}>
        Place units from the catalogue, move them around, and track HP and
        weapon heat as you play. This tool manages state only — it's on you
        and your opponent to know and apply the rules.
      </p>

      <div className="deployment-controls">
        <button
          type="button"
          className={deploymentPhase ? '' : 'ghost'}
          disabled={!deploymentZonesValid}
          onClick={() => setDeploymentPhase((current) => !current)}
        >
          {deploymentPhase ? 'End deployment phase' : 'Deployment Phase'}
        </button>
        {!deploymentZonesValid && (
          <span className="unit-meta">Board needs at least 7 rows for deployment zones.</span>
        )}
      </div>

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
            rangeOrigin={selectedToken?.position ?? null}
            deploymentZones={deploymentZones}
            onHexClick={handleHexClick}
            onDropToken={handleDropToken}
          />
        </div>
        <div>
          <ReserveList
            tokens={reserveTokens}
            units={units}
            selectedTokenId={selectedTokenId}
            canControl={canControl}
            onSelect={setSelectedTokenId}
          />
          {selectedToken ? (
            <TokenCard
              token={selectedToken}
              unit={selectedUnit}
              equipment={equipment}
              moving={movingTokenId === selectedToken.id}
              canControl={canControl(selectedToken)}
              onAdjustHp={adjustHp}
              onRotate={rotate}
              onArmMove={() =>
                setMovingTokenId((current) =>
                  current === selectedToken.id ? null : selectedToken.id,
                )
              }
              onSetHeat={setHeat}
              onToggleBroken={toggleBroken}
              onDestroy={destroySelected}
              onReturnToReserve={returnSelectedToReserve}
              onDeselect={() => setSelectedTokenId(null)}
            />
          ) : deploymentPhase ? (
            <>
              <div className="workspace-tabs">
                <button
                  type="button"
                  className={`workspace-tab ${sidebarTab === 'add' ? 'active' : ''}`}
                  onClick={() => setSidebarTab('add')}
                >
                  Add unit
                </button>
                <button
                  type="button"
                  className={`workspace-tab ${sidebarTab === 'import' ? 'active' : ''}`}
                  onClick={() => {
                    setSidebarTab('import');
                    setDraft(null);
                  }}
                >
                  Import roster
                </button>
              </div>
              {sidebarTab === 'import' ? (
                <RosterImport
                  manufacturers={manufacturers}
                  units={units}
                  equipment={equipment}
                  myPlayer={myPlayer}
                  onImport={importRoster}
                />
              ) : (
                <TokenForm
                  manufacturers={manufacturers}
                  units={units}
                  equipment={equipment}
                  myPlayer={myPlayer}
                  armed={Boolean(draft)}
                  onArm={(next) =>
                    setDraft((current) => (current ? null : next))
                  }
                />
              )}
            </>
          ) : (
            <div className="card">
              <p className="unit-meta">
                Adding and importing units is only available during the
                Deployment Phase. Start one above to bring in new units.
              </p>
            </div>
          )}
          <DestroyedList
            tokens={destroyedTokens}
            units={units}
            selectedTokenId={selectedTokenId}
            canControl={canControl}
            onSelect={setSelectedTokenId}
            onReturnToReserve={returnDestroyedToReserve}
          />
        </div>
      </div>
    </div>
  );
}

export default BattlePage;
