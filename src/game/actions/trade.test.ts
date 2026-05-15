import { describe, it, expect } from 'vitest';
import { createGame } from '../createGame';
import { applyAction } from '../engine';
import { runSetupPhase, giveResources } from '../__testHelpers';
import { getBankTradeRate } from './trade';

function setupGame() {
  return runSetupPhase(createGame({ playerNames: ['A', 'B'], seed: 42, randomizeTurnOrder: false }));
}

function reachMainPhase() {
  let s = setupGame();
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
  return s;
}

describe('bank trade', () => {
  it('defaults to 4:1 with no ports', () => {
    let s = reachMainPhase();
    // Strip ports from p0
    s = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: [] } : p)) };
    expect(getBankTradeRate(s, 'p0', 'wood')).toBe(4);
  });

  it('uses 3:1 with a generic port', () => {
    let s = reachMainPhase();
    s = {
      ...s,
      players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: ['generic'] } : p)),
    };
    expect(getBankTradeRate(s, 'p0', 'wood')).toBe(3);
  });

  it('uses 2:1 with the matching specific port', () => {
    let s = reachMainPhase();
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, ports: ['generic', 'wood'] } : p,
      ),
    };
    expect(getBankTradeRate(s, 'p0', 'wood')).toBe(2);
    expect(getBankTradeRate(s, 'p0', 'brick')).toBe(3);
  });

  it('executes a 4:1 trade correctly', () => {
    let s = reachMainPhase();
    s = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: [] } : p)) };
    s = giveResources(s, 'p0', { wood: 4 });
    const beforeBrick = s.players[0]!.resources.brick;
    const beforeWood = s.players[0]!.resources.wood;
    s = applyAction(s, { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'brick' });
    expect(s.players[0]!.resources.wood).toBe(beforeWood - 4);
    expect(s.players[0]!.resources.brick).toBe(beforeBrick + 1);
  });

  it('rejects a 4:1 trade without enough resources', () => {
    let s = reachMainPhase();
    s = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: [], resources: { wood: 3, brick: 0, sheep: 0, wheat: 0, ore: 0 } } : p)) };
    expect(() =>
      applyAction(s, { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'brick' }),
    ).toThrow(/need 4/i);
  });

  it('rejects trading a resource for itself', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 4 });
    expect(() =>
      applyAction(s, { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'wood' }),
    ).toThrow(/itself/i);
  });
});

describe('player-to-player trade', () => {
  it('propose creates a pendingTrade and accept swaps resources', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 2 });
    s = giveResources(s, 'p1', { brick: 2 });
    const p0Before = { ...s.players[0]!.resources };
    const p1Before = { ...s.players[1]!.resources };
    s = applyAction(s, {
      type: 'proposeTrade',
      playerId: 'p0',
      give: { wood: 1 },
      receive: { brick: 1 },
    });
    expect(s.pendingTrade).toBeDefined();
    expect(s.pendingTrade?.proposerId).toBe('p0');
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p1' });
    expect(s.pendingTrade).toBeUndefined();
    expect(s.players[0]!.resources.wood).toBe(p0Before.wood - 1);
    expect(s.players[0]!.resources.brick).toBe(p0Before.brick + 1);
    expect(s.players[1]!.resources.brick).toBe(p1Before.brick - 1);
    expect(s.players[1]!.resources.wood).toBe(p1Before.wood + 1);
  });

  it('cannot accept your own trade', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 2 });
    s = applyAction(s, {
      type: 'proposeTrade',
      playerId: 'p0',
      give: { wood: 1 },
      receive: { brick: 1 },
    });
    expect(() => applyAction(s, { type: 'acceptTrade', playerId: 'p0' })).toThrow();
  });

  it('cannot accept without the receive-side resources', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 2 });
    // p1 has no brick by default after setup
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1'
          ? { ...p, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 } }
          : p,
      ),
    };
    s = applyAction(s, {
      type: 'proposeTrade',
      playerId: 'p0',
      give: { wood: 1 },
      receive: { brick: 1 },
    });
    expect(() => applyAction(s, { type: 'acceptTrade', playerId: 'p1' })).toThrow(/don't have/i);
  });

  it('cannot propose if you lack the give-side resources', () => {
    let s = reachMainPhase();
    // strip p0 of resources
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0'
          ? { ...p, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 } }
          : p,
      ),
    };
    expect(() =>
      applyAction(s, {
        type: 'proposeTrade',
        playerId: 'p0',
        give: { wood: 1 },
        receive: { brick: 1 },
      }),
    ).toThrow();
  });

  it('cannot propose two trades at once', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 2, sheep: 2 });
    s = applyAction(s, {
      type: 'proposeTrade',
      playerId: 'p0',
      give: { wood: 1 },
      receive: { brick: 1 },
    });
    expect(() =>
      applyAction(s, {
        type: 'proposeTrade',
        playerId: 'p0',
        give: { sheep: 1 },
        receive: { brick: 1 },
      }),
    ).toThrow(/already pending/i);
  });

  it('only the proposer can cancel', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 2 });
    s = applyAction(s, {
      type: 'proposeTrade',
      playerId: 'p0',
      give: { wood: 1 },
      receive: { brick: 1 },
    });
    expect(() => applyAction(s, { type: 'cancelTrade', playerId: 'p1' })).toThrow(/proposer/i);
    s = applyAction(s, { type: 'cancelTrade', playerId: 'p0' });
    expect(s.pendingTrade).toBeUndefined();
  });

  it('end-turn auto-cancels a pending trade', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 2 });
    s = applyAction(s, {
      type: 'proposeTrade',
      playerId: 'p0',
      give: { wood: 1 },
      receive: { brick: 1 },
    });
    expect(s.pendingTrade).toBeDefined();
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.pendingTrade).toBeUndefined();
  });

  it('rejects empty trade sides', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 2 });
    expect(() =>
      applyAction(s, {
        type: 'proposeTrade',
        playerId: 'p0',
        give: {},
        receive: { brick: 1 },
      }),
    ).toThrow();
    expect(() =>
      applyAction(s, {
        type: 'proposeTrade',
        playerId: 'p0',
        give: { wood: 1 },
        receive: {},
      }),
    ).toThrow();
  });
});
