import { useEffect, useRef, useState } from 'react';
import { useLocalStorageState, makeKey } from '../lib/storage.js';
import { backgroundContainerStyle } from '../lib/mapBackground.js';
import { formatRollLogMessage, parseHitDice } from '../lib/dice.js';
import {
  createToken,
  OWNERS,
  deployedDiceByOwner,
  sumDiceTotals,
  parseWeaponRange,
  parseHeatRating,
} from '../lib/tokens.js';
import {
  resetActiveGame,
  DEFAULT_TURN,
  DEFAULT_BANKED_DICE,
} from '../lib/gameState.js';
import BattleBoard from '../components/BattleBoard.jsx';
import TokenForm from '../components/TokenForm.jsx';
import TokenCard from '../components/TokenCard.jsx';
import RosterImport from '../components/RosterImport.jsx';
import RosterList from '../components/RosterList.jsx';
import ReserveList from '../components/ReserveList.jsx';
import DestroyedList from '../components/DestroyedList.jsx';
import TurnTracker from '../components/TurnTracker.jsx';
import TurnOrder from '../components/TurnOrder.jsx';
import DiceRoller from '../components/DiceRoller.jsx';
import GameLog from '../components/GameLog.jsx';
import manufacturers from '../data/manufacturers.json';
import units from '../data/units.json';
import equipment from '../data/equipment.json';

