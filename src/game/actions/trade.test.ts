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

/** Four players, p0 to play: several opponents can answer one offer. */
function reachMainPhase4() {
  const s = runSetupPhase(createGame({ playerNames: ['A', 'B', 'C', 'D'], seed: 42, randomizeTurnOrder: false }));
  return applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
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
    // An accept is a yes: nothing moves until the proposer picks a partner.
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p1' });
    expect(s.pendingTrade?.acceptedBy).toEqual(['p1']);
    expect(s.players[0]!.resources).toEqual(p0Before);
    s = applyAction(s, { type: 'confirmTrade', playerId: 'p0', with: 'p1' });
    expect(s.pendingTrade).toBeUndefined();
    expect(s.players[0]!.resources.wood).toBe(p0Before.wood - 1);
    expect(s.players[0]!.resources.brick).toBe(p0Before.brick + 1);
    expect(s.players[1]!.resources.brick).toBe(p1Before.brick - 1);
    expect(s.players[1]!.resources.wood).toBe(p1Before.wood + 1);
  });

  it('when several accept, the proposer picks one (or nobody); only acceptors can be picked', () => {
    let s = reachMainPhase4();
    s = giveResources(s, 'p0', { wood: 2 });
    s = giveResources(s, 'p1', { brick: 2 });
    s = giveResources(s, 'p2', { brick: 2 });
    s = applyAction(s, { type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { brick: 1 } });
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p1' });
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p1' }); // a second yes changes nothing
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p2' });
    expect(s.pendingTrade?.acceptedBy).toEqual(['p1', 'p2']);
    expect(() => applyAction(s, { type: 'confirmTrade', playerId: 'p0', with: 'p3' })).toThrow(/hasn't accepted/);
    expect(() => applyAction(s, { type: 'confirmTrade', playerId: 'p1', with: 'p2' })).toThrow(/proposer/);
    const p1Brick = s.players[1]!.resources.brick;
    const p2Brick = s.players[2]!.resources.brick;
    const done = applyAction(s, { type: 'confirmTrade', playerId: 'p0', with: 'p2' });
    expect(done.pendingTrade).toBeUndefined();
    expect(done.players[2]!.resources.brick).toBe(p2Brick - 1);
    expect(done.players[1]!.resources.brick).toBe(p1Brick); // the other acceptor keeps theirs
    // Or the proposer walks away from every acceptor.
    expect(applyAction(s, { type: 'cancelTrade', playerId: 'p0' }).pendingTrade).toBeUndefined();
  });

  it('a rejection after a yes takes the yes back', () => {
    let s = reachMainPhase4();
    s = giveResources(s, 'p0', { wood: 2 });
    s = giveResources(s, 'p1', { brick: 2 });
    s = applyAction(s, { type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { brick: 1 } });
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p1' });
    s = applyAction(s, { type: 'rejectTrade', playerId: 'p1' });
    expect(s.pendingTrade?.acceptedBy).toEqual([]);
    expect(s.pendingTrade?.rejectedBy).toEqual(['p1']);
    expect(() => applyAction(s, { type: 'confirmTrade', playerId: 'p0', with: 'p1' })).toThrow(/hasn't accepted/);
  });

  it('a counter-offer sits beside the offer, which stays open; the proposer may take it', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 2, sheep: 2 });
    s = giveResources(s, 'p1', { brick: 2 });
    s = applyAction(s, { type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { brick: 1 } });
    s = applyAction(s, { type: 'counterTrade', playerId: 'p1', give: { brick: 1 }, receive: { wood: 1, sheep: 1 } });
    // The original offer is still up, with p1's counter beside it.
    expect(s.pendingTrade).toMatchObject({ proposerId: 'p0', give: { wood: 1 }, receive: { brick: 1 } });
    expect(s.pendingTrade!.counters).toEqual([{ by: 'p1', give: { brick: 1 }, receive: { wood: 1, sheep: 1 } }]);
    // The proposer can't "accept" its own trade; it takes the counter with confirmTrade.
    expect(() => applyAction(s, { type: 'acceptTrade', playerId: 'p0' })).toThrow();
    const before = s.players[0]!.resources;
    s = applyAction(s, { type: 'confirmTrade', playerId: 'p0', with: 'p1', counter: true });
    expect(s.pendingTrade).toBeUndefined();
    expect(s.players[0]!.resources.brick).toBe(before.brick + 1);
    expect(s.players[0]!.resources.sheep).toBe(before.sheep - 1);
    expect(s.players[0]!.resources.wood).toBe(before.wood - 1);
  });

  it('others can still say yes to the offer after a counter; a no withdraws a counter', () => {
    let s = reachMainPhase4();
    s = giveResources(s, 'p0', { wood: 2 });
    s = giveResources(s, 'p1', { brick: 2 });
    s = giveResources(s, 'p2', { brick: 2 });
    s = applyAction(s, { type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { brick: 1 } });
    s = applyAction(s, { type: 'counterTrade', playerId: 'p1', give: { brick: 1 }, receive: { wood: 2 } });
    s = applyAction(s, { type: 'acceptTrade', playerId: 'p2' });
    expect(s.pendingTrade!.acceptedBy).toEqual(['p2']);
    expect(s.pendingTrade!.counters).toHaveLength(1);
    // p1 changes its mind: a no takes the counter back, and it can't be taken any more.
    s = applyAction(s, { type: 'rejectTrade', playerId: 'p1' });
    expect(s.pendingTrade!.counters).toEqual([]);
    expect(() => applyAction(s, { type: 'confirmTrade', playerId: 'p0', with: 'p1', counter: true })).toThrow(/counter-offer/);
    // The proposer trades with p2 on the original terms.
    s = applyAction(s, { type: 'confirmTrade', playerId: 'p0', with: 'p2' });
    expect(s.pendingTrade).toBeUndefined();
  });

  it('counts the counter-offers each player makes in a turn (the AI limit) and clears them when the turn passes', () => {
    let s = reachMainPhase4();
    s = giveResources(s, 'p0', { wood: 3, sheep: 2 });
    s = giveResources(s, 'p1', { brick: 3 });
    expect(s.countersThisTurn).toBeUndefined();
    s = applyAction(s, { type: 'proposeTrade', playerId: 'p0', give: { wood: 1 }, receive: { brick: 1 } });
    s = applyAction(s, { type: 'counterTrade', playerId: 'p1', give: { brick: 1 }, receive: { wood: 2 } });
    s = applyAction(s, { type: 'counterTrade', playerId: 'p1', give: { brick: 1 }, receive: { wood: 1, sheep: 1 } });
    expect(s.pendingTrade!.counters).toHaveLength(1); // the second replaced the first ...
    expect(s.countersThisTurn).toEqual({ p1: 2 }); // ... but both count
    s = applyAction(s, { type: 'cancelTrade', playerId: 'p0' });
    s = applyAction(s, { type: 'proposeTrade', playerId: 'p0', give: { sheep: 1 }, receive: { brick: 1 } });
    s = applyAction(s, { type: 'counterTrade', playerId: 'p1', give: { brick: 1 }, receive: { sheep: 2 } });
    expect(s.countersThisTurn).toEqual({ p1: 3 }); // across the turn's offers
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.countersThisTurn).toBeUndefined();
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
