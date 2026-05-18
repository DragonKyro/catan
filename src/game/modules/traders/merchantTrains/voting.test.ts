import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { runSetupPhase, giveResources } from '../../../__testHelpers';
import { applyAction } from '../../../engine';
import type { GameState } from '../../../types';

function newMerchantSession(): GameState {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 1,
      settings: {
        expansions: ['traders'],
        tradersScenarioId: 'merchantTrains',
      },
      randomizeTurnOrder: false,
    }),
  );
}

function aWateringHoleEdge(state: GameState): string {
  const hex = state.board.hexes[state.wateringHoleHexId!]!;
  for (const eid of Object.keys(state.board.edges)) {
    const e = state.board.edges[eid]!;
    if (e.hexes.includes(hex.id)) return eid;
  }
  throw new Error('No edge on watering hole');
}

describe('Merchant Trains end-of-turn voting', () => {
  it('endTurn with no build skips voting and advances normally', () => {
    let s = newMerchantSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).not.toBe('wagonVoting');
    expect(s.builtThisTurn).toBeFalsy();
  });

  it('endTurn after a build opens wagonVoting', () => {
    let s = newMerchantSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = giveResources(s, 'p0', { wood: 1, brick: 1 });
    // Build a road to flag builtThisTurn. Find any legal road edge.
    const p0 = s.players[0]!;
    const candVid = p0.settlements[0]!;
    const v = s.board.vertices[candVid]!;
    const targetEdge = v.edges.find(
      (eid) => !s.players.some((p) => p.roads.includes(eid)),
    );
    if (!targetEdge) return;
    s = applyAction(s, {
      type: 'buildRoad',
      playerId: 'p0',
      edge: targetEdge,
    });
    expect(s.builtThisTurn).toBe(true);
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('wagonVoting');
    expect(s.wagonVote?.acquirerId).toBe('p0');
  });

  it('all abstain → active player places by fallback', () => {
    let s = newMerchantSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = giveResources(s, 'p0', { wood: 1, brick: 1 });
    const p0 = s.players[0]!;
    const candVid = p0.settlements[0]!;
    const v = s.board.vertices[candVid]!;
    const targetEdge = v.edges.find(
      (eid) => !s.players.some((p) => p.roads.includes(eid)),
    );
    if (!targetEdge) return;
    s = applyAction(s, {
      type: 'buildRoad',
      playerId: 'p0',
      edge: targetEdge,
    });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    // All three players abstain.
    for (const pid of ['p0', 'p1', 'p2']) {
      s = applyAction(s, {
        type: 'submitWagonVote',
        playerId: pid,
        cards: {},
        target: null,
      });
    }
    // After 3 abstain bids, falls to active player (p0) to place.
    expect(s.phase).toBe('placeWagon');
    expect(s.pendingWagonPlacement?.placerId).toBe('p0');
    const e = aWateringHoleEdge(s);
    s = applyAction(s, { type: 'placeWagon', playerId: 'p0', edge: e });
    expect(s.wagons?.length).toBe(1);
    expect(s.wagons?.[0]?.edge).toBe(e);
    expect(s.wagonSupply).toBe(21);
    // Turn advanced to p1.
    expect(s.playerOrder[s.currentPlayerIndex]).toBe('p1');
  });

  it('unique-location winner auto-places the wagon', () => {
    let s = newMerchantSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = giveResources(s, 'p0', { wood: 1, brick: 1 });
    const p0 = s.players[0]!;
    const candVid = p0.settlements[0]!;
    const v = s.board.vertices[candVid]!;
    const targetEdge = v.edges.find(
      (eid) => !s.players.some((p) => p.roads.includes(eid)),
    );
    if (!targetEdge) return;
    s = applyAction(s, {
      type: 'buildRoad',
      playerId: 'p0',
      edge: targetEdge,
    });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    // p1 bids 2 sheep on a specific watering-hole edge — uncontested.
    s = giveResources(s, 'p1', { sheep: 2 });
    const p1SheepBefore = s.players.find((p) => p.id === 'p1')!.resources.sheep;
    const wagonTarget = aWateringHoleEdge(s);
    s = applyAction(s, {
      type: 'submitWagonVote',
      playerId: 'p1',
      cards: { sheep: 2 },
      target: wagonTarget,
    });
    s = applyAction(s, {
      type: 'submitWagonVote',
      playerId: 'p0',
      cards: {},
      target: null,
    });
    s = applyAction(s, {
      type: 'submitWagonVote',
      playerId: 'p2',
      cards: {},
      target: null,
    });
    // Wagon placed by location winner immediately, turn advanced.
    expect(s.wagons?.length).toBe(1);
    expect(s.wagons?.[0]?.edge).toBe(wagonTarget);
    expect(s.phase).not.toBe('wagonVoting');
    expect(s.phase).not.toBe('placeWagon');
    // p1 spent 2 sheep total (bid deducted from hand, refunded to bank
    // — NOT back to p1's hand, per the rulebook "Return all bids to the
    // supply").
    expect(s.players.find((p) => p.id === 'p1')!.resources.sheep).toBe(
      p1SheepBefore - 2,
    );
  });

  it('rejects votes spending non-wool/wheat resources', () => {
    let s = newMerchantSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = giveResources(s, 'p0', { wood: 1, brick: 1, ore: 1 });
    const p0 = s.players[0]!;
    const candVid = p0.settlements[0]!;
    const targetEdge = s.board.vertices[candVid]!.edges.find(
      (eid) => !s.players.some((p) => p.roads.includes(eid)),
    );
    if (!targetEdge) return;
    s = applyAction(s, {
      type: 'buildRoad',
      playerId: 'p0',
      edge: targetEdge,
    });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    const wagonTarget = aWateringHoleEdge(s);
    expect(() =>
      applyAction(s, {
        type: 'submitWagonVote',
        playerId: 'p0',
        cards: { ore: 1 },
        target: wagonTarget,
      }),
    ).toThrow(/wool or wheat/);
  });
});
