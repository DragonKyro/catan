import { describe, it, expect, beforeEach } from 'vitest';
import { createGame, type PlayerKind } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase, giveResources } from '@/game/__testHelpers';
import type { EdgeId, GameState } from '@/game/types';
import { useGameStore } from './gameStore';
import { useLogStore } from './logStore';

function start(types: PlayerKind[]): GameState {
  let s = runSetupPhase(createGame({ playerNames: types.map((_, i) => `P${i}`), playerTypes: types, seed: 7, randomizeTurnOrder: false }));
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
  for (const id of s.playerOrder) s = giveResources(s, id, { wood: 6, brick: 6, sheep: 6, wheat: 6, ore: 6 });
  useLogStore.getState().reset(s);
  useGameStore.setState({ game: s, dialog: null, tradeCounter: null, error: null, lastActionSnapshot: null, undoStack: [] });
  return s;
}

/** A free edge touching p0's network (a settlement or the end of a road). */
function freeEdge(s: GameState): EdgeId {
  const me = s.players.find((p) => p.id === 'p0')!;
  const taken = new Set(s.players.flatMap((p) => p.roads));
  const ends = new Set([...me.settlements, ...me.roads.flatMap((e) => s.board.edges[e]!.vertices)]);
  for (const v of ends) {
    for (const e of s.board.vertices[v]!.edges) {
      if (taken.has(e)) continue;
      try {
        applyAction(s, { type: 'buildRoad', playerId: 'p0', edge: e });
        return e;
      } catch { /* not buildable */ }
    }
  }
  throw new Error('no free edge');
}

const game = () => useGameStore.getState().game!;
const res = (s: GameState, id: string) => s.players.find((p) => p.id === id)!.resources;

describe('undo', () => {
  beforeEach(() => useGameStore.setState({ undoStack: [], lastActionSnapshot: null }));

  it('against AIs: every build and bank trade of the turn, one step at a time', () => {
    const s0 = start(['human', 'ai', 'ai']);
    const { dispatch, undo } = useGameStore.getState();
    dispatch({ type: 'buildRoad', playerId: 'p0', edge: freeEdge(game()) });
    const s1 = game();
    dispatch({ type: 'buildRoad', playerId: 'p0', edge: freeEdge(game()) });
    dispatch({ type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'ore' });
    expect(useGameStore.getState().undoStack).toHaveLength(3);
    undo();
    undo();
    expect(game()).toBe(s1);
    undo();
    expect(game()).toBe(s0);
    expect(useGameStore.getState().lastActionSnapshot).toBeNull();
  });

  it('against AIs: a trade an AI took undoes back to before the offer, past its answer', () => {
    start(['human', 'ai', 'ai']);
    const { dispatch, undo } = useGameStore.getState();
    dispatch({ type: 'buildRoad', playerId: 'p0', edge: freeEdge(game()) });
    const beforeOffer = game();
    dispatch({ type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { ore: 1 } });
    dispatch({ type: 'acceptTrade', playerId: 'p1' }); // the AI's yes
    dispatch({ type: 'rejectTrade', playerId: 'p2' });
    dispatch({ type: 'confirmTrade', playerId: 'p0', with: 'p1' });
    expect(res(game(), 'p0').ore).toBe(res(beforeOffer, 'p0').ore + 1);
    expect(useGameStore.getState().undoStack).toHaveLength(2);
    undo();
    expect(game()).toBe(beforeOffer);
    expect(game().pendingTrade).toBeFalsy();
    // The road under it is still undoable.
    expect(useGameStore.getState().lastActionSnapshot).not.toBeNull();
    // Ending the turn closes the history.
    dispatch({ type: 'endTurn', playerId: 'p0' });
    expect(useGameStore.getState().undoStack).toEqual([]);
  });

  it('against AIs: accepting an AI\'s counter undoes back to before our offer', () => {
    start(['human', 'ai', 'ai']);
    const { dispatch, undo } = useGameStore.getState();
    const beforeOffer = game();
    dispatch({ type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { ore: 1 } });
    dispatch({ type: 'counterTrade', playerId: 'p1', give: { ore: 1 }, receive: { wood: 2 } });
    dispatch({ type: 'acceptTrade', playerId: 'p0' });
    expect(useGameStore.getState().undoStack).toHaveLength(1);
    undo();
    expect(game()).toBe(beforeOffer);
  });

  it('hot-seat with other humans: only the last build', () => {
    start(['human', 'human', 'ai']);
    const { dispatch, undo } = useGameStore.getState();
    dispatch({ type: 'buildRoad', playerId: 'p0', edge: freeEdge(game()) });
    const s1 = game();
    dispatch({ type: 'buildRoad', playerId: 'p0', edge: freeEdge(game()) });
    expect(useGameStore.getState().undoStack).toHaveLength(1);
    undo();
    expect(game()).toBe(s1);
    expect(useGameStore.getState().lastActionSnapshot).toBeNull();
    // A completed player trade isn't undoable there.
    dispatch({ type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { ore: 1 } });
    dispatch({ type: 'acceptTrade', playerId: 'p1' });
    dispatch({ type: 'confirmTrade', playerId: 'p0', with: 'p1' });
    expect(useGameStore.getState().lastActionSnapshot).toBeNull();
  });
});
