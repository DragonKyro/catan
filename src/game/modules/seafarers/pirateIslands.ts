import type {
  EdgeId,
  EndTurnAction,
  GameState,
  PlayKnightAction,
  PlayerId,
  Resource,
  RollDiceAction,
  StealResourceAction,
  VertexId,
} from '../../types';
import { currentPlayerId, updatePlayer, getPlayer } from '../../helpers';
import { flattenBank, totalResources } from '../../resources';
import { pickOne, rngInt } from '../../rng';
import { getPortAtVertex } from '../../board/adjacency';
import { handleRollDice as baseRollDice } from '../../actions/dice';
import { isShipEdge } from './validation/shipPlacement';

// The Pirate Islands (rulebook p.16-17; Seafarers 5-6 p.10).
//
// - The pirate fleet sails a fixed loop around the center of the board.
//   After the roll (before production or resolving a 7) it moves as many
//   hexes as the lower die and attacks every player with a building on that
//   hex. Its strength is that die; a player's strength is their warships.
//   Pirates stronger: discard 1 random card + 1 per city there. Player
//   stronger: take 1 resource of choice. Tie: nothing.
// - No robber. On a 7, discard as normal, then the roller may steal 1 random
//   card from any player.
// - One continuous, non-branching line of ships to the western islands,
//   from a coastal building on the main island to the player's beachhead,
//   then on to their pirate fortress, by the shortest path. Other ship
//   routes around the main island are free.
// - A settlement may be built at your beachhead once your line reaches it.
// - Knight cards (and, at 4+ players, Victory Point cards) only convert the
//   normal ship closest to your route's start into a warship.
// - At the end of your action phase, if your line reaches your fortress you
//   attack it: roll a die. Warships > die: remove a lair token (3 to
//   recapture); fewer: lose the 2 ships closest to the fortress; equal: lose
//   1. Your turn ends. A recaptured fortress becomes your settlement.
// - Win: recapture your fortress AND have the target VP during your turn.

export const PIRATE_LAIRS = 3;

function vertexTouchesMain(state: GameState, vertexId: VertexId): boolean {
  const pi = state.pirateIslands!;
  const islandOf = state.board.islandOfHex ?? {};
  return (state.board.vertices[vertexId]?.hexes ?? []).some(
    (h) => islandOf[h] === pi.mainIsland,
  );
}

function edgeTouchesMain(state: GameState, edgeId: EdgeId): boolean {
  return (state.board.edges[edgeId]?.vertices ?? []).some((v) => vertexTouchesMain(state, v));
}

function ownBuildingAt(state: GameState, playerId: PlayerId, v: VertexId): boolean {
  const p = getPlayer(state, playerId);
  return p.settlements.includes(v) || p.cities.includes(v);
}

function opponentBuildingAt(state: GameState, playerId: PlayerId, v: VertexId): boolean {
  return state.players.some(
    (p) => p.id !== playerId && (p.settlements.includes(v) || p.cities.includes(v)),
  );
}

function shipsAt(state: GameState, playerId: PlayerId, v: VertexId, except?: EdgeId): EdgeId[] {
  const p = getPlayer(state, playerId);
  return (state.board.vertices[v]?.edges ?? []).filter(
    (e) => e !== except && p.ships.includes(e),
  );
}

export function fortressOf(state: GameState, playerId: PlayerId) {
  return state.pirateIslands?.fortresses.find((f) => f.playerId === playerId);
}

export function hasRecapturedFortress(state: GameState, playerId: PlayerId): boolean {
  const f = fortressOf(state, playerId);
  return f !== undefined && f.lairs <= 0;
}

// Where the line is heading now: the beachhead until a ship reaches it,
// then the fortress.
export function lineTarget(state: GameState, playerId: PlayerId): VertexId | null {
  const f = fortressOf(state, playerId);
  if (!f) return null;
  return shipsAt(state, playerId, f.beachhead).length > 0 ? f.vertex : f.beachhead;
}

