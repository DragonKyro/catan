import type {
  BarbarianAttackEvent,
  BarbarianAttackState,
  EdgeId,
  GameState,
  HexId,
  PlayerId,
  PortType,
  VertexId,
} from '../../../types';
import { edgeKey } from '../../../board/coords';
import { getPortAtVertex } from '../../../board/adjacency';
import { BARBARIANS_TO_CONQUER } from '../constants';

// Barbarian Attack read helpers. Everything is derived from
// `state.barbarianAttack` plus the board, so the engine, the AI and the UI
// all agree on what is conquered.

export type BarbarianAttackGame = GameState & { barbarianAttack: BarbarianAttackState };

export function isBarbarianAttack(state: GameState): state is BarbarianAttackGame {
  return state.barbarianAttack !== undefined;
}

export function barbariansOn(state: GameState, hexId: HexId): number {
  return state.barbarianAttack?.barbarians[hexId] ?? 0;
}

// A coastal hex with 3 barbarians is conquered: its number disc is face
// down, it doesn't produce, and nobody may build on its edges or corners.
export function isHexConquered(state: GameState, hexId: HexId): boolean {
  return barbariansOn(state, hexId) >= BARBARIANS_TO_CONQUER;
}

export function conqueredHexes(state: GameState): HexId[] {
  const ba = state.barbarianAttack;
  if (!ba) return [];
  return ba.coastalHexes.filter((h) => (ba.barbarians[h] ?? 0) >= BARBARIANS_TO_CONQUER);
}

// Every castle hex (one at 3-4 players, two at 5-6).
export function castleHexes(ba: BarbarianAttackState): HexId[] {
  return ba.castleHexes ?? [ba.castleHex];
}

export function isCastleHex(state: GameState, hexId: HexId): boolean {
  const ba = state.barbarianAttack;
  return !!ba && castleHexes(ba).includes(hexId);
}

export function isCoastalHex(state: GameState, hexId: HexId): boolean {
  return state.barbarianAttack?.coastalHexes.includes(hexId) ?? false;
}

// "You may not build on the edges or intersections of a conquered hex."
export function vertexTouchesConqueredHex(state: GameState, vertexId: VertexId): boolean {
  if (!state.barbarianAttack) return false;
  const v = state.board.vertices[vertexId];
  return !!v && v.hexes.some((h) => isHexConquered(state, h));
}

export function edgeTouchesConqueredHex(state: GameState, edgeId: EdgeId): boolean {
  if (!state.barbarianAttack) return false;
  const e = state.board.edges[edgeId];
  return !!e && e.hexes.some((h) => isHexConquered(state, h));
}

// "A building is conquered when it touches only conquered hexes and the
// frame." The frame is the sea ring around the island.
export function isVertexConquered(state: GameState, vertexId: VertexId): boolean {
  if (!state.barbarianAttack) return false;
  const v = state.board.vertices[vertexId];
  if (!v) return false;
  let land = 0;
  for (const h of v.hexes) {
    if (state.board.hexes[h]?.terrain === 'sea') continue;
    land++;
    if (!isHexConquered(state, h)) return false;
  }
  return land > 0;
}

// Every conquered settlement / city vertex on the board.
export function conqueredBuildingVertices(state: GameState): Set<VertexId> {
  const out = new Set<VertexId>();
  if (!state.barbarianAttack) return out;
  if (conqueredHexes(state).length === 0) return out;
  for (const p of state.players) {
    for (const v of [...p.settlements, ...p.cities]) {
      if (isVertexConquered(state, v)) out.add(v);
    }
  }
  return out;
}

// The six edges of a hex (corner i to corner i + 1).
export function hexEdgeIds(state: GameState, hexId: HexId): EdgeId[] {
  const hex = state.board.hexes[hexId];
  if (!hex) return [];
  const out: EdgeId[] = [];
  for (let i = 0; i < 6; i++) {
    const id = edgeKey(hex.corners[i]!, hex.corners[(i + 1) % 6]!);
    if (state.board.edges[id]) out.push(id);
  }
  return out;
}

// Ports next to conquered buildings can't be used. `player.ports` is the
// cache every trade-rate check reads, so rebuild it from the player's
// standing buildings whenever barbarians move.
export function refreshBarbarianPorts(state: GameState): GameState {
  if (!state.barbarianAttack) return state;
  const conquered = conqueredBuildingVertices(state);
  let changed = false;
  const players = state.players.map((p) => {
    const ports: PortType[] = [];
    for (const v of [...p.settlements, ...p.cities]) {
      if (conquered.has(v)) continue;
      const port = getPortAtVertex(state.board, v);
      if (port && !ports.includes(port)) ports.push(port);
    }
    const same =
      ports.length === p.ports.length && ports.every((t) => p.ports.includes(t));
    if (same) return p;
    changed = true;
    return { ...p, ports };
  });
  return changed ? { ...state, players } : state;
}

export function prisonersOf(state: GameState, playerId: PlayerId): number {
  return state.barbarianAttack?.prisoners[playerId] ?? 0;
}

export function patchBarbarianAttack(
  state: BarbarianAttackGame,
  fn: (ba: BarbarianAttackState) => BarbarianAttackState,
): BarbarianAttackGame {
  return { ...state, barbarianAttack: fn(state.barbarianAttack) };
}

// Record a batch of events for the log (see BarbarianAttackState.lastEvents).
export function pushBarbarianEvents(
  state: BarbarianAttackGame,
  events: BarbarianAttackEvent[],
): BarbarianAttackGame {
  if (events.length === 0) return state;
  const seq = (state.barbarianAttack.lastEvents?.seq ?? 0) + 1;
  return patchBarbarianAttack(state, (ba) => ({ ...ba, lastEvents: { seq, events } }));
}

// Add `delta` barbarians to a hex (negative to remove). Keeps 0 entries out
// of the map.
export function withBarbarians(
  ba: BarbarianAttackState,
  hexId: HexId,
  delta: number,
): BarbarianAttackState {
  const n = (ba.barbarians[hexId] ?? 0) + delta;
  const barbarians = { ...ba.barbarians };
  if (n <= 0) delete barbarians[hexId];
  else barbarians[hexId] = n;
  return { ...ba, barbarians };
}
