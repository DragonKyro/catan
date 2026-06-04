import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { runSetupPhase, giveResources } from '../../../__testHelpers';

function setupRiversGame() {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 42,
      settings: {
        expansions: ['traders'],
        tradersScenarioId: 'riversOfCatan',
      },
      randomizeTurnOrder: false,
    }),
  );
}

describe('buildBridge', () => {
  it('refuses to build on non-river edges', () => {
    let s = setupRiversGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = giveResources(s, 'p0', { wood: 5, brick: 5 });
    // Pick a non-river edge belonging to no one.
    const nonRiver = Object.values(s.board.edges).find(
      (e) =>
        !s.riverEdges?.includes(e.id) &&
        !s.players.some((p) => p.roads.includes(e.id)),
    )!;
    expect(() =>
      applyAction(s, { type: 'buildBridge', playerId: 'p0', edge: nonRiver.id }),
    ).toThrow(/river edges/);
  });

  it('refuses placement when not connected to the network', () => {
    let s = setupRiversGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = giveResources(s, 'p0', { wood: 5, brick: 5 });
    // Pick any river edge not touching p0's existing pieces.
    const player = s.players[0]!;
    const reachableVerts = new Set<string>();
    for (const eid of player.roads) {
      const e = s.board.edges[eid]!;
      reachableVerts.add(e.vertices[0]);
      reachableVerts.add(e.vertices[1]);
    }
    for (const v of player.settlements) reachableVerts.add(v);
    const disconnected = (s.riverEdges ?? [])
      .map((id) => s.board.edges[id]!)
      .find(
        (e) =>
          !reachableVerts.has(e.vertices[0]) &&
          !reachableVerts.has(e.vertices[1]),
      );
    if (!disconnected) return; // seed lucked into all-connected; skip
    expect(() =>
      applyAction(s, {
        type: 'buildBridge',
        playerId: 'p0',
        edge: disconnected.id,
      }),
    ).toThrow(/Invalid bridge placement/);
  });

  it('refuses to build a road on a river edge', () => {
    let s = setupRiversGame();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 5] });
    s = giveResources(s, 'p0', { wood: 5, brick: 5 });
    const riverEdge = (s.riverEdges ?? [])[0]!;
    expect(() =>
      applyAction(s, {
        type: 'buildRoad',
        playerId: 'p0',
        edge: riverEdge,
      }),
    ).toThrow(/Invalid road placement/);
  });
});