// Edge distance from every vertex to `target`, sailing only over ship edges
// no other player occupies and not through other players' buildings.
function distancesTo(state: GameState, playerId: PlayerId, target: VertexId): Map<VertexId, number> {
  const taken = new Set<EdgeId>();
  for (const p of state.players) {
    if (p.id === playerId) continue;
    for (const e of [...p.ships, ...p.roads]) taken.add(e);
  }
  const dist = new Map<VertexId, number>([[target, 0]]);
  const queue: VertexId[] = [target];
  while (queue.length > 0) {
    const v = queue.shift()!;
    const d = dist.get(v)!;
    if (v !== target && opponentBuildingAt(state, playerId, v)) continue;
    for (const e of state.board.vertices[v]?.edges ?? []) {
      if (taken.has(e) || !isShipEdge(state, e)) continue;
      const edge = state.board.edges[e]!;
      const u = edge.vertices[0] === v ? edge.vertices[1] : edge.vertices[0];
      if (dist.has(u)) continue;
      dist.set(u, d + 1);
      queue.push(u);
    }
  }
  return dist;
}

// Extra ship rule for a new ship (built or moved) on `edge`. Returns an
// error message, or null if allowed. Ships touching the main island are
// unrestricted ("You may create other routes around the main island").
export function pirateIslandsShipViolation(
  state: GameState,
  playerId: PlayerId,
  edge: EdgeId,
): string | null {
  const pi = state.pirateIslands;
  if (!pi) return null;
  if (edgeTouchesMain(state, edge)) return null;
  const fortress = fortressOf(state, playerId);
  if (!fortress) return 'You have no pirate fortress to sail to';
  const player = getPlayer(state, playerId);
  const ends = state.board.edges[edge]!.vertices.filter(
    (v) => ownBuildingAt(state, playerId, v) || shipsAt(state, playerId, v, edge).length > 0,
  );
  if (ends.length !== 1) return 'Your line of ships to the pirate islands may not branch or loop';
  const v = ends[0]!;
  const u = state.board.edges[edge]!.vertices.find((x) => x !== v)!;
  const atV = shipsAt(state, playerId, v, edge);
  if (atV.length !== 1) return 'Your line of ships to the pirate islands may not branch';
  const western = player.ships.filter((e) => e !== edge && !edgeTouchesMain(state, e));
  if (western.length > 0 && !western.includes(atV[0]!)) {
    return 'You may build only one line of ships to the pirate islands';
  }
  if (v === fortress.vertex) return 'Your line already reaches your pirate fortress';
  const target = lineTarget(state, playerId)!;
  const dist = distancesTo(state, playerId, target);
  const dv = dist.get(v);
  const du = dist.get(u);
  if (dv === undefined || du === undefined || du !== dv - 1) {
    return target === fortress.beachhead
      ? 'Your line must take the shortest path to your beachhead'
      : 'Your line must take the shortest path to your pirate fortress';
  }
  return null;
}

// Does a ship on `edge` bring the player's network strictly closer to where
// their line is heading (beachhead, then fortress)? For the AI.
export function shipAdvancesLine(state: GameState, playerId: PlayerId, edge: EdgeId): boolean {
  const target = lineTarget(state, playerId);
  if (!target) return false;
  const e = state.board.edges[edge];
  if (!e) return false;
  const dist = distancesTo(state, playerId, target);
  const attached = e.vertices.filter(
    (v) => ownBuildingAt(state, playerId, v) || shipsAt(state, playerId, v, edge).length > 0,
  );
  if (attached.length !== 1) return false;
  const near = dist.get(attached[0]!);
  const far = dist.get(e.vertices.find((v) => v !== attached[0])!);
  if (near === undefined || far === undefined || far >= near) return false;
  // Only from the closest point the network has reached so far.
  const p = getPlayer(state, playerId);
  for (const s of p.ships) {
    for (const v of state.board.edges[s]!.vertices) {
      const d = dist.get(v);
      if (d !== undefined && d < near) return false;
    }
  }
  return true;
}

// Settlements: anywhere on the main island; on the pirate islands only at
// your own beachhead. Pirate-held fortresses count as buildings for the
// distance rule.
export function pirateIslandsSettlementAllowed(
  state: GameState,
  playerId: PlayerId,
  vertex: VertexId,
): boolean {
  const pi = state.pirateIslands;
  if (!pi) return true;
  const neighbors = state.board.vertices[vertex]?.neighborVertices ?? [];
  for (const f of pi.fortresses) {
    if (f.lairs <= 0) continue;
    if (f.vertex === vertex || neighbors.includes(f.vertex)) return false;
  }
  if (vertexTouchesMain(state, vertex)) return true;
  return fortressOf(state, playerId)?.beachhead === vertex;
}

// ---------------------------------------------------------------- fleet ---

