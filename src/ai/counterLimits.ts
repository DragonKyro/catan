// How many counter-offers the AIs make, the way MAX_AI_PROPOSALS_PER_TURN
// limits their own offers: each AI seat at most MAX_AI_COUNTERS_PER_SEAT a
// turn, and all the AI seats together at most MAX_AI_COUNTERS_PER_TURN (so a
// person isn't flooded with AI counters to every offer). Humans counter
// freely, and their counters don't use up the AIs' allowance. Read from
// GameState.countersThisTurn, which the engine counts and clears when the
// turn passes. Shared by the heuristic (trade.ts) and the network's legal
// mask (nn/actions.ts, via the observation).
import type { GameState, PlayerId } from '@/game/types';

export const MAX_AI_COUNTERS_PER_SEAT = 1;
export const MAX_AI_COUNTERS_PER_TURN = 1;

/** Counter-offers the AI seats have made this turn, together. */
export function aiCountersThisTurn(state: GameState): number {
  const made = state.countersThisTurn;
  if (!made) return 0;
  return state.players.reduce((n, p) => n + (p.isAI ? made[p.id] ?? 0 : 0), 0);
}

/** Whether the AI seat `playerId` may still make a counter-offer this turn. */
export function aiMayCounter(state: GameState, playerId: PlayerId): boolean {
  return (state.countersThisTurn?.[playerId] ?? 0) < MAX_AI_COUNTERS_PER_SEAT
    && aiCountersThisTurn(state) < MAX_AI_COUNTERS_PER_TURN;
}
