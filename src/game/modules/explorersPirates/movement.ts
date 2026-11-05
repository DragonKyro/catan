import type {
  EndTurnAction,
  EpBoostShipAction,
  EpChasePirateAction,
  EpCrewFromLairAction,
  EpCrewToFarmAction,
  EpCrewToLairAction,
  EpDeliverAction,
  EpEvent,
  EpFishRollAction,
  EpFoundSettlementAction,
  EpLoadFishAction,
  EpLoadSpiceAction,
  EpMoveShipAction,
  EpMovementState,
  EpShip,
  EpTransferAction,
  GameState,
  PlayerId,
} from '../../types';
import type { ActionHandler } from '../types';
import { currentPlayerId, getPlayer, updatePlayer } from '../../helpers';
import { addResources, subtractResources } from '../../resources';
import { rollDie } from '../../rng';
import { calculateVictoryPoints } from '../../scoring/points';
import { addGold } from '../traders/coins/gold';
import {
  EP_BOOST_MP,
  EP_COSTS,
  EP_LAIR_CREWS,
  EP_TRIBUTE_GOLD,
} from './constants';
import { exploreAroundEdge } from './explore';
import { advanceTrack, resolveLair } from './missions';
import { openPirateActivation } from './production';
import {
  battleReadyShips,
  chaseNumbers,
  foundableVertices,
  harborsAtShip,
  hasRoomFor,
  isExplorersPirates,
  legalShipSteps,
  moveCanEnd,
  patchEp,
  pushEpEvents,
  removeCargo,
  shipBaseMp,
  shipById,
  shipNextToHex,
  shipEnds,
  stepOwesTribute,
  type EpGame,
} from './state';

// Movement phase (Rulebook pp. 10-15). `endTurn` in the Action phase opens
// it; `endTurn` here ("Done") resolves captured pirate lairs and passes the
// dice.

export function freshMovement(): EpMovementState {
  return { moving: null, mp: 0, moved: [], boosted: [], paidTribute: [], chased: [], fishRolled: false };
}

function assertMovement(state: GameState, playerId: PlayerId): asserts state is EpGame & { explorersPirates: { movement: EpMovementState } } {
  if (!isExplorersPirates(state)) throw new Error('Not an Explorers & Pirates game');
  if (state.phase !== 'epMovement' || !state.explorersPirates.movement) {
    throw new Error('Ships move in the Movement phase');
  }
  if (playerId !== currentPlayerId(state)) throw new Error('Not your turn');
}

function ownShip(state: EpGame, playerId: PlayerId, shipId: string): EpShip {
  const ship = shipById(state, shipId);
  if (!ship || ship.owner !== playerId) throw new Error('Not your ship');
  return ship;
}

function patchMovement(state: EpGame, fn: (m: EpMovementState) => EpMovementState): EpGame {
  return patchEp(state, (ep) => ({ ...ep, movement: fn(ep.movement!) }));
}

function setShip(state: EpGame, ship: EpShip): EpGame {
  return patchEp(state, (ep) => ({ ...ep, ships: ep.ships.map((s) => (s.id === ship.id ? ship : s)) }));
}

// ----- Moving -----

// One edge along the sea. The first step of a ship starts its move (the
// previous ship's move is then over). Exploring a hex ends the move.
export function handleEpMoveShip(state: GameState, action: EpMoveShipAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  let m = state.explorersPirates.movement;
  if (m.moving !== ship.id) {
    if (m.moved.includes(ship.id)) throw new Error('That ship has already moved this turn');
    if (!moveCanEnd(state)) throw new Error('Your moving ship may not stop on an edge with 2 other ships');
    const mp = shipBaseMp(state, action.playerId) + (m.boosted.includes(ship.id) ? EP_BOOST_MP : 0);
    m = { ...m, moving: ship.id, mp, moved: [...m.moved, ship.id] };
  }
  const probe = patchMovement(state, () => m);
  if (!legalShipSteps(probe, ship.id).includes(action.to)) throw new Error('The ship cannot sail there');
  let next = probe;
  const events: EpEvent[] = [];
  if (stepOwesTribute(next, ship, ship.edge, action.to)) {
    next = addGold(next, action.playerId, -EP_TRIBUTE_GOLD) as EpGame;
    next = patchMovement(next, (mv) => ({ ...mv, paidTribute: [...mv.paidTribute, ship.id] }));
    events.push({ kind: 'tribute', playerId: action.playerId, to: next.explorersPirates.pirate!.owner });
  }
  next = setShip(next, { ...ship, edge: action.to });
  next = patchMovement(next, (mv) => ({ ...mv, mp: mv.mp - 1 }));
  const [explored, found] = exploreAroundEdge(next, action.playerId, action.to);
  next = explored;
  if (found.length > 0) {
    events.push(...found);
    next = patchMovement(next, (mv) => ({ ...mv, moving: null, mp: 0 }));
  } else if (next.explorersPirates.movement!.mp <= 0) {
    next = patchMovement(next, (mv) => ({ ...mv, moving: null }));
  }
  return pushEpEvents(next, events);
}

