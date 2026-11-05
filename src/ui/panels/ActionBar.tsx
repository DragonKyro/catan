import { type ReactNode } from 'react';
import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { Button } from '@/ui/shared/Button';
import { COSTS } from '@/game/types';
import { canAfford } from '@/game/resources';
import { isPairedPlayer2 } from '@/game/helpers';
import { SHIP_COST, MAX_SHIPS } from '@/game/modules/seafarers/constants';
import { canBuildShip } from '@/game/modules/seafarers/validation/shipPlacement';
import {
  lineReachesFortress,
  pirateIslandsShipViolation,
} from '@/game/modules/seafarers/pirateIslands';
import { isSetupPhase } from '@/game/actions/setup';
import type { GameState, PlayerId } from '@/game/types';
import { movableShips } from '@/ui/game/PlacementOverlay';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { setupPlacesCity } from '@/game/modules/citiesAndKnights/actions/buildWrappers';
import {
  CKMainButtons,
  CKModeExtras,
  CKRollExtras,
  ckModeHint,
  ckPhaseHint,
} from './citiesAndKnights/CKActionBar';
import { TRADERS_EXPANSION_ID, MAX_BRIDGES } from '@/game/modules/traders/constants';
import { canPlaceBridge } from '@/game/placement';
import {
  BarbarianAttackPhaseBar,
  BarbarianCardButton,
} from '@/ui/game/traders/BarbarianAttackActions';
import {
  REPAIR_ROAD_COST,
  damagedRoadsOf,
} from '@/game/modules/traders/variants/eventCards/events';
import { setupPlacementIsCity } from '@/game/modules/traders/tradersBarbarians/state';
import {
  TradersBarbariansMainButtons,
  TradersBarbariansPhaseBar,
} from '@/ui/game/traders/TradersBarbariansActions';
import {
  EpMainButtons,
  EpModeExtras,
  EpPhaseBar,
  epModeHint,
  epPhaseHint,
} from '@/ui/game/explorersPirates/ExplorersPiratesActions';
import './ActionBar.css';