function discardRandom(state: GameState, playerId: PlayerId, n: number): [GameState, number] {
  let next = state;
  let discarded = 0;
  for (let i = 0; i < n; i++) {
    const p = getPlayer(next, playerId);
    if (totalResources(p.resources) === 0) break;
    const [card, rng] = pickOne(next.rngState, flattenBank(p.resources));
    next = { ...next, rngState: rng };
    next = updatePlayer(next, playerId, (pl) => ({
      ...pl,
      resources: { ...pl.resources, [card]: pl.resources[card] - 1 },
    }));
    next = { ...next, bank: { ...next.bank, [card]: next.bank[card] + 1 } };
    discarded++;
  }
  return [next, discarded];
}

// Move the fleet by the lower die and attack. Returns the new state plus
// the resource-of-choice picks earned by players who beat it.
export function moveFleetAndAttack(
  state: GameState,
  dice: [number, number],
): { state: GameState; picks: Record<PlayerId, number> } {
  const pi = state.pirateIslands;
  if (!pi || pi.fleetIndex < 0) return { state, picks: {} };
  const strength = Math.min(dice[0], dice[1]);
  const fleetIndex = (pi.fleetIndex + strength) % pi.path.length;
  const hex = pi.path[fleetIndex]!;
  let next: GameState = {
    ...state,
    board: { ...state.board, pirateHex: hex },
    pirateIslands: { ...pi, fleetIndex, lastFleetAttack: undefined },
  };
  if (pi.noAttackHex === hex) return { state: next, picks: {} };

  const corners = next.board.hexes[hex]?.corners ?? [];
  const results: NonNullable<NonNullable<GameState['pirateIslands']>['lastFleetAttack']>['results'] = [];
  const picks: Record<PlayerId, number> = {};
  const n = next.playerOrder.length;
  for (let i = 0; i < n; i++) {
    const pid = next.playerOrder[(next.currentPlayerIndex + i) % n]!;
    const p = getPlayer(next, pid);
    const here = corners.filter((v) => p.settlements.includes(v) || p.cities.includes(v));
    if (here.length === 0) continue;
    const warships = p.warships?.length ?? 0;
    if (strength > warships) {
      const cities = corners.filter((v) => p.cities.includes(v)).length;
      let discarded: number;
      [next, discarded] = discardRandom(next, pid, 1 + cities);
      results.push({ playerId: pid, warships, outcome: 'lost', discarded });
    } else if (warships > strength) {
      picks[pid] = 1;
      results.push({ playerId: pid, warships, outcome: 'won', discarded: 0 });
    } else {
      results.push({ playerId: pid, warships, outcome: 'tied', discarded: 0 });
    }
  }
  next = {
    ...next,
    pirateIslands: { ...next.pirateIslands!, lastFleetAttack: { hex, strength, results } },
  };
  return { state: next, picks };
}

export function handleRollDicePirateIslands(state: GameState, action: RollDiceAction): GameState {
  if (!state.pirateIslands) return baseRollDice(state, action);
  if (state.phase !== 'rollOrPlayKnight' || state.hasRolledThisTurn) {
    return baseRollDice(state, action); // let the base handler raise the error
  }
  const { state: afterFleet, picks } = moveFleetAndAttack(state, action.dice);
  const total = action.dice[0] + action.dice[1];
  if (Object.keys(picks).length === 0) return baseRollDice(afterFleet, action);
  if (total === 7) {
    // The attack resolves before "Resolve a 7": winners take their card
    // first, then discards are counted.
    return {
      ...afterFleet,
      hasRolledThisTurn: true,
      lastRoll: { dice: action.dice, total, player: action.playerId },
      phase: 'chooseGoldResource',
      goldChoiceState: { pending: picks, afterPicks: 'resolveSeven' },
    };
  }
  const next = baseRollDice(afterFleet, action);
  const pending = { ...(next.goldChoiceState?.pending ?? {}) };
  for (const [pid, k] of Object.entries(picks)) pending[pid] = (pending[pid] ?? 0) + k;
  return {
    ...next,
    phase: 'chooseGoldResource',
    goldChoiceState: { pending, returnTo: next.goldChoiceState?.returnTo ?? 'main' },
  };
}

// ---------------------------------------------------------------- steal ---

