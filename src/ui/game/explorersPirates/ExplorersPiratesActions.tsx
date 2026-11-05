import { useGameStore, type UIMode } from '@/store/gameStore';
import { Button } from '@/ui/shared/Button';
import { COSTS } from '@/game/types';
import type { EpCargo, GameState, PlayerId } from '@/game/types';
import { canAfford, totalResources } from '@/game/resources';
import { canConnectRoad, canPlaceSettlement } from '@/game/placement';
import {
  buildableShipEdges,
  epSupply,
  farmCount,
  harborUpgradeSpots,
  isExplorersPirates,
  moveCanEnd,
  pieceSpots,
  shipsOf,
} from '@/game/modules/explorersPirates/state';
import { EP_BOOST_MP, EP_COSTS, EP_PIECES } from '@/game/modules/explorersPirates/constants';
import { costText } from '@/ui/game/traders/TradersBarbariansActions';
import { CargoIcon, EP_CARGO_LABEL } from './EpArt';
import { hexAction, hexActions } from './ExplorersPiratesOverlay';
import { epSelectedShip, epShipOptions, evictionChoices } from './shipActions';

// Explorers & Pirates controls in the ActionBar: the Action phase builds
// (roads, settlements, harbor settlements, ships, settlers, crews, Fast
// Gold, coins, trade), the Movement phase bar (pick a ship, its MP, boost,
// every ship action it can take where it is, the fish roll, Done) and the
// pirate-ship prompt. The ActionBar only renders these for the acting
// seat's own device.

function pieceCost(piece: 'settler' | 'crew') {
  return piece === 'settler' ? EP_COSTS.settler : EP_COSTS.crew;
}