export function ActionBar() {
  const { game, dispatch, setMode, openDialog, uiMode } = useGameStore();
  const undo = useGameStore((s) => s.undo);
  const canUndo = useGameStore((s) => s.lastActionSnapshot != null);
  const role = useNetworkStore((s) => s.role);
  if (!game) return null;
  const acting = getActingPlayerId(game);
  const player = game.players.find((p) => p.id === acting)!;
  const phase = game.phase;
  const showUndo = canUndo && role === 'solo';

  const wrap = (content: ReactNode) => (
    <div className="actionbar-wrap">
      {showUndo && (
        <button
          type="button"
          className="actionbar-undo-btn"
          onClick={() => undo()}
          aria-label="Undo last action"
          title="Undo last build/trade (this turn only)"
        >
          ↶
        </button>
      )}
      {content}
    </div>
  );

  if (role === 'spectator') {
    return (
      <div className="actionbar actionbar-hint">
        Spectating — you can chat but can't take actions.
      </div>
    );
  }

  // In online mode, only show actions when it's our turn.
  if (role !== 'solo') {
    const myPid = getMyPlayerId(game);
    if (myPid !== acting && phase !== 'gameOver') {
      return (
        <div className="actionbar actionbar-thinking">
          <span className="actionbar-spinner" aria-hidden /> Waiting for {player.name}…
        </div>
      );
    }
  }

  // AI is acting — render nothing.
  if (player.isAI && phase !== 'gameOver') {
    return null;
  }

  const hasCK = game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);
  const hasTraders = game.settings.expansions.includes(TRADERS_EXPANSION_ID);

  if (phase === 'rollOrPlayKnight') {
    // Under C&K, dev cards are replaced by progress cards — no "Play Knight"
    // pre-roll. Phase 8c will introduce the equivalent Alchemy pre-roll.
    // Pirate Islands: a Knight makes a warship (before the roll it counts
    // against this roll's fleet attack).
    const knightLabel = game.pirateIslands
      ? '⚔️ Knight → warship'
      : game.tradersBarbarians
        ? '⚔️ Knight (move a barbarian)'
        : '⚔️ Play Knight';
    const hasKnight =
      !hasCK &&
      !game.hasPlayedDevCardThisTurn &&
      player.devCards.unplayed.includes('knight');
    return wrap(
      <div className="actionbar">
        <div className="actionbar-slot actionbar-slot-wide">
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => {
              const d1 = 1 + Math.floor(Math.random() * 6);
              const d2 = 1 + Math.floor(Math.random() * 6);
              dispatch({ type: 'rollDice', playerId: acting, dice: [d1, d2] });
            }}
            title={
              game.eventCards
                ? 'Catan Event Cards: flip the top event card — resolve its event, then produce for its number'
                : undefined
            }
          >
            {game.eventCards ? '📜 Flip event card' : '🎲 Roll dice'}
          </Button>
        </div>
        {hasKnight && (
          <div className="actionbar-slot actionbar-slot-wide">
            <Button
              fullWidth
              onClick={() => dispatch({ type: 'playKnight', playerId: acting })}
            >
              {knightLabel}
            </Button>
          </div>
        )}
        {hasCK && <CKRollExtras game={game} acting={acting} />}
      </div>,
    );
  }

  if (phase === 'main') {
    const inMode = uiMode.kind !== 'idle';
    const cancel = () => setMode({ kind: 'idle' });
    if (inMode) {
      const rb = uiMode.kind === 'roadBuilding' ? uiMode : null;
      const back =
        uiMode.kind === 'moveShip' && uiMode.from
          ? () => setMode({ kind: 'moveShip' })
          : null;
      return wrap(
        <div className="actionbar">
          <div className="actionbar-hint actionbar-slot-wide">{modeHint(uiMode, game)}</div>
          {rb?.first && (
            <Button
              onClick={() =>
                dispatch({
                  type: 'playRoadBuilding',
                  playerId: acting,
                  edges: rb.first!.ship ? [] : [rb.first!.edge],
                  ships: rb.first!.ship ? [rb.first!.edge] : [],
                })
              }
              title="Place only this one piece"
            >
              Done (1 piece)
            </Button>
          )}
          {back && <Button onClick={back}>◂ Pick another ship</Button>}
          {hasCK && <CKModeExtras acting={acting} uiMode={uiMode} />}
          {game.explorersPirates && <EpModeExtras game={game} acting={acting} uiMode={uiMode} />}
          <div className="actionbar-slot">
            <Button fullWidth onClick={cancel}>
              Cancel
            </Button>
          </div>
        </div>,
      );
    }
    // Explorers & Pirates: its own Action phase (harbor settlements, ships,
    // settlers, crews; no cities or development cards).
    if (game.explorersPirates) {
      return wrap(
        <div className="actionbar">
          <EpMainButtons game={game} acting={acting} />
        </div>,
      );
    }
    // 5+ player paired-player rule: when the acting seat is Player 2,
    // the trade button collapses to a bank-only label and we suppress the
    // player-trade dialog entry point. P2 can still bank-trade.
    const pairedP2 = isPairedPlayer2(game);
    // T&B Catan Event Cards / Earthquake: damaged roads block new roads.
    const damaged = game.damagedRoads ? damagedRoadsOf(game, acting) : [];
    return wrap(
      <div className="actionbar">
        <Button
          disabled={!canAfford(player.resources, COSTS.road) || damaged.length > 0}
          onClick={() => setMode({ kind: 'buildRoad' })}
          title={
            damaged.length > 0
              ? 'Earthquake: repair your damaged roads before building new ones'
              : 'Build Road (1🌲 1🧱)'
          }
        >
          🛣 Road
        </Button>
        {damaged.length > 0 && (
          <Button
            disabled={!canAfford(player.resources, REPAIR_ROAD_COST)}
            onClick={() => dispatch({ type: 'repairRoad', playerId: acting, edge: damaged[0]! })}
            title={`Repair a damaged road (1🧱 1🌲) — ${damaged.length} damaged`}
          >
            🔧 Repair ({damaged.length})
          </Button>
        )}
        {game.settings.expansions.includes('seafarers') && (
          <Button
            disabled={
              !canAfford(player.resources, SHIP_COST) ||
              player.ships.length >= MAX_SHIPS ||
              !hasShipSpot(game, acting)
            }
            onClick={() => setMode({ kind: 'buildShip' })}
            title={
              player.ships.length >= MAX_SHIPS
                ? 'No ships left (15 max)'
                : !hasShipSpot(game, acting)
                  ? 'No legal place for a ship — ships extend from your ships or coastal buildings'
                  : `Build Ship (1🌲 1🐑) — ${MAX_SHIPS - player.ships.length} left`
            }
          >
            ⛵ Ship
          </Button>
        )}
        {game.settings.expansions.includes('seafarers') && player.ships.length > 0 && (
          <Button
            disabled={movableShips(game, acting).length === 0}
            onClick={() => setMode({ kind: 'moveShip' })}
            title={
              player.movedShipThisTurn
                ? 'You already moved a ship this turn'
                : movableShips(game, acting).length === 0
                  ? 'No ship can move: it needs an open end, must not be built this turn, and can\'t leave or enter the pirate\'s hex'
                  : 'Move one ship (once per turn) — pick a ship at the open end of a line'
            }
          >
            ⛵ Move
          </Button>
        )}
        {hasTraders && (game.riverEdges?.length ?? 0) > 0 && (() => {
          const left = MAX_BRIDGES - (player.bridges?.length ?? 0);
          const site = (game.riverEdges ?? []).some((e) => canPlaceBridge(game, acting, e));
          return (
            <Button
              disabled={!canAfford(player.resources, COSTS.bridge) || left <= 0 || !site}
              onClick={() => setMode({ kind: 'buildBridge' })}
              title={
                left <= 0
                  ? 'No bridges left (3 each)'
                  : !site
                    ? "No bridge site joins your roads or buildings (and not past an opponent's building)"
                    : `Build Bridge (2🧱 1🌲) on a bridge site, +3 gold. ${left} left. Counts as a road for Longest Route.`
              }
            >
              🌉 Bridge
            </Button>
          );
        })()}
        {game.coinsInPlay && (
          <Button
            onClick={() => openDialog('coins')}
            title="Coins: spend 2 gold for any card (twice a turn) or buy gold with cards at your bank rate"
          >
            🪙 Coins ({player.gold ?? 0})
          </Button>
        )}
        <Button
          disabled={
            !canAfford(player.resources, COSTS.settlement) ||
            player.settlements.length >= 5
          }
          onClick={() => setMode({ kind: 'buildSettlement' })}
          title="Build Settlement (1🌲 1🧱 1🐑 1🌾)"
        >
          🏠 Settlement
        </Button>
        <Button
          disabled={
            !canAfford(player.resources, COSTS.city) ||
            player.cities.length >= 4 ||
            player.settlements.length === 0
          }
          onClick={() => setMode({ kind: 'buildCity' })}
          title="Build City (2🌾 3🪨)"
        >
          🏛 City
        </Button>
        {hasCK && <CKMainButtons game={game} acting={acting} player={player} />}
        {game.barbarianAttack && <BarbarianCardButton game={game} acting={acting} />}
        {/* T&B scenario: wagon upgrade + the scenario's own deck. */}
        {game.tradersBarbarians && <TradersBarbariansMainButtons game={game} acting={acting} />}
        {!hasCK && !game.barbarianAttack && !game.tradersBarbarians && (
          <Button
            disabled={
              !canAfford(player.resources, COSTS.devCard) ||
              game.devCardDeck.length === 0
            }
            onClick={() => dispatch({ type: 'buyDevCard', playerId: acting })}
            title="Buy Dev Card (1🐑 1🌾 1🪨)"
          >
            🃏 Dev Card
          </Button>
        )}
        {pairedP2 ? (
          <Button
            onClick={() => openDialog('bankTrade')}
            title="Paired-turn Player 2 — bank trades only (no player trades)"
          >
            🏦 Bank trade
          </Button>
        ) : (
          <Button
            onClick={() => openDialog('playerTrade')}
            disabled={!!game.pendingTrade}
            title="Trade — single-resource swaps the bank can match are auto-routed; everything else is offered to other players"
          >
            🤝 Trade
          </Button>
        )}
        {game.wonders && game.wonders.length > 0 && (
          <Button
            onClick={() => openDialog('wonders')}
            title="Claim and build a wonder — finish it to win"
          >
            🏛️ Wonder
          </Button>
        )}
        {(player.fishTokens?.length ?? 0) > 0 && (
          <Button
            onClick={() => openDialog('spendFish')}
            title="Spend fish: 2 remove the robber, 3 steal a card, 4 take a card, 5 free road, 7 free development card"
          >
            🐟 Spend ({player.fishTokens!.length})
          </Button>
        )}
        {game.oldBootHolder === acting && (
          <Button
            onClick={() => openDialog('passBoot')}
            title="Pass the old boot to any opponent with ≥ your visible VPs"
          >
            👢 Pass boot
          </Button>
        )}
        <div className="actionbar-slot actionbar-slot-end">
          <Button
            variant="primary"
            fullWidth
            onClick={() => dispatch({ type: 'endTurn', playerId: acting })}
            title={
              game.pirateIslands && lineReachesFortress(game, acting)
                ? 'Your ships reach your pirate fortress: ending your turn attacks it (roll a die vs your warships)'
                : game.tradersBarbarians
                  ? 'End your Action phase: move your wagon, then Done passes the turn'
                  : undefined
            }
          >
            {game.pirateIslands && lineReachesFortress(game, acting)
              ? '⚔ End & attack ▸'
              : game.tradersBarbarians
                ? '🛒 Move wagon ▸'
                : 'End turn ▸'}
          </Button>
        </div>
      </div>,
    );
  }

  // T&B Barbarian Attack: card choices and the end-of-turn knight moves.
  if (phase === 'barbarianCard' || phase === 'barbarianKnightMoves') {
    return wrap(<BarbarianAttackPhaseBar game={game} acting={acting} />);
  }
  // T&B scenario: placing a barbarian, the End of Turn wagon moves.
  if (phase === 'moveBarbarian' || phase === 'wagonMoves') {
    return wrap(<TradersBarbariansPhaseBar game={game} acting={acting} />);
  }
  // Explorers & Pirates: the Movement phase, placing your pirate ship.
  if (phase === 'epMovement' || phase === 'epPlacePirate') {
    return wrap(<EpPhaseBar game={game} acting={acting} />);
  }

  // Other phases are driven by board highlights or dialogs; say what's
  // expected so a player is never left guessing.
  const hint = phaseHint(game, acting);
  return hint ? <div className="actionbar actionbar-hint">{hint}</div> : null;
}

