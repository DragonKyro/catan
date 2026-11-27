import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, render } from '@testing-library/react';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase, giveResources } from '@/game/__testHelpers';
import type { Action, GameState } from '@/game/types';
import { useGameStore } from '@/store/gameStore';
import { useLogStore } from '@/store/logStore';

// The classic AI, with a switch to make its next move one the game refuses.
const refuseNext = { on: false };
vi.mock('@/ai', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai')>();
  return {
    ...real,
    chooseAction: (state: GameState, id: string) => {
      if (refuseNext.on) {
        refuseNext.on = false;
        return { type: 'buildCity', playerId: id, vertex: 'no-such-corner' } as Action;
      }
      return real.chooseAction(state, id);
    },
  };
});

const { AIDriver } = await import('./AIDriver');

function load(s: GameState) {
  useLogStore.getState().reset(s);
  useGameStore.setState({
    game: s, dialog: null, error: null, handoffPending: false, pendingRobberHex: null,
    lastActionSnapshot: null, undoStack: [],
  });
}

describe('AIDriver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('a move the game refuses falls through to another, so the AI never freezes', async () => {
    // p0 human, p1 / p2 classic AIs; p1 to roll.
    let s = runSetupPhase(createGame({ playerNames: ['H', 'A', 'B'], playerTypes: ['human', 'ai', 'ai'], seed: 4, randomizeTurnOrder: false }));
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [2, 3] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    load(s);
    refuseNext.on = true;
    render(<AIDriver />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    // Its refused build was logged, and it rolled instead.
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('refused buildCity'), expect.anything(), expect.anything());
    expect(useGameStore.getState().game!.lastRoll?.player).toBe('p1');
  });

  it('after an undo brings back an offer, the AIs answer it again', async () => {
    let s = runSetupPhase(createGame({ playerNames: ['H', 'A', 'B'], playerTypes: ['human', 'ai', 'ai'], seed: 4, randomizeTurnOrder: false }));
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [2, 3] });
    for (const id of ['p0', 'p1', 'p2']) s = giveResources(s, id, { wood: 3, brick: 3, sheep: 3, wheat: 3, ore: 3 });
    load(s);
    render(<AIDriver />);
    const { dispatch } = useGameStore.getState();
    act(() => dispatch({ type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { ore: 1 } }));
    const offered = useGameStore.getState().game!;
    // The AIs answer (yes / no, or a counter that replaces the offer).
    const touched = () => useGameStore.getState().game!.pendingTrade !== offered.pendingTrade;
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(touched()).toBe(true);
    // Put the unanswered offer back (as an undo / online rollback does): they answer it again.
    act(() => useGameStore.getState().restoreSnapshot({ game: offered, log: useLogStore.getState().snapshot() }));
    expect(touched()).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(touched()).toBe(true);
  });
});