// "Pay 1 wool to move 1 ship up to six edges": once per ship per turn,
// before or during its move.
export function handleEpBoostShip(state: GameState, action: EpBoostShipAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  const m = state.explorersPirates.movement;
  if (m.boosted.includes(ship.id)) throw new Error('That ship is already boosted this turn');
  if (m.moved.includes(ship.id) && m.moving !== ship.id) throw new Error('That ship has finished moving');
  if (getPlayer(state, action.playerId).resources.sheep < 1) throw new Error('You need 1 wool');
  let next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    resources: subtractResources(p.resources, EP_COSTS.boost),
  })) as EpGame;
  next = { ...next, bank: addResources(next.bank, EP_COSTS.boost) };
  return patchMovement(next, (mv) => ({
    ...mv,
    boosted: [...mv.boosted, ship.id],
    mp: mv.moving === ship.id ? mv.mp + EP_BOOST_MP : mv.mp,
  }));
}

// ----- Loading and unloading (free, any time in the phase) -----

export function handleEpTransfer(state: GameState, action: EpTransferAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  if (!harborsAtShip(state, ship).includes(action.harbor)) {
    throw new Error('The ship must be next to your harbor settlement');
  }
  if (action.load.length + action.unload.length === 0) throw new Error('Nothing to move');
  const harborCargo = state.explorersPirates.harbors[action.harbor]!;
  const shipLeft = removeCargo(ship.cargo, action.unload);
  const harborLeft = removeCargo(harborCargo, action.load);
  if (!shipLeft || !harborLeft) throw new Error('Those pieces are not there');
  if (!hasRoomFor(shipLeft, action.load) || !hasRoomFor(harborLeft, action.unload)) {
    throw new Error('Not enough room');
  }
  const next = setShip(state, { ...ship, cargo: [...shipLeft, ...action.load] });
  return patchEp(next, (ep) => ({
    ...ep,
    harbors: { ...ep.harbors, [action.harbor]: [...harborLeft, ...action.unload] },
  }));
}

function takeFromShip(state: EpGame, ship: EpShip, piece: 'crew' | 'settler' | 'fish' | 'spice'): EpGame {
  const left = removeCargo(ship.cargo, [piece]);
  if (!left) throw new Error(`The ship carries no ${piece}`);
  return setShip(state, { ...ship, cargo: left });
}

// A ship with a settler builds a settlement at one of its ends; the ship
// and the settler return to the supply.
export function handleEpFoundSettlement(state: GameState, action: EpFoundSettlementAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  if (!foundableVertices(state, ship.id).includes(action.vertex)) {
    throw new Error('A settlement goes at an end of the ship, on explored land, following the distance rule');
  }
  let next = patchEp(state, (ep) => ({ ...ep, ships: ep.ships.filter((s) => s.id !== ship.id) }));
  next = patchMovement(next, (mv) => (mv.moving === ship.id ? { ...mv, moving: null, mp: 0 } : mv));
  next = updatePlayer(next, action.playerId, (p) => ({ ...p, settlements: [...p.settlements, action.vertex] })) as EpGame;
  return pushEpEvents(next, [{ kind: 'found', playerId: action.playerId, vertex: action.vertex }]);
}

// Pirate lairs: crews land on the gold field; the third captures it (the
// mission resolves when the Movement phase ends).
export function handleEpCrewToLair(state: GameState, action: EpCrewToLairAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  const lair = state.explorersPirates.lairs.find((l) => l.hex === action.hex);
  if (!lair || lair.captured) throw new Error('No pirate lair to attack there');
  if (!shipNextToHex(state, ship, action.hex)) throw new Error('The ship must be next to the gold field');
  let next = takeFromShip(state, ship, 'crew');
  const crews = [...lair.crews, action.playerId];
  const captured = crews.length >= EP_LAIR_CREWS;
  next = patchEp(next, (ep) => ({
    ...ep,
    lairs: ep.lairs.map((l) => (l.hex === action.hex ? { ...l, crews, captured } : l)),
    pendingLairs: captured ? [...ep.pendingLairs, action.hex] : ep.pendingLairs,
  }));
  return pushEpEvents(next, [{ kind: 'crewToLair', playerId: action.playerId, hex: action.hex, crews: crews.length }]);
}

