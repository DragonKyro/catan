import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import type { Action, GameState } from '@/game/types';
import { useLogStore } from './logStore';

// The beginner boards start at the first roll (no setup rounds), so the
// log opens on Turn 1 itself and counts revolutions from there.
describe('logStore turn markers on a game created at its first roll', () => {
  const turnMarkers = () =>
    useLogStore
      .getState()
      .entries.flatMap((e) => (e.kind === 'turnBegins' ? [e.turnNumber] : []));

  it('opens on Turn 1 and ticks to Turn 2 when the table comes round', () => {
    let s: GameState = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 4,
      settings: { baseScenarioId: 'beginner' },
    });
    useLogStore.getState().reset(s, 0);
    expect(turnMarkers()).toEqual([1]);
    expect(useLogStore.getState().turnNumber).toBe(1);

    // Each seat rolls a 4 and passes; then the first seat is up again.
    for (let i = 0; i < 3; i++) {
      for (const a of [
        { type: 'rollDice', playerId: getActingPlayerId(s), dice: [1, 3] },
        { type: 'endTurn', playerId: getActingPlayerId(s) },
      ] as Action[]) {
        const next = applyAction(s, a);
        useLogStore.getState().record(s, a, next, 0);
        s = next;
      }
    }
    expect(turnMarkers()).toEqual([1, 2]);
  });

  it('a game with setup rounds still opens on Turn 1 only after setup', () => {
    const s = createGame({ playerNames: ['A', 'B', 'C'], seed: 4 });
    useLogStore.getState().reset(s, 0);
    expect(turnMarkers()).toEqual([]);
    expect(useLogStore.getState().turnNumber).toBe(0);
  });
});
