import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase, giveResources } from '@/game/__testHelpers';
import { useGameStore } from './gameStore';
import { useLogStore } from './logStore';
import { tradeBreakdown } from './tradeStats';

describe('trades by partner (end-of-game summary)', () => {
  it('counts completed player trades per pair, counters included, and bank trades per player', () => {
    let s = runSetupPhase(
      createGame({ playerNames: ['Ann', 'Bo', 'Cy'], playerTypes: ['human', 'human', 'human'], seed: 7, randomizeTurnOrder: false }),
    );
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    for (const id of ['p0', 'p1', 'p2']) s = giveResources(s, id, { wood: 5, brick: 5, sheep: 5, wheat: 5, ore: 5 });
    useLogStore.getState().reset(s);
    useGameStore.setState({ game: s, dialog: null, tradeCounter: null, error: null });
    const { dispatch } = useGameStore.getState();
    // An offer taken by Bo; a counter from Cy that Ann accepts; an offer nobody takes; a bank trade.
    dispatch({ type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { ore: 1 } });
    dispatch({ type: 'acceptTrade', playerId: 'p1' });
    dispatch({ type: 'rejectTrade', playerId: 'p2' });
    dispatch({ type: 'confirmTrade', playerId: 'p0', with: 'p1' });
    dispatch({ type: 'proposeTrade', playerId: 'p0', give: { brick: 1 }, receive: { sheep: 1 } });
    dispatch({ type: 'counterTrade', playerId: 'p2', give: { sheep: 1 }, receive: { brick: 2 } });
    dispatch({ type: 'confirmTrade', playerId: 'p0', with: 'p2', counter: true });
    dispatch({ type: 'proposeTrade', playerId: 'p0', give: { wheat: 1 }, receive: { ore: 1 } });
    dispatch({ type: 'rejectTrade', playerId: 'p1' });
    dispatch({ type: 'rejectTrade', playerId: 'p2' });
    dispatch({ type: 'bankTrade', playerId: 'p0', give: 'wheat', receive: 'ore' });
    expect(useGameStore.getState().error).toBeNull();

    const { entries, actions } = useLogStore.getState();
    const t = tradeBreakdown(['p0', 'p1', 'p2'], entries, actions);
    expect(t.p0).toEqual({ partners: { p1: 1, p2: 1 }, bank: 1, total: 3 });
    expect(t.p1).toEqual({ partners: { p0: 1, p2: 0 }, bank: 0, total: 1 });
    expect(t.p2).toEqual({ partners: { p0: 1, p1: 0 }, bank: 0, total: 1 });
  });
});