export function EpMainButtons({ game, acting }: { game: GameState; acting: PlayerId }) {
  const { dispatch, setMode, openDialog } = useGameStore();
  const player = game.players.find((p) => p.id === acting);
  if (!isExplorersPirates(game) || !player) return null;
  const supply = epSupply(game, acting);
  const res = player.resources;
  const roadSpot = game.board.edgeIds.some((e) => canConnectRoad(game, acting, e));
  const settleSpot = game.board.vertexIds.some((v) => canPlaceSettlement(game, acting, v));
  const harborSpots = harborUpgradeSpots(game, acting);
  const shipEdges = buildableShipEdges(game, acting);
  const fastGold = farmCount(game, acting, 'fastGold');
  const fastLeft = fastGold - game.explorersPirates.fastGoldUsed;
  const pieceButton = (piece: 'settler' | 'crew') => {
    const left = piece === 'settler' ? supply.settlers : supply.crews;
    const spots = pieceSpots(game, acting, piece, false);
    const cost = pieceCost(piece);
    const reason =
      left <= 0
        ? `All your ${piece}s are on the board`
        : spots.length === 0
          ? `A ${piece} goes onto a harbor settlement of yours or a ship of yours next to one`
          : !canAfford(res, cost)
            ? `Needs ${costText(cost)}`
            : null;
    return (
      <Button
        key={piece}
        disabled={reason !== null}
        onClick={() => setMode({ kind: 'epPiece', piece })}
        title={
          reason ??
          (piece === 'settler'
            ? `Build a settler (${costText(cost)}) on a harbor settlement or a ship next to one — it fills a ship and founds a settlement. ${left} left.`
            : `Build a crew (${costText(cost)}) on a harbor settlement or a ship next to one — crews capture pirate lairs and work spice farms. ${left} left.`)
        }
      >
        <CargoIcon piece={piece} color={player.color} size={16} /> {piece === 'settler' ? 'Settler' : 'Crew'}
      </Button>
    );
  };
  return (
    <>
      <Button
        disabled={!canAfford(res, COSTS.road) || supply.roads <= 0 || !roadSpot}
        onClick={() => setMode({ kind: 'buildRoad' })}
        title={
          supply.roads <= 0
            ? 'No roads left'
            : !roadSpot
              ? 'No legal road: roads join your roads or buildings, on explored land (not by an uncaptured gold field or a spice farm without your crew)'
              : `Build Road (${costText(COSTS.road)}) — ${supply.roads} left`
        }
      >
        🛣 Road
      </Button>
      <Button
        disabled={!canAfford(res, COSTS.settlement) || supply.settlements <= 0 || !settleSpot}
        onClick={() => setMode({ kind: 'buildSettlement' })}
        title={
          supply.settlements <= 0
            ? `All ${EP_PIECES.settlements} settlements are on the board (harbor upgrades free one)`
            : !settleSpot
              ? 'No legal spot: a settlement needs your road, the distance rule, and explored land around it'
              : `Build Settlement (${costText(COSTS.settlement)}) — ${supply.settlements} left`
        }
      >
        🏠 Settlement
      </Button>
      <Button
        disabled={!canAfford(res, EP_COSTS.harbor) || harborSpots.length === 0}
        onClick={() => setMode({ kind: 'epHarbor' })}
        title={
          supply.harbors <= 0
            ? `All ${EP_PIECES.harbors} harbor settlements are built`
            : harborSpots.length === 0
              ? 'A harbor settlement replaces one of your settlements on the coast'
              : `Harbor settlement (${costText(EP_COSTS.harbor)}): upgrade a coastal settlement — 2 VP, builds ships, stores 2 pieces. ${supply.harbors} left.`
        }
      >
        ⚓ Harbor
      </Button>
      <Button
        disabled={!canAfford(res, EP_COSTS.ship) || (supply.ships > 0 && shipEdges.length === 0)}
        onClick={() => setMode({ kind: 'epShip' })}
        title={
          supply.ships > 0 && shipEdges.length === 0
            ? 'Ships go on an empty sea edge next to one of your harbor settlements'
            : supply.ships <= 0
              ? `Build a ship (${costText(EP_COSTS.ship)}): all 3 are out, so first pick one to bring home (with its cargo)`
              : `Build a ship (${costText(EP_COSTS.ship)}) next to a harbor settlement — ${supply.ships} left`
        }
      >
        ⛵ Ship
      </Button>
      {pieceButton('settler')}
      {pieceButton('crew')}
      {fastGold > 0 && (
        <Button
          disabled={fastLeft <= 0 || totalResources(res) === 0}
          onClick={() => openDialog('epFastGold')}
          title={
            fastLeft <= 0
              ? 'Fast Gold already used this turn'
              : `Fast Gold: trade 1 resource card for 1 gold (${fastLeft} left this turn)`
          }
        >
          ⚡🪙 Fast Gold
        </Button>
      )}
      <Button
        onClick={() => openDialog('coins')}
        title="Coins: spend 2 gold for any card (twice a turn), or buy 1 gold with 3 cards"
      >
        🪙 Coins ({player.gold ?? 0})
      </Button>
      <Button
        onClick={() => openDialog('playerTrade')}
        disabled={!!game.pendingTrade}
        title="Trade with players, or 3:1 with the supply (single-resource swaps the supply can match are routed there)"
      >
        🤝 Trade
      </Button>
      <div className="actionbar-slot actionbar-slot-end">
        <Button
          variant="primary"
          fullWidth
          onClick={() => dispatch({ type: 'endTurn', playerId: acting })}
          title="End the Action phase: move your ships, then Done passes the turn"
        >
          ⛵ Movement ▸
        </Button>
      </div>
    </>
  );
}

// Extra controls while an E&P build mode is open.
export function EpModeExtras({ game, acting, uiMode }: { game: GameState; acting: PlayerId; uiMode: UIMode }) {
  const { dispatch, setMode } = useGameStore();
  if (uiMode.kind === 'epShip' && uiMode.recycle) {
    return <Button onClick={() => setMode({ kind: 'epShip' })}>◂ Other ship</Button>;
  }
  if (uiMode.kind !== 'epPiece' || !uiMode.at) return null;
  const at = uiMode.at;
  const piece = uiMode.piece;
  const player = game.players.find((p) => p.id === acting);
  if (!player) return null;
  const choices = evictionChoices(game, at, piece);
  return (
    <>
      {choices.map((evict) => (
        <Button
          key={evict.join('+')}
          onClick={() =>
            dispatch(
              piece === 'settler'
                ? { type: 'epBuildSettler', playerId: acting, at, evict }
                : { type: 'epBuildCrew', playerId: acting, at, evict },
            )
          }
          title={`Return ${describe(evict)} to your supply and put the ${piece} here`}
        >
          ↺ {evict.map((c, i) => (
            <CargoIcon key={i} piece={c} color={player.color} size={15} />
          ))}{' '}
          → <CargoIcon piece={piece} color={player.color} size={15} />
        </Button>
      ))}
      <Button onClick={() => setMode({ kind: 'epPiece', piece })}>◂ Back</Button>
    </>
  );
}