export function stealResourceCandidates(state: GameState, actorId: PlayerId): PlayerId[] {
  return state.players
    .filter((p) => p.id !== actorId && totalResources(p.resources) > 0)
    .map((p) => p.id);
}

export function handleStealResource(state: GameState, action: StealResourceAction): GameState {
  if (state.phase !== 'stealResource') {
    throw new Error(`Cannot steal in phase ${state.phase}`);
  }
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  let next = state;
  if (action.stealFrom !== null) {
    if (!stealResourceCandidates(state, action.playerId).includes(action.stealFrom)) {
      throw new Error('Cannot steal from that player');
    }
    const target = getPlayer(state, action.stealFrom);
    const [card, rng]: [Resource, number] = pickOne(next.rngState, flattenBank(target.resources));
    next = { ...next, rngState: rng };
    next = updatePlayer(next, target.id, (p) => ({
      ...p,
      resources: { ...p.resources, [card]: p.resources[card] - 1 },
    }));
    next = updatePlayer(next, action.playerId, (p) => ({
      ...p,
      resources: { ...p.resources, [card]: p.resources[card] + 1 },
    }));
  }
  const returnTo = state.pendingRobberMove?.returnTo ?? 'main';
  return { ...next, phase: returnTo, pendingRobberMove: undefined };
}

// ------------------------------------------------------------- warships ---

// The player's ships in route order from their main-island buildings
// (breadth-first by ship count), each with its parent ship.
function shipRoute(state: GameState, playerId: PlayerId): Map<EdgeId, { depth: number; parent: EdgeId | null }> {
  const p = getPlayer(state, playerId);
  const out = new Map<EdgeId, { depth: number; parent: EdgeId | null }>();
  const queue: Array<{ v: VertexId; depth: number; via: EdgeId | null }> = [];
  for (const v of [...p.settlements, ...p.cities]) {
    if (vertexTouchesMain(state, v)) queue.push({ v, depth: 0, via: null });
  }
  const seen = new Set<VertexId>(queue.map((q) => q.v));
  while (queue.length > 0) {
    const { v, depth, via } = queue.shift()!;
    if (via !== null && opponentBuildingAt(state, playerId, v)) continue;
    for (const e of shipsAt(state, playerId, v)) {
      if (out.has(e)) continue;
      out.set(e, { depth: depth + 1, parent: via });
      const edge = state.board.edges[e]!;
      const u = edge.vertices[0] === v ? edge.vertices[1] : edge.vertices[0];
      if (seen.has(u)) continue;
      seen.add(u);
      queue.push({ v: u, depth: depth + 1, via: e });
    }
  }
  return out;
}

// "Convert the 'normal' ship closest to your route's starting settlement on
// the main island into a warship." The route is the one leading to the
// pirate islands when there is one.
export function shipToConvert(state: GameState, playerId: PlayerId): EdgeId | null {
  const p = getPlayer(state, playerId);
  const route = shipRoute(state, playerId);
  const warships = new Set(p.warships ?? []);
  const western = [...route.keys()].filter((e) => !edgeTouchesMain(state, e));
  let candidates: EdgeId[];
  if (western.length > 0) {
    let tip = western[0]!;
    for (const e of western) if (route.get(e)!.depth > route.get(tip)!.depth) tip = e;
    candidates = [];
    for (let e: EdgeId | null = tip; e !== null; e = route.get(e)?.parent ?? null) {
      candidates.push(e);
    }
  } else {
    candidates = [...route.keys()];
  }
  const normal = candidates
    .filter((e) => !warships.has(e))
    .sort((a, b) => route.get(a)!.depth - route.get(b)!.depth || (a < b ? -1 : 1));
  return normal[0] ?? null;
}

export function handlePlayKnightPirateIslands(
  state: GameState,
  action: PlayKnightAction,
): GameState {
  if (action.playerId !== currentPlayerId(state)) throw new Error('Not your turn');
  if (state.hasPlayedDevCardThisTurn) {
    throw new Error('Already played a development card this turn');
  }
  if (state.phase !== 'main' && state.phase !== 'rollOrPlayKnight') {
    throw new Error(`Cannot play dev card in phase ${state.phase}`);
  }
  const player = getPlayer(state, action.playerId);
  const idx = player.devCards.unplayed.indexOf('knight');
  if (idx < 0) throw new Error('You have no knight card to play');
  const unplayed = player.devCards.unplayed.slice();
  unplayed.splice(idx, 1);
  const ship = shipToConvert(state, action.playerId);
  const next = updatePlayer(state, action.playerId, (p) => ({
    ...p,
    devCards: { ...p.devCards, unplayed, playedKnights: p.devCards.playedKnights + 1 },
    warships: ship ? [...(p.warships ?? []), ship] : p.warships,
  }));
  return { ...next, hasPlayedDevCardThisTurn: true };
}