const DEFAULT_TILE_TYPES = [
  { id: 'plain', name: 'Plain', color: '#78716c' },
  { id: 'buildings', name: 'Buildings', color: '#9ca3af' },
  { id: 'forest', name: 'Forest', color: '#14532d' },
  { id: 'objective', name: 'Objective', color: '#f97316' },
];
const DEFAULT_DIMENSIONS = { cols: 14, rows: 10 };
// Must match .battle-board-viewport's width in index.css.
const BOARD_WIDTH = 1000;
// .battle-board-viewport's own padding (1rem each side) + border (1px each
// side) — subtracted so the board fits inside it without an unwanted
// horizontal scrollbar at 100% zoom.
const BOARD_PADDING = 34;
// Rough allowance for everything above/around the board viewport (nav bar,
// page header, turn tracker, deployment controls, zoom controls) so the
// auto-fit zoom keeps the whole board on screen without vertical scrolling.
const BOARD_CHROME_HEIGHT = 300;
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 2;
const ZOOM_STEP = 0.25;

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
    true,
  );
  const [myPlayer] = useLocalStorageState('dropshipsimulator:myPlayer', null);
  const [selectedTokenId, setSelectedTokenId] = useState(null);
  const [draft, setDraft] = useState(null);
  const [movingTokenId, setMovingTokenId] = useState(null);
  const [sidebarTab, setSidebarTab] = useState('add');
  const [rangeWeapon, setRangeWeapon] = useState(null);
  const [lastAction, setLastAction] = useState(null);
  const [zoom, setZoom] = useState(1);
  const diceRollerRef = useRef(null);
  const [viewportHeight, setViewportHeight] = useState(
    () => window.innerHeight,
  );

  useEffect(() => {
    function onResize() {
      setViewportHeight(window.innerHeight);
    }
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  const [turn, setTurn] = useLocalStorageState(
    'dropshipsimulator:battle:turn',
    DEFAULT_TURN,
  );
  const [logEntries, setLogEntries] = useLocalStorageState(
    'dropshipsimulator:battle:log',
    [],
  );
  const [bankedDice, setBankedDice] = useLocalStorageState(
    'dropshipsimulator:battle:bankedDice',
    DEFAULT_BANKED_DICE,
  );
  const [actionPool, setActionPool] = useLocalStorageState(
    'dropshipsimulator:battle:actionPool',
    [],
  );

  function appendLog(message) {
    setLogEntries((current) =>
      [{ id: makeKey('log'), message }, ...current].slice(0, 200),
    );
  }

  function unitName(token) {
    return (
      units.find((u) => Number(u.id) === Number(token.unitId))?.name ?? 'Unit'
    );
  }

  function ownerLabel(ownerId) {
    return OWNERS.find((o) => o.id === ownerId)?.label ?? ownerId;
  }

  function endTurn() {
    setTurn((current) => {
      const next =
        current.active === 'p1'
          ? { number: current.number, active: 'p2' }
          : { number: current.number + 1, active: 'p1' };
      appendLog(`${ownerLabel(current.active)} ended their turn`);
      return next;
    });
    setActionPool([]);
    setLastAction(null);
  }

  function endGame() {
    if (
      !window.confirm(
        'End this game? This will delete all deployed units and reset the board.',
      )
    ) {
      return;
    }
    resetActiveGame();
    setSelectedTokenId(null);
    setDraft(null);
    setMovingTokenId(null);
    setLastAction(null);
    window.location.hash = '#home';
  }

  function handleDiceRoll(rolled) {
    appendLog(formatRollLogMessage(rolled));
  }

  function rollToActionPool(dice) {
    setActionPool(dice.map((d) => ({ ...d, used: false })));
    setLastAction({ type: 'rollToPool', dieIds: dice.map((d) => d.id) });
  }

  function useActionPoolDie(dieId) {
    const die = actionPool.find((d) => d.id === dieId);
    setActionPool((current) =>
      current.map((d) => (d.id === dieId ? { ...d, used: true } : d)),
    );
    setLastAction({ type: 'useDie', dieId });
    if (die) appendLog(`Used a ${die.label.toLowerCase()} die: ${die.value}`);
  }

  function undoLastAction() {
    if (!lastAction) return;
    if (lastAction.type === 'rollToPool') {
      setActionPool((current) =>
        current.filter((d) => !lastAction.dieIds.includes(d.id)),
      );
      appendLog('Undid dice roll into Action Pool');
    } else if (lastAction.type === 'useDie') {
      setActionPool((current) =>
        current.map((d) =>
          d.id === lastAction.dieId ? { ...d, used: false } : d,
        ),
      );
      appendLog('Undid using a die from the Action Pool');
    } else if (lastAction.type === 'move') {
      const { tokenId, position } = lastAction;
      const occupant = tokenAt(`${position.col},${position.row}`);
      if (!occupant || occupant.id === tokenId) {
        placeTokenAt(tokenId, position.col, position.row);
      }
      const token = tokens.find((t) => t.id === tokenId);
      appendLog(`Undid ${token ? unitName(token) + "'s" : 'the'} last move`);
    }
    setLastAction(null);
  }

  const selectedToken = tokens.find((t) => t.id === selectedTokenId) ?? null;
  const selectedUnit = selectedToken
    ? units.find((u) => Number(u.id) === Number(selectedToken.unitId))
    : null;
  const reserveTokens = tokens.filter((t) => !t.position && !t.destroyed);
  const destroyedTokens = tokens.filter((t) => t.destroyed);
  const playerDice = sumDiceTotals(
    deployedDiceByOwner(tokens, units),
    bankedDice,
  );
  const activeOwnerDice = playerDice[myPlayer ?? turn.active];

  function toggleWeaponRange(instanceIndex, range) {
    setRangeWeapon((current) =>
      current?.tokenId === selectedToken?.id &&
      current?.instanceIndex === instanceIndex
        ? null
        : { tokenId: selectedToken?.id, instanceIndex, range },
    );
  }

  const activeRangeSpec =
    rangeWeapon &&
    selectedToken?.id === rangeWeapon.tokenId &&
    selectedToken.position
      ? parseWeaponRange(rangeWeapon.range)
      : null;
  const weaponRange = activeRangeSpec
    ? { origin: selectedToken.position, ...activeRangeSpec }
    : null;

  function movementForToken(token) {
    const movementItem = token.equippedIds
      .map((id) => equipment.find((e) => Number(e.id) === Number(id)))
      .find((item) => item?.type === 'Movement');
    return Number(movementItem?.movement) || 0;
  }

  const selectedMovement =
    selectedToken?.position && !selectedToken.destroyed
      ? movementForToken(selectedToken)
      : 0;
  const moveRange =
    selectedMovement > 0
      ? { origin: selectedToken.position, max: selectedMovement }
      : null;

  function canControl(token) {
    return !myPlayer || token.owner === myPlayer;
  }

  const fitWidth =
    (BOARD_WIDTH - BOARD_PADDING) / (1.5 * (dimensions.cols + 1));
  const availableHeight = Math.max(200, viewportHeight - BOARD_CHROME_HEIGHT);
  const fitHeight =
    (availableHeight - BOARD_PADDING) / (Math.sqrt(3) * (dimensions.rows + 1));
  const fitSize = Math.min(fitWidth, fitHeight);
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
      setLastAction({
        type: 'move',
        tokenId: token.id,
        position: token.position,
      });
      appendLog(
        `${ownerLabel(token.owner)} moved ${unitName(token)} to (${col}, ${row})`,
      );
    } else {
      appendLog(
        `${ownerLabel(token.owner)} deployed ${unitName(token)} at (${col}, ${row})`,
      );
    }
    placeTokenAt(token.id, col, row);
  }

  function handleHexClick(key) {
    const [col, row] = key.split(',').map(Number);

    if (draft) {
      if (tokenAt(key) || !canControl({ owner: draft.owner })) return;
      const token = createToken({ ...draft, position: { col, row } });
      setTokens((current) => [...current, token]);
      appendLog(
        `${ownerLabel(draft.owner)} deployed ${draft.unit.name} at (${col}, ${row})`,
      );
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

  function setWeaponHp(weaponId, hp) {
    updateSelected((t) => ({
      weaponState: {
        ...t.weaponState,
        [weaponId]: { ...t.weaponState[weaponId], hp },
      },
    }));
  }

  function rollHitDice(instanceIndex, item) {
    const parsed = parseHitDice(item.hit_dice);
    if (!parsed) return;
    diceRollerRef.current?.addDice(parsed.dieId, parsed.count);
    const { generate } = parseHeatRating(item.heat_rating);
    if (generate > 0) {
      const currentHeat = selectedToken?.weaponState[instanceIndex]?.heat ?? 0;
      setHeat(instanceIndex, currentHeat + generate);
    }
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

  function destroySelected(keptDiceColor) {
    if (selectedToken) {
      appendLog(
        `${ownerLabel(selectedToken.owner)}'s ${unitName(selectedToken)} was destroyed` +
          (keptDiceColor ? ` (kept a ${keptDiceColor} die)` : ''),
      );
      if (keptDiceColor) {
        const owner = selectedToken.owner;
        setBankedDice((current) => ({
          ...current,
          [owner]: {
            ...current[owner],
            [keptDiceColor]: (current[owner]?.[keptDiceColor] ?? 0) + 1,
          },
        }));
      }
    }
    updateSelected(() => ({
      destroyed: true,
      position: null,
      bankedDieColor: keptDiceColor ?? null,
    }));
    setMovingTokenId(null);
  }

  // Reverses the die banked at destruction time (if any) so redeploying a
  // returned model doesn't double-count its dice against the one already
  // added to the player's pool.
  function releaseBankedDie(token) {
    if (!token.bankedDieColor) return;
    const { owner, bankedDieColor } = token;
    setBankedDice((current) => ({
      ...current,
      [owner]: {
        ...current[owner],
        [bankedDieColor]: Math.max(
          0,
          (current[owner]?.[bankedDieColor] ?? 0) - 1,
        ),
      },
    }));
  }

  function returnSelectedToReserve() {
    if (selectedToken) {
      appendLog(`${unitName(selectedToken)} returned to reserve`);
      releaseBankedDie(selectedToken);
    }
    updateSelected(() => ({
      destroyed: false,
      position: null,
      bankedDieColor: null,
    }));
    setMovingTokenId(null);
  }

  function returnDestroyedToReserve(tokenId) {
    const token = tokens.find((t) => t.id === tokenId);
    if (token) {
      appendLog(`${unitName(token)} returned to reserve`);
      releaseBankedDie(token);
    }
    setTokens((current) =>
      current.map((t) =>
        t.id === tokenId
          ? { ...t, destroyed: false, position: null, bankedDieColor: null }
          : t,
      ),
    );
  }

  function importRoster({ entries, owner }) {
    const imported = entries.map(({ unit, equippedIds }) =>
      createToken({ unit, equippedIds, owner, position: null }),
    );
    setTokens((current) => [...current, ...imported]);
    appendLog(
      `${ownerLabel(owner)} imported ${imported.length} unit${imported.length === 1 ? '' : 's'} to reserve`,
    );
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
        <TurnTracker turn={turn} onEndTurn={endTurn} playerDice={playerDice} />
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
      </div>

      <div className="battle-layout">
        <div>
          {selectedToken && !deploymentPhase ? (
            <div
              className="token-card-mobile-overlay"
              onClick={(e) => {
                if (e.target === e.currentTarget) setSelectedTokenId(null);
              }}
            >
              <TokenCard
                key={selectedToken.id}
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
                onSetWeaponHp={setWeaponHp}
                onToggleBroken={toggleBroken}
                onRollHitDice={rollHitDice}
                activeRangeIndex={
                  rangeWeapon?.tokenId === selectedToken.id
                    ? rangeWeapon.instanceIndex
                    : null
                }
                onToggleRange={toggleWeaponRange}
                onDestroy={destroySelected}
                onReturnToReserve={returnSelectedToReserve}
                onDeselect={() => setSelectedTokenId(null)}
              />
            </div>
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
          ) : null}
          <ReserveList
            tokens={reserveTokens}
            units={units}
            selectedTokenId={selectedTokenId}
            canControl={canControl}
            onSelect={setSelectedTokenId}
          />
          <RosterList
            tokens={tokens}
            units={units}
            myPlayer={myPlayer}
            selectedTokenId={selectedTokenId}
            onSelect={setSelectedTokenId}
          />
          <DestroyedList
            tokens={destroyedTokens}
            units={units}
            selectedTokenId={selectedTokenId}
            canControl={canControl}
            onSelect={setSelectedTokenId}
            onReturnToReserve={returnDestroyedToReserve}
          />
        </div>
        <div className="battle-board-column">
          <div className="zoom-controls">
            <button
              type="button"
              className="ghost"
              aria-label="Zoom out"
              disabled={zoom <= ZOOM_MIN}
              onClick={() => adjustZoom(-ZOOM_STEP)}
            >
              −
            </button>
            <span className="zoom-level">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              className="ghost"
              aria-label="Zoom in"
              disabled={zoom >= ZOOM_MAX}
              onClick={() => adjustZoom(ZOOM_STEP)}
            >
              +
            </button>
          </div>
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
              weaponRange={weaponRange}
              moveRange={moveRange}
              deploymentZones={deploymentZones}
              hasBackground={Boolean(background)}
              size={boardSize}
              canControl={canControl}
              onHexClick={handleHexClick}
              onDropToken={handleDropToken}
            />
          </div>
        </div>
        <div>
          <TurnOrder />
          <DiceRoller
            ref={diceRollerRef}
            onRoll={handleDiceRoll}
            actionPool={actionPool}
            onRollToActionPool={rollToActionPool}
            onUseActionPoolDie={useActionPoolDie}
            activeOwnerDice={activeOwnerDice}
          />
          <div className="card">
            <button
              type="button"
              className="ghost"
              style={{ width: '100%' }}
              disabled={!lastAction}
              onClick={undoLastAction}
            >
              {lastAction?.type === 'rollToPool'
                ? 'Undo dice roll'
                : lastAction?.type === 'useDie'
                  ? 'Undo used die'
                  : 'Undo last move'}
            </button>
          </div>
          <GameLog entries={logEntries} />
          <div className="card">
            <button
              type="button"
              className="danger"
              style={{ width: '100%' }}
              onClick={endGame}
            >
              End Game
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BattlePage;
