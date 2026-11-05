import { describe, it, expect } from 'vitest';
import { useGameStore } from './gameStore';
import { getActingPlayerId } from '@/game/helpers';
import { chooseAction } from '@/ai';
import type { PlayerKind } from '@/game/createGame';

// Play `steps` moves (every seat driven by the heuristic, so the test can
// reach human turns), acknowledging handoffs. Returns how many handoff
// screens appeared and for whom.
function play(types: PlayerKind[], steps: number) {
  useGameStore.getState().newGame({
    playerNames: types.map((_, i) => `p${i}`),
    playerTypes: types,
    seed: 5,
    randomizeTurnOrder: false,
  });
  const shownFor: string[] = [];
  for (let i = 0; i < steps; i++) {
    const g = useGameStore.getState().game!;
    if (g.phase === 'gameOver') break;
    if (useGameStore.getState().handoffPending) {
      shownFor.push(getActingPlayerId(g));
      useGameStore.getState().acknowledgeHandoff();
    }
    const id = getActingPlayerId(g);
    const a = chooseAction(g, id) ?? { type: 'endTurn' as const, playerId: id };
    try {
      useGameStore.getState().dispatch(a);
    } catch {
      break;
    }
  }
  return shownFor;
}

describe('pass-device handoff', () => {
  it('never appears for a lone human playing against AIs', () => {
    expect(play(['human', 'ai', 'ai'], 400)).toEqual([]);
  });

  it('still appears when the device passes between two humans', () => {
    const shown = play(['human', 'ai', 'human'], 400);
    expect(shown.length).toBeGreaterThan(0);
    // Consecutive handoffs alternate between the two humans: AI turns in
    // between don't make the same human acknowledge again.
    for (let i = 1; i < shown.length; i++) expect(shown[i]).not.toBe(shown[i - 1]);
  });
});