function hasShipSpot(game: GameState, pid: PlayerId): boolean {
  return game.board.edgeIds.some(
    (eid) => canBuildShip(game, pid, eid) && !pirateIslandsShipViolation(game, pid, eid),
  );
}

function modeHint(mode: ReturnType<typeof useGameStore.getState>['uiMode'], game: GameState): string {
  switch (mode.kind) {
    case 'buildRoad':
      return 'Pick a highlighted edge for your road.';
    case 'buildShip':
      return 'Pick a highlighted edge for your ship — it must touch one of your ships or coastal buildings.';
    case 'moveShip':
      return mode.from
        ? 'Pick where the ship goes.'
        : 'Pick a ship to move (only the open end of a line can move).';
    case 'roadBuilding':
      return mode.first
        ? 'Road Building: place your second piece (or finish with one).'
        : 'Road Building: place 2 free pieces — roads, ships (⛵), or one of each.';
    case 'buildSettlement':
      return 'Pick a highlighted intersection for your settlement.';
    case 'buildCity':
      return 'Pick one of your settlements to upgrade.';
    case 'buildBridge':
      return "Pick a highlighted bridge site: it must join your road or building, and not past an opponent's building.";
    case 'fishRoad':
      return 'Pick a highlighted edge for your free road (paid with fish).';
    default:
      return epModeHint(mode, game) ?? ckModeHint(mode) ?? '';
  }
}

