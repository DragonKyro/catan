import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { runSetupPhase, giveResources } from '@/game/__testHelpers';
import type { GameState } from '@/game/types';
import { hasAnsweredTrade } from '@/game/actions/trade';
import { chooseTradePartner, nextTradeResponder, pendingTradeStep, shouldAcceptTrade, tryCounterTrade, tryExtractCounter } from './trade';
import { MAX_AI_COUNTERS_PER_SEAT, MAX_AI_COUNTERS_PER_TURN, aiMayCounter } from './counterLimits';
import { sampleGames } from './nn/testSupport';

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

describe('counter-offer limits (like the 2 offers a turn)', () => {
  /** States from all-AI games where some AI would counter the offer on the table. */
  function wouldCounter(): Array<{ s: GameState; id: string; other: string }> {
    const out: Array<{ s: GameState; id: string; other: string }> = [];
    for (const { state: s } of sampleGames({ players: 4, games: 3, seed: 91, every: 1, maxSteps: 1500 })) {
      const pt = s.pendingTrade;
      if (!pt) continue;
      for (const p of s.players) {
        if (p.id === pt.proposerId || hasAnsweredTrade(pt, p.id)) continue;
        if (!tryExtractCounter(s, p.id) && !tryCounterTrade(s, p.id)) continue;
        const other = s.players.find((x) => x.id !== p.id && x.id !== pt.proposerId)!.id;
        out.push({ s, id: p.id, other });
        break;
      }
      if (out.length >= 10) break;
    }
    return out;
  }
  const counters = (s: GameState, id: string) => tryExtractCounter(s, id) ?? tryCounterTrade(s, id);
  const made = (s: GameState, by: Record<string, number>): GameState => ({ ...s, countersThisTurn: by });

  it('each AI counters at most once a turn, and the AIs together at most once a turn', () => {
    expect([MAX_AI_COUNTERS_PER_SEAT, MAX_AI_COUNTERS_PER_TURN]).toEqual([1, 1]);
    const cases = wouldCounter();
    expect(cases.length).toBeGreaterThan(0);
    for (const { s, id, other } of cases) {
      expect(counters(s, id)).not.toBeNull();
      expect(counters(made(s, { [id]: 1 }), id)).toBeNull(); // its own counter this turn
      expect(counters(made(s, { [other]: 1 }), id)).toBeNull(); // another AI's
      // A human's counters don't use up the AIs' allowance.
      const human = { ...s, players: s.players.map((p) => (p.id === other ? { ...p, isAI: false } : p)) };
      expect(aiMayCounter(made(human, { [other]: 3 }), id)).toBe(true);
      expect(counters(made(human, { [other]: 3 }), id)).not.toBeNull();
    }
  });
});

describe('2 players: a trade is judged against what it does for the proposer', () => {
  function twoPlayerOffer(give: Record<string, number>, receive: Record<string, number>): GameState {
    let s = runSetupPhase(createGame({ playerNames: ['A', 'B'], seed: 42, randomizeTurnOrder: false }));
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    const empty = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    s = { ...s, players: s.players.map((p) => ({ ...p, resources: { ...empty } })) };
    s = giveResources(s, 'p0', { sheep: 3, wheat: 2 });
    s = giveResources(s, 'p1', { brick: 4 });
    return applyAction(s, { type: 'proposeTrade', playerId: 'p0', give, receive });
  }

  it('refuses an even swap the proposer asked for (it helps them more), takes a generous one', () => {
    expect(shouldAcceptTrade(twoPlayerOffer({ sheep: 1 }, { brick: 1 }), 'p1')).toBe(false);
    expect(shouldAcceptTrade(twoPlayerOffer({ sheep: 2, wheat: 1 }, { brick: 1 }), 'p1')).toBe(true);
  });
});
