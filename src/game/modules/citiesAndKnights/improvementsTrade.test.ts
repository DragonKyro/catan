import { describe, expect, it } from 'vitest';
import type { GameState, PlayerId } from '../../types';
import { applyAction } from '../../engine';
import { updatePlayer } from '../../helpers';
import { calculateVictoryPoints } from '../../scoring/points';
import { activeMain, ckAfterSetup, setCommodities, setImprovements } from './testSupport';
import { ckBankTradeRate } from './trade';
import { improvementBlocker } from './actions/buildCityImprovement';

function main(): GameState {
  return activeMain(ckAfterSetup(), 'p0');
}

function hand(s: GameState, pid: PlayerId, r: Partial<Record<'wood' | 'brick' | 'sheep' | 'wheat' | 'ore', number>>) {
  return updatePlayer(s, pid, (p) => ({
    ...p,
    resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0, ...r },
  }));
}

describe('C&K city improvements (p.8)', () => {
  it('needs a city; level n costs n of the track commodity; no skipping', () => {
    let s = main();
    s = setCommodities(s, 'p0', { cloth: 3 });
    s = applyAction(s, { type: 'buildCityImprovement', playerId: 'p0', track: 'trade' });
    expect(s.players[0]!.improvements!.trade).toBe(1);
    expect(s.players[0]!.commodities!.cloth).toBe(2);
    s = applyAction(s, { type: 'buildCityImprovement', playerId: 'p0', track: 'trade' });
    expect(s.players[0]!.improvements!.trade).toBe(2);
    expect(s.players[0]!.commodities!.cloth).toBe(0);
    // No city: blocked even with commodities (improvements are kept).
    s = setCommodities(s, 'p0', { cloth: 5 });
    s = updatePlayer(s, 'p0', (p) => ({ ...p, cities: [] }));
    expect(improvementBlocker(s, 'p0', 'trade')).toMatch(/city/);
    expect(s.players[0]!.improvements!.trade).toBe(2);
  });

  it('Crane takes 1 commodity off one improvement (even to zero), one Crane at a time', () => {
    let s = main();
    s = updatePlayer(s, 'p0', (p) => ({
      ...p,
      progressCards: { science: ['crane', 'crane'], trade: [], politics: [] },
    }));
    s = setCommodities(s, 'p0', {});
    s = applyAction(s, { type: 'playProgressCard', playerId: 'p0', card: 'crane' });
    expect(() => applyAction(s, { type: 'playProgressCard', playerId: 'p0', card: 'crane' })).toThrow(/one Crane/);
    s = applyAction(s, { type: 'buildCityImprovement', playerId: 'p0', track: 'science' });
    expect(s.players[0]!.improvements!.science).toBe(1);
    expect(s.craneActive).toBe(false);
  });

  it('first to level 4 takes the metropolis (temporary, +2 VP); first to 5 takes it for good', () => {
    let s = main();
    s = setImprovements(s, 'p0', { politics: 3 });
    s = setImprovements(s, 'p1', { politics: 3 });
    s = setCommodities(s, 'p0', { coin: 4 });
    const vp0 = calculateVictoryPoints(s, 'p0', false);
    s = applyAction(s, { type: 'buildCityImprovement', playerId: 'p0', track: 'politics' });
    expect(s.metropolises!.politics).toMatchObject({ playerId: 'p0', permanent: false });
    expect(calculateVictoryPoints(s, 'p0', false)).toBe(vp0 + 2);
    // p1 reaching level 4 later doesn't take it.
    s = activeMain(s, 'p1');
    s = setCommodities(s, 'p1', { coin: 9 });
    s = applyAction(s, { type: 'buildCityImprovement', playerId: 'p1', track: 'politics' });
    expect(s.metropolises!.politics!.playerId).toBe('p0');
    // …but first to level 5 does, permanently.
    s = applyAction(s, { type: 'buildCityImprovement', playerId: 'p1', track: 'politics' });
    expect(s.metropolises!.politics).toMatchObject({ playerId: 'p1', permanent: true });
    expect(calculateVictoryPoints(s, 'p0', false)).toBe(vp0);
    // A permanent metropolis can't be taken, even at level 5.
    s = activeMain(s, 'p0');
    s = setCommodities(s, 'p0', { coin: 5 });
    s = applyAction(s, { type: 'buildCityImprovement', playerId: 'p0', track: 'politics' });
    expect(s.metropolises!.politics!.playerId).toBe('p1');
  });

  it('no free city → you may not buy the level that would win the metropolis', () => {
    let s = main();
    s = setImprovements(s, 'p0', { science: 3, trade: 3 });
    s = setCommodities(s, 'p0', { paper: 4, cloth: 4 });
    s = applyAction(s, { type: 'buildCityImprovement', playerId: 'p0', track: 'science' });
    expect(s.metropolises!.science!.playerId).toBe('p0');
    // p0's only city now holds the science metropolis.
    expect(() =>
      applyAction(s, { type: 'buildCityImprovement', playerId: 'p0', track: 'trade' }),
    ).toThrow(/none of your cities is free/);
  });

  it('with two free cities the player picks where the metropolis goes', () => {
    let s = main();
    const extra = s.players[0]!.settlements[0]!;
    s = updatePlayer(s, 'p0', (p) => ({
      ...p,
      settlements: p.settlements.filter((v) => v !== extra),
      cities: [...p.cities, extra],
    }));
    s = setImprovements(s, 'p0', { trade: 3 });
    s = setCommodities(s, 'p0', { cloth: 4 });
    s = applyAction(s, { type: 'buildCityImprovement', playerId: 'p0', track: 'trade' });
    expect(s.phase).toBe('placeMetropolis');
    s = applyAction(s, { type: 'placeMetropolis', playerId: 'p0', track: 'trade', vertex: extra });
    expect(s.metropolises!.trade).toMatchObject({ playerId: 'p0', vertex: extra });
    expect(s.phase).toBe('main');
  });
});

