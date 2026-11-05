import type { GameState, PlayerId, VertexId } from '../../types';

// Seafarers island bonus (Heading for New Shores, The Four Islands, Through
// the Desert, Wonders of Catan, New World). Rulebook: "Each time you build
// your first settlement on a small island [unexplored island / region], you
// earn an additional N VPs ... it does not matter if other players have
// already built settlements on that island." So every player can earn every
// island's bonus once. The islands a player's starting settlements sit on are
// that player's home islands and never pay them a bonus.

function islandsAtVertex(state: GameState, vertexId: VertexId): Set<string> {
  const out = new Set<string>();
  const vertex = state.board.vertices[vertexId];
  const islandOf = state.board.islandOfHex;
  if (!vertex || !islandOf) return out;
  for (const hexId of vertex.hexes) {
    const id = islandOf[hexId];
    if (id) out.add(id);
  }
  return out;
}

// A settlement built during play: earn the bonus of each touched island this
// player hasn't earned yet and isn't at home on.
export function claimIslandBonus(
  state: GameState,
  playerId: PlayerId,
  vertexId: VertexId,
): GameState {
  if (!state.islandChips || state.islandChips.length === 0) return state;
  const touched = islandsAtVertex(state, vertexId);
  if (touched.size === 0) return state;
  let changed = false;
  const chips = state.islandChips.map((chip) => {
    if (!touched.has(chip.islandId)) return chip;
    if (chip.claimedBy.includes(playerId) || chip.homeOf.includes(playerId)) return chip;
    changed = true;
    return { ...chip, claimedBy: [...chip.claimedBy, playerId] };
  });
  return changed ? { ...state, islandChips: chips } : state;
}

// A starting settlement: the touched islands become this player's home
// islands. No bonus.
export function markHomeIslands(
  state: GameState,
  playerId: PlayerId,
  vertexId: VertexId,
): GameState {
  if (!state.islandChips || state.islandChips.length === 0) return state;
  const touched = islandsAtVertex(state, vertexId);
  if (touched.size === 0) return state;
  let changed = false;
  const chips = state.islandChips.map((chip) => {
    if (!touched.has(chip.islandId) || chip.homeOf.includes(playerId)) return chip;
    changed = true;
    return { ...chip, homeOf: [...chip.homeOf, playerId] };
  });
  return changed ? { ...state, islandChips: chips } : state;
}

export function calculateIslandBonusVp(state: GameState, playerId: PlayerId): number {
  if (!state.islandChips) return 0;
  let sum = 0;
  for (const chip of state.islandChips) {
    if (chip.claimedBy.includes(playerId)) sum += chip.vp;
  }
  return sum;
}

// Would a settlement on `vertexId` earn `playerId` an island bonus? (AI.)
export function islandBonusAt(
  state: GameState,
  playerId: PlayerId,
  vertexId: VertexId,
): number {
  if (!state.islandChips || state.islandChips.length === 0) return 0;
  const touched = islandsAtVertex(state, vertexId);
  let sum = 0;
  for (const chip of state.islandChips) {
    if (!touched.has(chip.islandId)) continue;
    if (chip.claimedBy.includes(playerId) || chip.homeOf.includes(playerId)) continue;
    sum += chip.vp;
  }
  return sum;
}
