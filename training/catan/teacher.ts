// The hand-written AI (src/ai) as a player and as a teacher.
//
// `heuristicAction` is how a heuristic seat moves in the training env, trade
// answers included. `teacherSlot` is what it would pick for a network seat's
// pending decision, as a slot — the imitation target during the warm start
// and the anchor's target after it. For a multi-part answer it is the slot of
// the next part of the heuristic's whole answer. −1 when the move can't be
// expressed in the action space (an offer outside the menu) or isn't legal
// here (the draft so far has left the heuristic's answer).

import type { Action, EdgeId, GameState, PlayerId } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { canConnectRoad } from '@/game/placement';
import { chooseAction, shouldAcceptTrade } from '@/ai/index';
import { slotForAction } from '@/ai/nn/actions';
import type { CatanObservation } from '@/ai/nn/observation';

export function heuristicAction(s: GameState, id: PlayerId): Action {
  const pt = s.pendingTrade;
  if (pt) {
    const me = s.players.find((p) => p.id === id)!;
    const canPay = RESOURCES.every((r) => me.resources[r] >= (pt.receive[r] ?? 0));
    if (canPay && shouldAcceptTrade(s, id)) return { type: 'acceptTrade', playerId: id };
    return pt.proposerId !== s.playerOrder[s.currentPlayerIndex] ? { type: 'cancelTrade', playerId: id } : { type: 'rejectTrade', playerId: id };
  }
  return chooseAction(s, id) ?? { type: 'endTurn', playerId: id };
}

/** The heuristic's Road Building roads: the first two that fit (src/ai/devcard.ts). */
function roadBuildingEdges(s: GameState, id: PlayerId): EdgeId[] {
  const out: EdgeId[] = [];
  for (const e of s.board.edgeIds) {
    if (canConnectRoad(s, id, e)) out.push(e);
    if (out.length === 2) break;
  }
  return out;
}

/** The heuristic's slot for the decision `obs` shows (`mask` = its legal mask), or −1. */
export function teacherSlot(s: GameState, id: PlayerId, obs: CatanObservation, mask: Uint8Array): number {
  const d = obs.decision;
  if (!d) return -1;
  const action: Action = d.type === 'roadBuilding'
    ? { type: 'playRoadBuilding', playerId: id, edges: roadBuildingEdges(s, id) as [EdgeId, EdgeId] }
    : heuristicAction(s, id);
  const slot = slotForAction(obs, action);
  return slot >= 0 && mask[slot] ? slot : -1;
}