// "On a future turn, you may load your remaining crew pieces on your ships."
export function handleEpCrewFromLair(state: GameState, action: EpCrewFromLairAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  const ep = state.explorersPirates;
  const lair = ep.lairs.find((l) => l.hex === action.hex);
  if (!lair || !lair.captured || ep.pendingLairs.includes(action.hex)) {
    throw new Error('Crews leave a gold field only after its lair is captured');
  }
  const idx = lair.crews.indexOf(action.playerId);
  if (idx < 0) throw new Error('You have no crew there');
  if (!shipNextToHex(state, ship, action.hex)) throw new Error('The ship must be next to the gold field');
  if (!hasRoomFor(ship.cargo, ['crew'])) throw new Error('No room on the ship');
  const next = setShip(state, { ...ship, cargo: [...ship.cargo, 'crew'] });
  return patchEp(next, (e) => ({
    ...e,
    lairs: e.lairs.map((l) => (l.hex === action.hex ? { ...l, crews: l.crews.filter((_, i) => i !== idx) } : l)),
  }));
}

// Spices: a crew on the farm unlocks its advantage (and lets you build
// there); it stays for the rest of the game. One crew per player per farm.
export function handleEpCrewToFarm(state: GameState, action: EpCrewToFarmAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  const farm = state.explorersPirates.farms.find((f) => f.hex === action.hex);
  if (!farm) throw new Error('No spice farm there');
  if (farm.crews.includes(action.playerId)) throw new Error('You already have a crew on that farm');
  if (!shipNextToHex(state, ship, action.hex)) throw new Error('The ship must be next to the spice farm');
  let next = takeFromShip(state, ship, 'crew');
  next = patchEp(next, (ep) => ({
    ...ep,
    farms: ep.farms.map((f) => (f.hex === action.hex ? { ...f, crews: [...f.crews, action.playerId] } : f)),
  }));
  return pushEpEvents(next, [{ kind: 'crewToFarm', playerId: action.playerId, hex: action.hex, ability: farm.ability }]);
}

// One spice sack per player from each farm with their crew on it.
export function handleEpLoadSpice(state: GameState, action: EpLoadSpiceAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  const farm = state.explorersPirates.farms.find((f) => f.hex === action.hex);
  if (!farm) throw new Error('No spice farm there');
  if (!farm.crews.includes(action.playerId)) throw new Error('First unload a crew onto the farm');
  if (!farm.sacks.includes(action.playerId)) throw new Error('You already took your spice sack from this farm');
  if (!shipNextToHex(state, ship, action.hex)) throw new Error('The ship must be next to the spice farm');
  if (!hasRoomFor(ship.cargo, ['spice'])) throw new Error('No room on the ship');
  let next = setShip(state, { ...ship, cargo: [...ship.cargo, 'spice'] });
  next = patchEp(next, (ep) => ({
    ...ep,
    farms: ep.farms.map((f) =>
      f.hex === action.hex ? { ...f, sacks: f.sacks.filter((p) => p !== action.playerId) } : f,
    ),
  }));
  return pushEpEvents(next, [{ kind: 'loadSpice', playerId: action.playerId, hex: action.hex }]);
}

export function handleEpLoadFish(state: GameState, action: EpLoadFishAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  const shoal = state.explorersPirates.shoals.find((s) => s.hex === action.hex);
  if (!shoal?.haul) throw new Error('No fish haul there');
  if (!shipNextToHex(state, ship, action.hex)) throw new Error('The ship must be next to the shoal');
  if (!hasRoomFor(ship.cargo, ['fish'])) throw new Error('A fish haul needs an empty ship');
  let next = setShip(state, { ...ship, cargo: [...ship.cargo, 'fish'] });
  next = patchEp(next, (ep) => ({
    ...ep,
    shoals: ep.shoals.map((s) => (s.hex === action.hex ? { ...s, haul: false } : s)),
  }));
  return pushEpEvents(next, [{ kind: 'loadFish', playerId: action.playerId, hex: action.hex }]);
}

// Unload fish hauls and spice sacks at the Council of Catan (an end of the
// ship on one of its anchors): one track space each.
export function handleEpDeliver(state: GameState, action: EpDeliverAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  const anchors = state.explorersPirates.councilAnchors;
  if (!shipEnds(state, ship).some((v) => anchors.includes(v))) {
    throw new Error('The ship must touch an anchor of the Council of Catan');
  }
  const fish = ship.cargo.filter((c) => c === 'fish').length;
  const spice = ship.cargo.filter((c) => c === 'spice').length;
  if (fish + spice === 0) throw new Error('Nothing to deliver');
  let next = setShip(state, { ...ship, cargo: ship.cargo.filter((c) => c !== 'fish' && c !== 'spice') });
  next = patchEp(next, (ep) => ({ ...ep, fishSupply: ep.fishSupply + fish }));
  const events: EpEvent[] = [{ kind: 'deliver', playerId: action.playerId, fish, spice }];
  let ev: EpEvent | null;
  if (fish > 0) {
    [next, ev] = advanceTrack(next, action.playerId, 'fish', fish);
    if (ev) events.push(ev);
  }
  if (spice > 0) {
    [next, ev] = advanceTrack(next, action.playerId, 'spice', spice);
    if (ev) events.push(ev);
  }
  return pushEpEvents(next, events);
}