// ------------------------------------------------------------ fortress ---

// Does the player's line of ships reach their (uncaptured) fortress?
export function lineReachesFortress(state: GameState, playerId: PlayerId): boolean {
  const f = fortressOf(state, playerId);
  if (!f || f.lairs <= 0) return false;
  return shipsAt(state, playerId, f.vertex).length > 0;
}

// The player's ships ordered nearest-first from their fortress along the line.
function shipsNearestFortress(state: GameState, playerId: PlayerId): EdgeId[] {
  const f = fortressOf(state, playerId)!;
  const order: EdgeId[] = [];
  const seenV = new Set<VertexId>([f.vertex]);
  const queue: VertexId[] = [f.vertex];
  while (queue.length > 0) {
    const v = queue.shift()!;
    for (const e of shipsAt(state, playerId, v)) {
      if (order.includes(e)) continue;
      order.push(e);
      const edge = state.board.edges[e]!;
      const u = edge.vertices[0] === v ? edge.vertices[1] : edge.vertices[0];
      if (!seenV.has(u) && !ownBuildingAt(state, playerId, u)) {
        seenV.add(u);
        queue.push(u);
      }
    }
  }
  return order;
}

export function resolveFortressAttack(state: GameState, playerId: PlayerId): GameState {
  const pi = state.pirateIslands;
  if (!pi || !lineReachesFortress(state, playerId)) return state;
  const fortress = fortressOf(state, playerId)!;
  const [roll, rng] = rngInt(state.rngState, 6);
  const die = roll + 1;
  let next: GameState = { ...state, rngState: rng };
  const warships = getPlayer(next, playerId).warships?.length ?? 0;
  let outcome: 'won' | 'lost' | 'tied';
  let shipsLost = 0;
  let captured = false;
  let fortresses = pi.fortresses;
  if (warships > die) {
    outcome = 'won';
    const lairs = fortress.lairs - 1;
    captured = lairs <= 0;
    fortresses = fortresses.map((f) => (f.playerId === playerId ? { ...f, lairs } : f));
    if (captured) {
      const port = getPortAtVertex(next.board, fortress.vertex);
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        settlements: [...p.settlements, fortress.vertex],
        ports: port && !p.ports.includes(port) ? [...p.ports, port] : p.ports,
      }));
    }
  } else {
    outcome = warships < die ? 'lost' : 'tied';
    const lose = new Set(shipsNearestFortress(next, playerId).slice(0, warships < die ? 2 : 1));
    shipsLost = lose.size;
    next = updatePlayer(next, playerId, (p) => ({
      ...p,
      ships: p.ships.filter((e) => !lose.has(e)),
      warships: p.warships?.filter((e) => !lose.has(e)),
    }));
  }
  let fleetIndex = pi.fleetIndex;
  let board = next.board;
  // "If all pirate fortresses are recaptured before the game ends, remove
  // the pirate ship from the game."
  if (fortresses.every((f) => f.lairs <= 0)) {
    fleetIndex = -1;
    board = { ...board, pirateHex: undefined };
  }
  return {
    ...next,
    board,
    pirateIslands: {
      ...pi,
      fortresses,
      fleetIndex,
      lastFortressAttack: { playerId, die, warships, outcome, shipsLost, captured },
    },
  };
}

// End of the action phase: attack your fortress if your line reaches it.
export function beforeEndTurnPirateIslands(state: GameState, action: EndTurnAction): GameState {
  if (!state.pirateIslands) return state;
  if (state.phase !== 'main' || action.playerId !== currentPlayerId(state)) return state;
  return resolveFortressAttack(state, action.playerId);
}

// Development deck adjustment: 3 players drop the Victory Point cards; 4+
// players treat them as Knights.
export function pirateIslandsDevDeck<T extends string>(deck: T[], numPlayers: number): T[] {
  if (numPlayers <= 3) return deck.filter((c) => c !== 'victoryPoint');
  return deck.map((c) => (c === 'victoryPoint' ? ('knight' as T) : c));
}
