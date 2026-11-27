// Every move the game store applies — this device's own (`dispatch`) and
// the room's (`applyLocal`) — as (before, action, after, when), for the UI's
// short board animations (src/ui/game/animations). Plain listeners outside
// any store so a subscriber never re-renders on unrelated state. Headless
// games (AI training, sims) never go through the store, so they never
// animate.

import type { Action, GameState } from '@/game/types';

export type BoardTransitionListener = (before: GameState, action: Action, after: GameState, at: number) => void;

const listeners = new Set<BoardTransitionListener>();

/** Listen to applied moves; returns the unsubscribe. */
export function onBoardTransition(fn: BoardTransitionListener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function emitBoardTransition(before: GameState, action: Action, after: GameState, at: number): void {
  for (const fn of listeners) {
    try {
      fn(before, action, after, at);
    } catch (e) {
      // An animation must never break a move.
      console.warn('[boardEvents] listener failed:', (e as Error).message);
    }
  }
}