function describe(pieces: readonly EpCargo[]): string {
  return pieces.map((c) => `a ${EP_CARGO_LABEL[c]}`).join(' and ');
}

export function epModeHint(mode: UIMode, game: GameState | null): string | null {
  switch (mode.kind) {
    case 'epHarbor':
      return 'Pick one of your coastal settlements to become a harbor settlement.';
    case 'epShip':
      return mode.recycle || !game || epSupply(game, game.playerOrder[game.currentPlayerIndex]!).ships > 0
        ? 'Pick an empty sea edge next to one of your harbor settlements for the ship.'
        : 'All 3 ships are out: pick the ship to bring home (its cargo goes back too).';
    case 'epPiece':
      return mode.at
        ? `No room there for the ${mode.piece}: choose what goes back to your supply.`
        : `Pick a harbor settlement of yours, or a ship of yours next to one, for the ${mode.piece}.`;
    default:
      return null;
  }
}

// Setup prompts (rounds 1-3 of the Rulebook's variable setup).
export function epPhaseHint(game: GameState): string | null {
  if (!game.explorersPirates) return null;
  if (game.phase === 'setupRound1') {
    return 'Place your harbor settlement on a marked intersection (✓) of the island’s east coast. It’s worth 2 VP and builds ships.';
  }
  if (game.phase === 'setupRound2') {
    return 'Place your settlement on the starting island — it collects 1 resource per adjacent hex.';
  }
  if (game.phase === 'setupRound3') {
    return game.setupState?.step === 'ship'
      ? 'Place your ship (it carries a settler) on a sea edge next to your harbor settlement.'
      : 'Place a road next to your settlement.';
  }
  return null;
}

