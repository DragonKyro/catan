import type {
  EdgeId,
  GameState,
  PlaceTribePortAction,
  PlayerId,
  PortType,
} from '../../types';
import { currentPlayerId, updatePlayer } from '../../helpers';
import { isPortEligibleEdge } from './board/edges';

// The Forgotten Tribe (rulebook p.12). VP tokens, face-down development
// cards and ports sit on edges around the tribe's islands. "When you build
// or move one of your ships onto an edge with a [token], take [it]."
//   - VP token: 1 VP, kept in front of you (visible).
//   - Development card: use it as if you bought it this turn — playable on
//     a later turn, or revealed at once if it's a Victory Point.
//   - Port: place it next to one of your coastal settlements, with at least
//     one edge between ports. With no valid edge, keep it until you have one.

export function claimTribeTokensOnEdge(
  state: GameState,
  playerId: PlayerId,
  edge: EdgeId,
): GameState {
  const tokens = state.tribeTokens;
  if (!tokens || !tokens.some((t) => t.edge === edge && t.claimedBy === null)) {
    return state;
  }
  let next = state;
  const claimed = tokens.map((t) => {
    if (t.edge !== edge || t.claimedBy !== null) return t;
    if (t.type === 'victoryPoint') {
      next = updatePlayer(next, playerId, (p) => ({ ...p, tribeVp: (p.tribeVp ?? 0) + 1 }));
    } else if (t.type === 'devCard' && t.devCard) {
      const card = t.devCard;
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        devCards:
          card === 'victoryPoint'
            ? { ...p.devCards, victoryPoints: p.devCards.victoryPoints + 1 }
            : { ...p.devCards, boughtThisTurn: [...p.devCards.boughtThisTurn, card] },
      }));
    } else if (t.type === 'port' && t.portType) {
      const portType = t.portType;
      next = updatePlayer(next, playerId, (p) => ({
        ...p,
        heldPorts: [...(p.heldPorts ?? []), portType],
      }));
    }
    return { ...t, claimedBy: playerId };
  });
  return { ...next, tribeTokens: claimed };
}

// Edges where `playerId` may place a tribe port: a coastal edge (land
// against sea, or land against the sea frame) touching one of their
// settlements or cities, with no port on it or on any edge that shares a
// corner with it ("there must always be one edge between ports").
export function validTribePortEdges(state: GameState, playerId: PlayerId): EdgeId[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];
  const portEdges = new Set(state.board.ports.map((p) => p.edge));
  const portVertices = new Set<string>();
  for (const eid of portEdges) {
    for (const v of state.board.edges[eid]?.vertices ?? []) portVertices.add(v);
  }
  const out = new Set<EdgeId>();
  for (const v of [...player.settlements, ...player.cities]) {
    for (const eid of state.board.vertices[v]?.edges ?? []) {
      if (!isPortEligibleEdge(state.board, eid)) continue;
      const edge = state.board.edges[eid]!;
      if (portEdges.has(eid)) continue;
      if (edge.vertices.some((x) => portVertices.has(x))) continue;
      out.add(eid);
    }
  }
  return [...out];
}

// If the player holds a tribe port and can place it now, open the
// placement step. Only during the main phase (setup pickups wait).
export function maybeStartTribePortPlacement(
  state: GameState,
  playerId: PlayerId,
): GameState {
  if (state.phase !== 'main' || state.pendingTribePort) return state;
  const player = state.players.find((p) => p.id === playerId);
  const held = player?.heldPorts ?? [];
  if (held.length === 0) return state;
  if (validTribePortEdges(state, playerId).length === 0) return state;
  const [portType, ...rest] = held as [PortType, ...PortType[]];
  const next = updatePlayer(state, playerId, (p) => ({
    ...p,
    heldPorts: rest.length > 0 ? rest : undefined,
  }));
  return { ...next, phase: 'placeTribePort', pendingTribePort: { playerId, portType } };
}

export function handlePlaceTribePort(
  state: GameState,
  action: PlaceTribePortAction,
): GameState {
  if (state.phase !== 'placeTribePort' || !state.pendingTribePort) {
    throw new Error(`Cannot place a port in phase ${state.phase}`);
  }
  const { playerId, portType } = state.pendingTribePort;
  if (action.playerId !== playerId || playerId !== currentPlayerId(state)) {
    throw new Error('Not your port to place');
  }
  if (!validTribePortEdges(state, playerId).includes(action.edge)) {
    throw new Error('A port must go next to your coastal settlement, one edge from other ports');
  }
  let next: GameState = {
    ...state,
    board: { ...state.board, ports: [...state.board.ports, { edge: action.edge, type: portType }] },
    phase: 'main',
    pendingTribePort: undefined,
  };
  // Whoever has a building on either end of the edge can use the port at
  // once ("Ports may be used immediately upon being placed").
  const ends = new Set(state.board.edges[action.edge]!.vertices);
  for (const p of next.players) {
    const touches = [...p.settlements, ...p.cities].some((v) => ends.has(v));
    if (touches && !p.ports.includes(portType)) {
      next = updatePlayer(next, p.id, (pl) => ({ ...pl, ports: [...pl.ports, portType] }));
    }
  }
  // Another held port waiting? Keep placing.
  return maybeStartTribePortPlacement(next, playerId);
}

export function calculateTribeVp(state: GameState, playerId: PlayerId): number {
  return state.players.find((p) => p.id === playerId)?.tribeVp ?? 0;
}