function phaseHint(game: GameState, pid: PlayerId): string | null {
  const seafarers = game.settings.expansions.includes('seafarers');
  const ep = epPhaseHint(game);
  if (ep) return ep;
  if (isSetupPhase(game.phase)) {
    const step = game.setupState?.step;
    const round =
      game.phase === 'setupRound3' ? 3 : game.phase === 'setupRound2' ? 2 : 1;
    const pays = (game.settings.setupRounds === 3 ? 3 : 2) === round;
    if (step === 'settlement') {
      const where = game.startingIslands
        ? game.startingIslands.length > 1
          ? ' on one of the large islands'
          : ' on the main island'
        : '';
      // Cities & Knights: the second starting piece is a city (p.5).
      if (setupPlacesCity(game)) {
        return 'Place your starting city — it collects 1 resource per adjacent hex.';
      }
      // T&B Barbarian Attack / Traders & Barbarians: the second starting
      // placement is a city.
      const piece = setupPlacementIsCity(game) ? 'city' : 'settlement';
      return `Place starting ${piece} ${round}${where}${pays ? ' — it collects starting resources' : ''}.`;
    }
    return seafarers
      ? 'Place a road next to it — or, on the coast, a ship (⛵) instead.'
      : 'Place a road next to it.';
  }
  const ck = ckPhaseHint(game, pid);
  if (ck) return ck;
  if (game.phase === 'moveRobber') return 'Move the robber: pick a highlighted hex.';
  if (game.phase === 'wagonVoting') {
    return game.wagonVote?.stage === 'assign'
      ? 'Merchant Trains: give your votes to a lettered spot on the board.'
      : 'Merchant Trains: bid wool / wheat for where the wagon goes (or pass).';
  }
  if (game.phase === 'placeWagon') return 'Merchant Trains: click a lettered spot for the wagon.';
  if (game.phase === 'eventResolution') return 'Event card: answer the event above.';
  if (game.phase === 'fishSwap') {
    return game.fishSwap?.queue[0] === pid
      ? 'Your fish hand is full: swap one token for a new draw, or keep your fish.'
      : 'Waiting for a full fish hand to decide on a swap.';
  }
  if (game.phase === 'movePirate') {
    return 'Move the pirate: pick a sea hex. Ships can\'t be built or moved on its edges.';
  }
  if (game.phase === 'placeTribePort' && game.pendingTribePort?.playerId === pid) {
    const t = game.pendingTribePort.portType;
    return `Place your ${t === 'generic' ? '3:1' : `2:1 ${t}`} port from the tribe next to one of your coastal settlements (at least one edge from other ports).`;
  }
  return null;
}