export function EpPhaseBar({ game, acting }: { game: GameState; acting: PlayerId }) {
  const { dispatch, uiMode, setMode, openDialog } = useGameStore();
  if (!isExplorersPirates(game)) return null;
  const ep = game.explorersPirates;
  const player = game.players.find((p) => p.id === acting);
  if (!player) return null;

  if (game.phase === 'epPlacePirate') {
    const pending = ep.pendingPirate;
    if (pending?.playerId !== acting) return null;
    const why = pending.reason === 'seven' ? 'Rolled a 7' : 'Pirate chased away!';
    return (
      <div className="actionbar">
        <div className="actionbar-hint actionbar-slot-wide">
          <span>
            <strong>{why}</strong> — put your pirate ship on a highlighted sea hex (not next to the starting island,
            not on the frame){ep.pirate && ep.pirate.owner !== acting ? '; the other pirate ship goes home' : ''}. Rob
            one player with a ship there (💰): a random card, or 1 gold if they have none.
          </span>
        </div>
      </div>
    );
  }

  if (game.phase !== 'epMovement' || !ep.movement) return null;
  const m = ep.movement;
  const mine = shipsOf(game, acting);
  const picked = uiMode.kind === 'epMove' ? uiMode.ship : undefined;
  const selected = epSelectedShip(game, acting, picked);
  const opts = selected ? epShipOptions(game, selected.id) : null;
  const canEnd = moveCanEnd(game);
  const last = lastEventText(game, acting);
  let hint: string;
  if (mine.length === 0) {
    hint = 'No ships on the board. Build one next to a harbor settlement in your Action phase.';
  } else if (!selected || !opts) {
    hint = 'Movement: pick a ship (click it on the board or below).';
  } else {
    const parts = [`${opts.mp} MP left${m.boosted.includes(selected.id) ? ' (boosted)' : ''}.`];
    if (opts.steps.length > 0) parts.push('Sail along a highlighted edge (🪙 tribute, 🧭 explores).');
    else if (m.moved.includes(selected.id) && m.moving !== selected.id) parts.push('This ship has finished moving.');
    if (opts.found.length > 1) parts.push('Click a highlighted corner to found a settlement.');
    if (!canEnd) parts.push('It may not stop on an edge with 2 other ships — keep sailing.');
    hint = parts.join(' ');
  }
  const hexBtns = opts ? hexActions(opts) : [];
  return (
    <div className="actionbar">
      <div className="actionbar-hint actionbar-slot-wide">
        ⛵ {hint}
        {last ? ` ${last}` : ''}
      </div>
      {mine.length > 1 &&
        mine.map((s, i) => {
          const o = epShipOptions(game, s.id);
          const isSel = s.id === selected?.id;
          return (
            <Button
              key={s.id}
              variant={isSel ? 'primary' : undefined}
              onClick={() => setMode({ kind: 'epMove', ship: s.id })}
              title={`Ship ${i + 1}: ${o?.mp ?? 0} MP${s.cargo.length ? `, carrying ${describe(s.cargo)}` : ', empty'}`}
            >
              ⛵{i + 1}
              {s.cargo.map((c, k) => (
                <CargoIcon key={k} piece={c} color={player.color} size={14} />
              ))}
              <span style={{ opacity: 0.75, fontSize: '0.85em' }}> {o?.mp ?? 0}</span>
            </Button>
          );
        })}
      {selected && opts && (
        <>
          <Button
            disabled={!opts.canBoost}
            onClick={() => dispatch({ type: 'epBoostShip', playerId: acting, ship: selected.id })}
            title={opts.boostReason}
          >
            🐑 +{EP_BOOST_MP} MP
          </Button>
          {opts.found.length === 1 && (
            <Button
              onClick={() =>
                dispatch({ type: 'epFoundSettlement', playerId: acting, ship: selected.id, vertex: opts.found[0]! })
              }
              title="The settler founds a settlement at this end of the ship (ship and settler return to your supply)"
            >
              🏠 Found
            </Button>
          )}
          {hexBtns.map((h) => (
            <Button
              key={`${h.kind}:${h.hex}`}
              onClick={() => dispatch(hexAction(h.kind, acting, selected.id, h.hex))}
              title={h.title}
            >
              {BUTTON_LABEL[h.kind]}
            </Button>
          ))}
          {opts.deliver && (
            <Button
              onClick={() => dispatch({ type: 'epDeliver', playerId: acting, ship: selected.id })}
              title="Unload fish hauls and spice sacks at the Council of Catan: one mission track space each"
            >
              🏛 Deliver
            </Button>
          )}
          {opts.chase && (
            <Button
              onClick={() => dispatch({ type: 'epChasePirate', playerId: acting, ship: selected.id })}
              title={`Attack the pirate ship: roll ${opts.chaseNumbers.join(' / ')} on one die to chase it away and place your own (once per ship, ends any move under way)`}
            >
              ⚔ Chase ({opts.chaseNumbers.join('/')})
            </Button>
          )}
          {opts.harbors.length > 0 && (
            <Button
              onClick={() => openDialog('epTransfer')}
              title="Move pieces between this ship and your harbor settlement next to it"
            >
              ⇄ Cargo
            </Button>
          )}
        </>
      )}
      <Button
        disabled={m.fishRolled}
        onClick={() => dispatch({ type: 'epFishRoll', playerId: acting })}
        title={
          m.fishRolled
            ? 'You already rolled for fish this turn'
            : ep.shoals.length === 0
              ? 'Roll a die for fish (no shoal found yet, so nothing can appear)'
              : 'Roll a die once: a fish haul appears on the explored shoal with that number (unless it has one, the pirate is there, or the supply is empty)'
        }
      >
        🎲 Fish
      </Button>
      <div className="actionbar-slot actionbar-slot-end">
        <Button
          variant="primary"
          fullWidth
          disabled={!canEnd}
          onClick={() => dispatch({ type: 'endTurn', playerId: acting })}
          title={canEnd ? 'Finish moving (captured lairs are resolved) and pass the turn' : 'Your moving ship may not stop on an edge with 2 other ships'}
        >
          Done ▸
        </Button>
      </div>
    </div>
  );
}

const BUTTON_LABEL: Record<ReturnType<typeof hexActions>[number]['kind'], string> = {
  epCrewToLair: '👥 Attack lair',
  epCrewFromLair: '👥 Crew aboard',
  epCrewToFarm: '👥 Crew to farm',
  epLoadSpice: '🌶️ Spice',
  epLoadFish: '🐟 Load fish',
};

// The latest roll result worth showing on the bar (a chase or a fish roll
// this device just made).
function lastEventText(game: GameState, acting: PlayerId): string | null {
  const events = game.explorersPirates?.lastEvents?.events ?? [];
  if (events.length !== 1) return null;
  const e = events[0]!;
  if (e.kind === 'chase' && e.playerId === acting && !e.success) return `⚔ Rolled ${e.die}: the pirate stays.`;
  if (e.kind === 'fishRoll' && e.playerId === acting) {
    return e.hex ? `🎲 ${e.die}: a fish haul appears!` : `🎲 ${e.die}: no fish this time.`;
  }
  return null;
}
