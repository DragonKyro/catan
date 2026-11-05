import type { GameState, PlayerId, VertexId } from '../../../types';
import { STRONGEST_PORTS_MIN_VP, STRONGEST_PORTS_VP } from '../constants';

// Count of port-edge vertices on the board. Each entry is a vertex touching
// a port; both endpoints of the port edge qualify.
function portVertexSet(state: GameState): Set<VertexId> {
  const out = new Set<VertexId>();
  for (const port of state.board.ports) {
    const edge = state.board.edges[port.edge];
    if (!edge) continue;
    out.add(edge.vertices[0]);
    out.add(edge.vertices[1]);
  }
  return out;
}

// VP value of a single player's port-buildings: 1 per settlement on a port
// vertex, 2 per city.
export function portBuildingsVp(state: GameState, playerId: PlayerId): number {
  const portVerts = portVertexSet(state);
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  let vp = 0;
  for (const v of player.settlements) if (portVerts.has(v)) vp += 1;
  for (const v of player.cities) if (portVerts.has(v)) vp += 2;
  return vp;
}

// Recalculate the Strongest Ports tile holder. Holder must have ≥ 3 port-VPs
// AND strictly more than every other player; ties leave it null.
//
// 2025 rulebook p. 4: "The first player to have 3 VPs in buildings on ports
// receives the Strongest Ports tile. If another player has more VPs in
// buildings on ports, they immediately receive this tile." So the tile is
// sticky like Longest Road: the holder keeps it on a tie, and a challenger
// needs strictly MORE than the holder. If the holder drops below 3 (a
// building destroyed), it goes to the player with the most if that's one
// player at 3+, otherwise back beside the board.
export function recalcStrongestPorts(state: GameState): {
  holder: PlayerId | null;
} {
  const vps = state.players.map((p) => ({
    id: p.id,
    vp: portBuildingsVp(state, p.id),
  }));
  const current = state.strongestPorts?.holder ?? null;
  const held = vps.find((e) => e.id === current);
  let max = -1;
  for (const e of vps) if (e.vp > max) max = e.vp;
  if (held && held.vp >= STRONGEST_PORTS_MIN_VP) {
    if (max <= held.vp) return { holder: current };
    const challengers = vps.filter((e) => e.vp === max);
    return { holder: challengers.length === 1 ? challengers[0]!.id : current };
  }
  if (max < STRONGEST_PORTS_MIN_VP) return { holder: null };
  const tied = vps.filter((e) => e.vp === max);
  if (tied.length !== 1) return { holder: null };
  return { holder: tied[0]!.id };
}

// VP swing from the Strongest Ports tile for a single player. Returns 0 when
// the variant is off or the player doesn't hold the tile.
export function calculateStrongestPortsVp(
  state: GameState,
  playerId: PlayerId,
): number {
  if (!state.strongestPorts) return 0;
  return state.strongestPorts.holder === playerId ? STRONGEST_PORTS_VP : 0;
}