describe('C&K trading (p.7)', () => {
  it('commodities trade 4:1 at the supply, 3:1 with a generic harbor, never via 2:1 resource harbors', () => {
    let s = main();
    s = updatePlayer(s, 'p0', (p) => ({ ...p, ports: ['wood'] }));
    expect(ckBankTradeRate(s, 'p0', 'paper')).toBe(4);
    expect(ckBankTradeRate(s, 'p0', 'wood')).toBe(2);
    s = updatePlayer(s, 'p0', (p) => ({ ...p, ports: ['wood', 'generic'] }));
    expect(ckBankTradeRate(s, 'p0', 'paper')).toBe(3);
  });

  it('Merchant Guild (trade level 3) trades commodities 2:1 for resources or commodities', () => {
    let s = main();
    s = setImprovements(s, 'p0', { trade: 3 });
    s = setCommodities(s, 'p0', { coin: 2 });
    s = hand(s, 'p0', {});
    s = applyAction(s, { type: 'bankTradeCK', playerId: 'p0', give: 'coin', receive: 'paper' });
    expect(s.players[0]!.commodities).toEqual({ paper: 1, cloth: 0, coin: 0 });
    expect(s.commodityBank!.coin).toBe(14);
  });

  it('resources can be traded to the supply for commodities at the resource rate', () => {
    let s = main();
    s = hand(s, 'p0', { ore: 4 });
    s = setCommodities(s, 'p0', {});
    s = applyAction(s, { type: 'bankTradeCK', playerId: 'p0', give: 'ore', receive: 'coin' });
    expect(s.players[0]!.resources.ore).toBe(0);
    expect(s.players[0]!.commodities!.coin).toBe(1);
  });

  it('Merchant Fleet naming a commodity makes it 2:1 this turn', () => {
    let s = main();
    s = updatePlayer(s, 'p0', (p) => ({
      ...p,
      progressCards: { science: [], trade: ['merchantFleet'], politics: [] },
    }));
    s = setCommodities(s, 'p0', { cloth: 2 });
    s = applyAction(s, { type: 'playProgressCard', playerId: 'p0', card: 'merchantFleet', commodity: 'cloth' });
    s = hand(s, 'p0', {});
    s = applyAction(s, { type: 'bankTradeCK', playerId: 'p0', give: 'cloth', receive: 'wheat' });
    expect(s.players[0]!.resources.wheat).toBe(1);
  });

  it('player trades can mix resources and commodities', () => {
    let s = main();
    s = hand(s, 'p0', { wood: 1 });
    s = setCommodities(s, 'p0', { paper: 1 });
    s = hand(s, 'p1', { ore: 1 });
    s = setCommodities(s, 'p1', { coin: 1 });
    s = applyAction(s, {
      type: 'proposeTrade',
      playerId: 'p0',
      give: { wood: 1 },
      giveCommodities: { paper: 1 },
      receive: {},
      receiveCommodities: { coin: 1 },
    });
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p1' });
    expect(s.players[0]!.commodities).toEqual({ paper: 0, cloth: 0, coin: 1 });
    expect(s.players[0]!.resources.wood).toBe(0);
    expect(s.players[1]!.commodities).toEqual({ paper: 1, cloth: 0, coin: 0 });
    expect(s.players[1]!.resources.wood).toBe(1);
  });

  it('the merchant: 1 VP and 2:1 on its hex resource (not commodities); any land hex incl. desert', () => {
    let s = main();
    const v = s.players[0]!.cities[0]!;
    const hex = s.board.vertices[v]!.hexes.find((h) =>
      ['wood', 'brick', 'sheep', 'wheat', 'ore'].includes(s.board.hexes[h]!.terrain),
    )!;
    const terrain = s.board.hexes[hex]!.terrain as 'wood';
    s = updatePlayer(s, 'p0', (p) => ({
      ...p,
      ports: [],
      progressCards: { science: [], trade: ['merchantCard'], politics: [] },
    }));
    const vp = calculateVictoryPoints(s, 'p0', false);
    s = applyAction(s, { type: 'playProgressCard', playerId: 'p0', card: 'merchantCard' });
    expect(s.phase).toBe('placeMerchant');
    s = applyAction(s, { type: 'placeMerchant', playerId: 'p0', hex });
    expect(calculateVictoryPoints(s, 'p0', false)).toBe(vp + 1);
    expect(ckBankTradeRate(s, 'p0', terrain)).toBe(2);
    expect(ckBankTradeRate(s, 'p0', 'paper')).toBe(4);
  });
});