// ----- The pirate -----

// A battle-ready ship rolls 1 die: a 6 (or a Pirate Bonus number) chases
// the pirate ship away and you activate yours.
export function handleEpChasePirate(state: GameState, action: EpChasePirateAction): GameState {
  assertMovement(state, action.playerId);
  const ship = ownShip(state, action.playerId, action.ship);
  if (!battleReadyShips(state, action.playerId).some((s) => s.id === ship.id)) {
    throw new Error('Only a ship next to the pirate that has not moved (or tried) this turn can attack');
  }
  if (!moveCanEnd(state)) throw new Error('Your moving ship may not stop on an edge with 2 other ships');
  const [die, rng] = rollDie(state.rngState);
  const success = chaseNumbers(state, action.playerId).includes(die);
  let next: EpGame = patchMovement({ ...state, rngState: rng }, (mv) => ({
    ...mv,
    // The attempt ends whichever ship was under way.
    moving: null,
    mp: 0,
    chased: [...mv.chased, ship.id],
  }));
  next = pushEpEvents(next, [{ kind: 'chase', playerId: action.playerId, die, success }]);
  if (!success) return next;
  return openPirateActivation(next, action.playerId, 'chase', 'epMovement');
}

// ----- Fish -----

// Once per Movement phase: roll a die; a matching explored shoal gets a
// fish haul (not if it has one, the pirate is there, or the supply is out).
export function handleEpFishRoll(state: GameState, action: EpFishRollAction): GameState {
  assertMovement(state, action.playerId);
  const ep = state.explorersPirates;
  if (ep.movement.fishRolled) throw new Error('You already rolled for fish this turn');
  const [die, rng] = rollDie(state.rngState);
  const shoal = ep.shoals.find((s) => s.number === die);
  const ok = !!shoal && !shoal.haul && ep.pirate?.hex !== shoal.hex && ep.fishSupply > 0;
  let next: EpGame = patchEp({ ...state, rngState: rng }, (e) => ({
    ...e,
    movement: { ...e.movement!, fishRolled: true },
    shoals: ok ? e.shoals.map((s) => (s === shoal ? { ...s, haul: true } : s)) : e.shoals,
    fishSupply: ok ? e.fishSupply - 1 : e.fishSupply,
  }));
  next = pushEpEvents(next, [{ kind: 'fishRoll', playerId: action.playerId, die, hex: ok ? shoal!.hex : null }]);
  return next;
}

// ----- Turn flow -----

// `endTurn` in the Action phase opens the Movement phase; in the Movement
// phase it resolves captured lairs and passes the turn.
export function withEpEndTurn(inner: ActionHandler<EndTurnAction>): ActionHandler<EndTurnAction> {
  return (state, action) => {
    if (!isExplorersPirates(state)) return inner(state, action);
    if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
    if (state.phase === 'main') {
      if (!state.hasRolledThisTurn) throw new Error('Must roll dice before ending turn');
      return patchEp({ ...state, phase: 'epMovement', pendingTrade: undefined }, (ep) => ({
        ...ep,
        movement: freshMovement(),
      }));
    }
    if (state.phase === 'epMovement') {
      if (!moveCanEnd(state)) throw new Error('Your moving ship may not stop on an edge with 2 other ships');
      let next: EpGame = state;
      const events: EpEvent[] = [];
      for (const hex of [...state.explorersPirates.pendingLairs]) {
        let evs: EpEvent[];
        [next, evs] = resolveLair(next, hex);
        events.push(...evs);
      }
      next = pushEpEvents(next, events);
      next = patchEp(
        { ...next, phase: 'main', goldSpendsThisTurn: 0 },
        (ep) => ({ ...ep, movement: undefined, fastGoldUsed: 0 }),
      );
      // The lair is resolved before the turn passes, so a player who reaches
      // the target here wins on their own turn.
      if (calculateVictoryPoints(next, action.playerId, true) >= next.settings.victoryPointsToWin) {
        return { ...next, winner: action.playerId, phase: 'gameOver' };
      }
      return inner(next, action);
    }
    return inner(state, action);
  };
}
