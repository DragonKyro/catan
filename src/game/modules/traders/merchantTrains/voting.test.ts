import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { runSetupPhase, giveResources } from '../../../__testHelpers';
import { applyAction } from '../../../engine';
import { canPlaceInitialSettlement, canPlaceSettlement } from '../../../placement';
import { calculateVictoryPoints } from '../../../scoring/points';
import { getActingPlayerId } from '../../../helpers';
import type { GameState, PlayerId } from '../../../types';
import { legalWagonPlacements } from './trains';

function newMerchantSession(): GameState {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 1,
      settings: { expansions: ['traders'], tradersScenarioId: 'merchantTrains' },
      randomizeTurnOrder: false,
    }),
  );
}

// p0 has rolled and built a building this turn; everyone holds 3 wool + 3 wheat.
function readyToVote(): GameState {
  let s = newMerchantSession();
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
  for (const id of ['p0', 'p1', 'p2']) s = giveResources(s, id, { sheep: 3, wheat: 3 });
  return { ...s, builtThisTurn: true };
}

function bid(s: GameState, playerId: PlayerId, sheep: number, wheat = 0): GameState {
  return applyAction(s, { type: 'submitWagonVote', playerId, cards: { sheep, wheat } });
}

function bankWoolWheat(s: GameState): number {
  return s.bank.sheep + s.bank.wheat;
}

// Give p0 a road to a free, legal spot and build a settlement there.
function buildSettlementForP0(s: GameState): GameState {
  for (const vid of s.board.vertexIds) {
    if (!canPlaceInitialSettlement(s, vid)) continue;
    const edge = s.board.vertices[vid]!.edges.find(
      (eid) => !s.players.some((p) => p.roads.includes(eid)),
    );
    if (!edge) continue;
    let t: GameState = {
      ...s,
      players: s.players.map((p) => (p.id === 'p0' ? { ...p, roads: [...p.roads, edge] } : p)),
    };
    if (!canPlaceSettlement(t, 'p0', vid)) continue;
    t = giveResources(t, 'p0', { wood: 1, brick: 1, sheep: 1, wheat: 1 });
    return applyAction(t, { type: 'buildSettlement', playerId: 'p0', vertex: vid });
  }
  throw new Error('no settlement spot found');
}

describe('Merchant Trains: acquiring a wagon', () => {
  it('roads alone earn no wagon: the turn just ends', () => {
    let s = newMerchantSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = giveResources(s, 'p0', { wood: 1, brick: 1 });
    const home = s.players[0]!.settlements[0]!;
    const edge = s.board.vertices[home]!.edges.find(
      (eid) => !s.players.some((p) => p.roads.includes(eid)),
    )!;
    s = applyAction(s, { type: 'buildRoad', playerId: 'p0', edge });
    expect(s.builtThisTurn).toBeFalsy();
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.wagons).toEqual([]);
  });

  it('a settlement earns the wagon and ending the turn opens the vote', () => {
    let s = newMerchantSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = buildSettlementForP0(s);
    expect(s.builtThisTurn).toBe(true);
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.phase).toBe('wagonVoting');
    expect(s.wagonVote).toMatchObject({
      acquirerId: 'p0',
      order: ['p0', 'p1', 'p2'],
      stage: 'bid',
      turn: 0,
    });
  });

  it('a city earns the wagon too', () => {
    let s = newMerchantSession();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = giveResources(s, 'p0', { wheat: 2, ore: 3 });
    s = applyAction(s, {
      type: 'buildCity',
      playerId: 'p0',
      vertex: s.players[0]!.settlements[0]!,
    });
    expect(s.builtThisTurn).toBe(true);
  });

  it('with only one place the wagon could go, it is placed without a vote', () => {
    let s = readyToVote();
    const only = s.wagonStarts![2]!;
    s = { ...s, wagonStarts: [only] };
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.wagons).toEqual([{ edge: only.edge, front: only.head, train: 1 }]);
    expect(s.lastWagonVote?.decidedBy).toBe('onlyOption');
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.builtThisTurn).toBe(false);
  });
});

