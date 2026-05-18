import type { Action, GameState, PlayerId, EdgeId } from '@/game/types';
import { canPlaceWagon } from '@/game/modules/traders/merchantTrains/placement';

// Voting strategy: when the AI is in the wagon-voting phase, abstain by
// default. This keeps wagon placement predictable (active player picks)
// and avoids spending wool/wheat unprofitably — those are scarce city
// resources. Future tuning could bid when a wagon next to one of our
// roads would gain us Longest Route.
export function trySubmitWagonVote(
  state: GameState,
  playerId: PlayerId,
): Action | null {
  if (state.phase !== 'wagonVoting' || !state.wagonVote) return null;
  if (state.wagonVote.bids[playerId]) return null;
  return {
    type: 'submitWagonVote',
    playerId,
    cards: {},
    target: null,
  };
}

// Placement strategy: drop the wagon on an edge adjacent to one of our
// own roads when possible (extends our Longest Route by 1). Otherwise
// fall back to any legal placement.
export function tryPlaceWagon(
  state: GameState,
  playerId: PlayerId,
): Action | null {
  if (state.phase !== 'placeWagon' || !state.pendingWagonPlacement) return null;
  if (state.pendingWagonPlacement.placerId !== playerId) return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const ownRoadEdges = new Set<EdgeId>(player.roads);
  let onMyRoad: EdgeId | null = null;
  let firstLegal: EdgeId | null = null;
  for (const eid of state.board.edgeIds) {
    if (!canPlaceWagon(state, eid)) continue;
    if (firstLegal === null) firstLegal = eid;
    if (ownRoadEdges.has(eid)) {
      onMyRoad = eid;
      break;
    }
  }
  const target = onMyRoad ?? firstLegal;
  if (!target) return null;
  return { type: 'placeWagon', playerId, edge: target };
}
