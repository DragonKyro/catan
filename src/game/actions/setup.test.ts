import { describe, it, expect } from 'vitest';
import { createGame } from '../createGame';
import { applyAction } from '../engine';
import { findValidSettlementSpot, findValidRoadFromVertex, runSetupPhase } from '../__testHelpers';

function newGame(numPlayers = 3) {
  const names = ['A', 'B', 'C', 'D'].slice(0, numPlayers);
  return createGame({ playerNames: names, seed: 42, randomizeTurnOrder: false });
}

describe('setup phase', () => {
  it('starts in setupRound1 with player 0 placing a settlement', () => {
    const s = newGame();
    expect(s.phase).toBe('setupRound1');
    expect(s.currentPlayerIndex).toBe(0);
    expect(s.setupState?.step).toBe('settlement');
  });

  it('places settlement then road for the same player, then advances', () => {
    let s = newGame();
    const vertex = findValidSettlementSpot(s);
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex });
    expect(s.players[0]!.settlements).toContain(vertex);
    expect(s.setupState?.step).toBe('road');

    const edge = findValidRoadFromVertex(s, vertex);
    s = applyAction(s, { type: 'placeInitialRoad', playerId: 'p0', edge });
    expect(s.players[0]!.roads).toContain(edge);
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.setupState?.step).toBe('settlement');
  });

  it('rejects settlements that violate the distance rule', () => {
    let s = newGame();
    const vid = findValidSettlementSpot(s);
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: vid });
    const edge = findValidRoadFromVertex(s, vid);
    s = applyAction(s, { type: 'placeInitialRoad', playerId: 'p0', edge });

    // Try placing on a neighbor — should violate distance rule
    const neighbor = s.board.vertices[vid]!.neighborVertices[0]!;
    expect(() =>
      applyAction(s, { type: 'placeInitialSettlement', playerId: 'p1', vertex: neighbor }),
    ).toThrow(/distance/i);
  });

  it('rejects a road that does not touch the just-placed settlement', () => {
    let s = newGame();
    const vid = findValidSettlementSpot(s);
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: vid });
    // Pick an edge not on the placed vertex
    const ownEdges = new Set(s.board.vertices[vid]!.edges);
    const otherEdge = s.board.edgeIds.find((e) => !ownEdges.has(e))!;
    expect(() =>
      applyAction(s, { type: 'placeInitialRoad', playerId: 'p0', edge: otherEdge }),
    ).toThrow(/touch/i);
  });

  it('uses snake order: round 2 reverses', () => {
    let s = newGame(4);
    // Run round 1
    for (let i = 0; i < 4; i++) {
      const pid = `p${i}`;
      const v = findValidSettlementSpot(s);
      s = applyAction(s, { type: 'placeInitialSettlement', playerId: pid, vertex: v });
      const e = findValidRoadFromVertex(s, v);
      s = applyAction(s, { type: 'placeInitialRoad', playerId: pid, edge: e });
    }
    // Now in round 2 starting with p3
    expect(s.phase).toBe('setupRound2');
    expect(s.currentPlayerIndex).toBe(3);
  });

  it('grants resources for the second settlement in round 2', () => {
    let s = newGame(2);
    s = runSetupPhase(s);
    // After setup, players should have some resources (from round 2 settlement grants)
    // Each player placed 1 round-2 settlement adjacent to up to 3 non-desert hexes.
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.currentPlayerIndex).toBe(0);
    let totalResourcesAcrossPlayers = 0;
    for (const p of s.players) {
      for (const r of Object.values(p.resources)) totalResourcesAcrossPlayers += r;
    }
    expect(totalResourcesAcrossPlayers).toBeGreaterThan(0);
  });

  it('transitions from setup to rollOrPlayKnight phase, player 0 first', () => {
    const s = runSetupPhase(newGame(3));
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.currentPlayerIndex).toBe(0);
    expect(s.hasRolledThisTurn).toBe(false);
  });

  it('rejects an action by the wrong player', () => {
    let s = newGame();
    const vid = findValidSettlementSpot(s);
    expect(() =>
      applyAction(s, { type: 'placeInitialSettlement', playerId: 'p1', vertex: vid }),
    ).toThrow(/turn/i);
  });
});