describe('Merchant Trains: voting round', () => {
  it('bids go round from the active player clockwise, face up', () => {
    let s = applyAction(readyToVote(), { type: 'endTurn', playerId: 'p0' });
    expect(getActingPlayerId(s)).toBe('p0');
    expect(() => bid(s, 'p1', 1)).toThrow(/not your turn/);
    s = bid(s, 'p0', 1);
    expect(s.players[0]!.resources.sheep).toBe(2);
    expect(s.wagonVote!.bids.p0).toEqual({ sheep: 1, wheat: 0 });
    expect(getActingPlayerId(s)).toBe('p1');
  });

  it('only wool and wheat may be bid, and only cards you hold', () => {
    const s = applyAction(readyToVote(), { type: 'endTurn', playerId: 'p0' });
    expect(() =>
      applyAction(s, { type: 'submitWagonVote', playerId: 'p0', cards: { ore: 1 } }),
    ).toThrow(/wool and wheat/);
    expect(() => bid(s, 'p0', 9)).toThrow(/do not have/);
  });

  it('a player with the majority of votes chooses; bids go to the supply', () => {
    let s = applyAction(readyToVote(), { type: 'endTurn', playerId: 'p0' });
    const bank = bankWoolWheat(s);
    s = bid(s, 'p0', 0);
    s = bid(s, 'p1', 1, 1);
    s = bid(s, 'p2', 1);
    expect(s.phase).toBe('placeWagon');
    expect(s.pendingWagonPlacement).toEqual({ placerId: 'p1', reason: 'majority' });
    expect(getActingPlayerId(s)).toBe('p1');
    const spot = legalWagonPlacements(s)[1]!;
    expect(() =>
      applyAction(s, { type: 'placeWagon', playerId: 'p0', edge: spot.edge }),
    ).toThrow(/not the one/);
    s = applyAction(s, {
      type: 'placeWagon',
      playerId: 'p1',
      edge: spot.edge,
      train: spot.train,
    });
    expect(s.wagons!.map((w) => w.edge)).toEqual([spot.edge]);
    expect(bankWoolWheat(s)).toBe(bank + 3);
    expect(s.lastWagonVote).toMatchObject({ decidedBy: 'majority', chooser: 'p1' });
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.phase).toBe('rollOrPlayKnight');
  });

  it('nobody bidding leaves the choice to the active player', () => {
    let s = applyAction(readyToVote(), { type: 'endTurn', playerId: 'p0' });
    s = bid(bid(bid(s, 'p0', 0), 'p1', 0), 'p2', 0);
    expect(s.pendingWagonPlacement).toEqual({ placerId: 'p0', reason: 'noVotes' });
  });

  it('without a majority, a location with the most votes gets the wagon', () => {
    let s = applyAction(readyToVote(), { type: 'endTurn', playerId: 'p0' });
    s = bid(bid(bid(s, 'p0', 2), 'p1', 2), 'p2', 1);
    expect(s.wagonVote!.stage).toBe('assign');
    expect(getActingPlayerId(s)).toBe('p0');
    const [a, b] = legalWagonPlacements(s);
    s = applyAction(s, { type: 'assignWagonVotes', playerId: 'p0', location: a! });
    s = applyAction(s, { type: 'assignWagonVotes', playerId: 'p1', location: b! });
    s = applyAction(s, { type: 'assignWagonVotes', playerId: 'p2', location: b! });
    // b: 3 votes beats a: 2 — placed straight away, turn over.
    expect(s.wagons!.map((w) => w.edge)).toEqual([b!.edge]);
    expect(s.lastWagonVote?.decidedBy).toBe('location');
    expect(s.currentPlayerIndex).toBe(1);
  });

  it('tied locations: the player with the most votes chooses', () => {
    let s = applyAction(readyToVote(), { type: 'endTurn', playerId: 'p0' });
    s = bid(bid(bid(s, 'p0', 2), 'p1', 1), 'p2', 1);
    const [a, b] = legalWagonPlacements(s);
    s = applyAction(s, { type: 'assignWagonVotes', playerId: 'p0', location: a! });
    s = applyAction(s, { type: 'assignWagonVotes', playerId: 'p1', location: b! });
    s = applyAction(s, { type: 'assignWagonVotes', playerId: 'p2', location: b! });
    expect(s.pendingWagonPlacement).toEqual({ placerId: 'p0', reason: 'mostVotes' });
  });

  it('tied locations and tied bidders: the active player chooses, even without a bid', () => {
    let s = applyAction(readyToVote(), { type: 'endTurn', playerId: 'p0' });
    s = bid(bid(bid(s, 'p0', 0), 'p1', 1), 'p2', 1);
    expect(s.wagonVote!.stage).toBe('assign');
    // Only bidders assign: p1 then p2.
    expect(getActingPlayerId(s)).toBe('p1');
    const [a, b] = legalWagonPlacements(s);
    s = applyAction(s, { type: 'assignWagonVotes', playerId: 'p1', location: a! });
    s = applyAction(s, { type: 'assignWagonVotes', playerId: 'p2', location: b! });
    expect(s.pendingWagonPlacement).toEqual({ placerId: 'p0', reason: 'activePlayer' });
  });

  it('a vote can only name a legal location', () => {
    let s = applyAction(readyToVote(), { type: 'endTurn', playerId: 'p0' });
    s = bid(bid(bid(s, 'p0', 1), 'p1', 1), 'p2', 0);
    const side = Object.values(s.board.edges).find((e) => e.hexes.includes('0,0'))!;
    expect(() =>
      applyAction(s, {
        type: 'assignWagonVotes',
        playerId: 'p0',
        location: { edge: side.id, train: null },
      }),
    ).toThrow(/cannot go there/);
  });

  it('the active player can win when the wagon lands in their own turn', () => {
    let s = applyAction(readyToVote(), { type: 'endTurn', playerId: 'p0' });
    s = bid(bid(bid(s, 'p0', 0), 'p1', 0), 'p2', 0);
    // Lower the target to p0's current total: the end of the turn is still their turn.
    s = {
      ...s,
      settings: { ...s.settings, victoryPointsToWin: calculateVictoryPoints(s, 'p0', true) },
    };
    const spot = legalWagonPlacements(s)[0]!;
    s = applyAction(s, { type: 'placeWagon', playerId: 'p0', edge: spot.edge });
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe('p0');
  });
});
