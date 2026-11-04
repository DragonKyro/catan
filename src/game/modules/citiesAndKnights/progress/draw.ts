import type { EventDieFace, GameState, ImprovementTrack, PlayerId } from '../../../types';
import { progressHandSize, receiveProgressCard, requireProgressDiscards } from './hand';

// Highest red-die value that draws a progress card for a cube on `level`
// (p.6, p.8: level 1 draws on a red 1-2, level 2 on 1-3, ... level 5 on
// 1-6). Level 0 (no improvement) never draws.
export function maxRedDieForLevel(level: number): number {
  return level <= 0 ? 0 : Math.min(6, level + 1);
}

export function drawsProgressCard(level: number, redDie: number): boolean {
  return redDie <= maxRedDieForLevel(level);
}

// Event die showed a city-improvement icon (p.6): each player whose cube on
// that track covers the red die draws the top card of the matching deck, in
// turn order from the active player. VP cards go face up at once; any
// non-active player now over 4 progress cards owes a discard.
export function drawProgressCardsForEvent(
  state: GameState,
  face: EventDieFace,
  redDie: number,
): GameState {
  if (face === 'barbarian') return state;
  const track: ImprovementTrack = face;
  let next: GameState = state;
  const n = state.playerOrder.length;
  for (let i = 0; i < n; i++) {
    const pid: PlayerId = state.playerOrder[(state.currentPlayerIndex + i) % n]!;
    const p = next.players.find((pl) => pl.id === pid)!;
    if (!drawsProgressCard(p.improvements?.[track] ?? 0, redDie)) continue;
    next = drawTopCard(next, pid, track);
  }
  return requireProgressDiscards(next);
}

// Draw the top card of `track`'s deck for `playerId` (nothing if empty).
export function drawTopCard(state: GameState, playerId: PlayerId, track: ImprovementTrack): GameState {
  const deck = state.progressDecks?.[track] ?? [];
  if (deck.length === 0) return state;
  const [card, ...rest] = deck;
  const next = receiveProgressCard(state, playerId, track, card!);
  return {
    ...next,
    progressDecks: {
      ...(next.progressDecks ?? { science: [], trade: [], politics: [] }),
      [track]: rest,
    },
  };
}

// Count of cards that count toward the 4-card limit (the whole hand; VP
// cards live in `progressVpCards`).
export function nonVpProgressCount(
  hand: GameState['players'][number]['progressCards'],
): number {
  return progressHandSize({ progressCards: hand });
}
