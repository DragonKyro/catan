import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase, giveResources } from '@/game/__testHelpers';
import type { GameState } from '@/game/types';
import { chooseTradePartner, nextTradeResponder, pendingTradeStep } from './trade';

/** Four players after setup, p0 to play, with an offer of 1 wood for 1 brick out. */
function offerOut(): GameState {
  let s = runSetupPhase(createGame({ playerNames: ['A', 'B', 'C', 'D'], seed: 42, randomizeTurnOrder: false }));
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
  s = giveResources(s, 'p0', { wood: 2 });
  for (const id of ['p1', 'p2', 'p3']) s = giveResources(s, id, { brick: 2 });
  return applyAction(s, { type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { brick: 1 } });
}

/** Give `id` this many extra VP-worth settlements' worth of points by marking cities (public VP). */
function withVp(s: GameState, id: string, cities: number): GameState {
  return {
    ...s,
    players: s.players.map((p) =>
      p.id === id ? { ...p, cities: [...p.cities, ...p.settlements.slice(0, cities)], settlements: p.settlements.slice(cities) } : p,
    ),
  };
}

describe('the proposer picks a partner', () => {
  it('trades with the acceptor furthest from winning', () => {
    let s = offerOut();
    s = withVp(s, 'p1', 2); // p1 4 VP, p2 2 VP
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p1' });
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p2' });
    expect(chooseTradePartner(s, 'p0')).toBe('p2');
  });

  it('walks away from an acceptor the trade would help win', () => {
    let s = offerOut();
    s = { ...s, settings: { ...s.settings, victoryPointsToWin: 5 } }; // p1 at 4 VP is close to winning
    s = withVp(s, 'p1', 2);
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p1' });
    expect(chooseTradePartner(s, 'p0')).toBeNull();
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p3' });
    expect(chooseTradePartner(s, 'p0')).toBe('p3');
  });

  it('only picks among the players who accepted', () => {
    const s = offerOut();
    expect(chooseTradePartner(s, 'p0')).toBeNull();
    expect(chooseTradePartner(s, 'p1')).toBeNull(); // not the proposer
  });
});

describe('pendingTradeStep (headless games)', () => {
  it('asks each opponent in turn order, then the proposer confirms its pick', () => {
    let s = offerOut();
    const accepts = (id: string) => id !== 'p2';
    const seen: string[] = [];
    for (let i = 0; i < 6 && s.pendingTrade; i++) {
      const a = pendingTradeStep(s, accepts);
      seen.push(`${a.type}:${a.playerId}`);
      s = applyAction(s, a);
    }
    expect(seen).toEqual(['acceptTrade:p1', 'rejectTrade:p2', 'acceptTrade:p3', 'confirmTrade:p0']);
    expect(s.pendingTrade).toBeUndefined();
  });

  it('closes the offer when everyone rejects, and never asks a player twice', () => {
    let s = offerOut();
    s = applyAction(s, pendingTradeStep(s, () => true)); // p1 says yes
    expect(nextTradeResponder(s)).toBe('p2');
    for (let i = 0; i < 2; i++) s = applyAction(s, pendingTradeStep(s, () => false));
    expect(nextTradeResponder(s)).toBeNull();
    expect(pendingTradeStep(s, () => false)).toEqual({ type: 'confirmTrade', playerId: 'p0', with: 'p1' });
    let t = offerOut();
    for (let i = 0; i < 3; i++) t = applyAction(t, pendingTradeStep(t, () => false));
    expect(t.pendingTrade).toBeUndefined();
  });
});
