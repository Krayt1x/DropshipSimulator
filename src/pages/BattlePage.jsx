import { useState } from 'react';
import { useLocalStorageState } from '../lib/storage.js';
import { backgroundContainerStyle } from '../lib/mapBackground.js';
import { createToken } from '../lib/tokens.js';
import BattleBoard from '../components/BattleBoard.jsx';
import TokenForm from '../components/TokenForm.jsx';
import TokenCard from '../components/TokenCard.jsx';
import RosterImport from '../components/RosterImport.jsx';
import ReserveList from '../components/ReserveList.jsx';
import DestroyedList from '../components/DestroyedList.jsx';
import TurnTracker from '../components/TurnTracker.jsx';
import manufacturers from '../data/manufacturers.json';
import units from '../data/units.json';
import equipment from '../data/equipment.json';

const DEFAULT_TILE_TYPES = [{ id: 'plain', name: 'Plain', color: '#78716c' }];
const DEFAULT_DIMENSIONS = { cols: 14, rows: 10 };
const BOARD_WIDTH = 820;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;
const DEFAULT_TURN = { number: 1, active: 'p1' };

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
  const [background] = useLocalStorageState(
    'dropshipsimulator:mapEditor:background',
    null,
  );
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
  const [lastMove, setLastMove] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [turn, setTurn] = useLocalStorageState(
    'dropshipsimulator:battle:turn',
    DEFAULT_TURN,
  );

  function endTurn() {
    setTurn((current) =>
      current.active === 'p1'
        ? { number: current.number, active: 'p2' }
        : { number: current.number + 1, active: 'p1' },
    );
  }

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null;
  const selectedUnit = selectedToken
    ? units.find((u) => Number(u.id) === Number(selectedToken.unitId))
    : null;
  const reserveTokens = tokens.filter((t) => !t.position && !t.destroyed);
  const destroyedTokens = tokens.filter((t) => t.destroyed);

  function canControl(token) {
    return !myPlayer || token.owner === myPlayer;
  }

  const fitSize = BOARD_WIDTH / (1.5 * (dimensions.cols + 1));
  const boardSize = fitSize * zoom;

  function adjustZoom(delta) {
    setZoom((current) =>
      Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Number((current + delta).toFixed(2))),
      ),
    );
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

  function moveTokenTo(token, col, row) {
    if (token.position) {
      setLastMove({ tokenId: token.id, position: token.position });
    }
    placeTokenAt(token.id, col, row);
  }

  function undoLastMove() {
    if (!lastMove) return;
    const { tokenId, position } = lastMove;
    const occupant = tokenAt(`${position.col},${position.row}`);
    if (!occupant || occupant.id === tokenId) {
      placeTokenAt(tokenId, position.col, position.row);
    }
    setLastMove(null);
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
        moveTokenTo(movingToken, col, row);
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
    moveTokenTo(token, col, row);
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
      <div className="battle-header-row">
        <div>
          <h1 style={{ fontSize: 20, marginBottom: 4 }}>Battle board</h1>
          <p className="unit-meta" style={{ marginBottom: 20 }}>
            Place units from the catalogue, move them around, and track HP and
            weapon heat as you play. This tool manages state only — it's on you
            and your opponent to know and apply the rules.
          </p>
        </div>
        <TurnTracker turn={turn} onEndTurn={endTurn} />
      </div>

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
          <span className="unit-meta">
            Board needs at least 7 rows for deployment zones.
          </span>
        )}
        <button
          type="button"
          className="ghost"
          disabled={!lastMove}
          onClick={undoLastMove}
        >
          Undo last move
        </button>
      </div>

      <div className="map-editor-layout">
        <div className="battle-board-frame">
          <div
            className="battle-board-viewport"
            style={backgroundContainerStyle(background)}
          >
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
              hasBackground={Boolean(background)}
              size={boardSize}
              canControl={canControl}
              onHexClick={handleHexClick}
              onDropToken={handleDropToken}
            />
          </div>
          <div className="zoom-controls">
            <button
              type="button"
              className="ghost"
              aria-label="Zoom in"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => adjustZoom(ZOOM_STEP)}
            >
              +
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="ghost"
              aria-label="Zoom out"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => adjustZoom(-ZOOM_STEP)}
            >
              −
            </button>
          </div>
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
