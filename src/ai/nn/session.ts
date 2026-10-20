// Catan learned agent — every AI seat's knowledge during a live game.
//
// Knowledge (knowledge.ts) has to be folded forward from game creation, one
// action at a time. In the app the game log (src/store/logStore) already
// keeps the creation state and every applied action, so a session replays
// the log: new actions are folded in as they arrive, and a log that got
// shorter (undo) or restarted (new game) is replayed from the start.
//
// `sync` returns null when the log can't support it — the log began
// mid-game (a rejoin snapshot: hands weren't all empty, so they can't be
// known), or replaying it doesn't reproduce the live state. Callers then use
// the heuristic AI for that decision.
//
// Pure apart from its own cache: no React or store imports — the UI passes
// the log in.

import type { Action, GameState, PlayerId } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { applyAction } from '@/game/engine';
import { initialKnowledge, observeTransition, type CatanKnowledge } from './knowledge';

/** The public + private facts a replay must reproduce (cheap to compare). */
function signature(s: GameState): string {
  return JSON.stringify([
    s.phase, s.currentPlayerIndex, s.devCardDeck.length, RESOURCES.map((r) => s.bank[r]),
    s.players.map((p) => [p.id, RESOURCES.map((r) => p.resources[r]), p.settlements.length, p.cities.length,
      p.roads.length, p.devCards.unplayed.length, p.devCards.boughtThisTurn.length, p.devCards.victoryPoints]),
  ]);
}

export class KnowledgeSession {
  private initial: GameState | null = null;
  private seats = '';
  private state: GameState | null = null;
  private applied = 0;
  private knowledge: Record<PlayerId, CatanKnowledge> = {};
  /** Why this log can't be used (null = fine). Cleared by a new log. */
  private failure: string | null = null;

  /** Knowledge for `seats` after the log's `actions`, checked against the `live` state; null if unavailable. */
  sync(initial: GameState | null, actions: readonly Action[], live: GameState, seats: PlayerId[]): Record<PlayerId, CatanKnowledge> | null {
    if (!initial) return null;
    const seatKey = seats.join(',');
    if (initial !== this.initial || seatKey !== this.seats || actions.length < this.applied) {
      this.initial = initial;
      this.seats = seatKey;
      this.state = initial;
      this.applied = 0;
      this.failure = null;
      try {
        this.knowledge = Object.fromEntries(seats.map((id) => [id, initialKnowledge(initial, id)]));
      } catch (e) {
        this.failure = (e as Error).message;
      }
    }
    if (this.failure) return null;
    try {
      for (; this.applied < actions.length; this.applied++) {
        const action = actions[this.applied]!;
        const before = this.state!;
        const after = applyAction(before, action);
        for (const id of seats) this.knowledge[id] = observeTransition(this.knowledge[id]!, before, action, after);
        this.state = after;
      }
    } catch (e) {
      this.failure = `replaying the log failed: ${(e as Error).message}`;
      return null;
    }
    if (signature(this.state!) !== signature(live)) {
      this.failure = 'replaying the log does not reproduce the live game';
      return null;
    }
    return this.knowledge;
  }

  /** Why the last sync returned null, if it did. */
  get problem(): string | null {
    return this.failure;
  }
}
