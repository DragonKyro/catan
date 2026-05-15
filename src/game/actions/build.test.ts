import { describe, it, expect } from 'vitest';
import { createGame } from '../createGame';
import { applyAction } from '../engine';
import { runSetupPhase, giveResources } from '../__testHelpers';

function setupGame() {
  return runSetupPhase(createGame({ playerNames: ['A', 'B'], seed: 42, randomizeTurnOrder: false }));
}

function reachMainPhase() {
  let s = setupGame();
  // Roll non-7
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
  expect(s.phase).toBe('main');
  return s;
}

describe('build actions', () => {
  it('builds a road if affordable and connected', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wood: 1, brick: 1 });
    const lastRoad = s.players[0]!.roads[0]!;
    const edge = s.board.edges[lastRoad]!;
    const vertexAtRoad = edge.vertices[0];
    // Pick a connected free edge (not the one we just looked up)
    const candidate = s.board.vertices[vertexAtRoad]!.edges.find(
      (e) => e !== lastRoad,
    )!;
    const before = s.players[0]!.resources;
    s = applyAction(s, { type: 'buildRoad', playerId: 'p0', edge: candidate });
    expect(s.players[0]!.roads).toContain(candidate);
    expect(s.players[0]!.resources.wood).toBe(before.wood - 1);
    expect(s.players[0]!.resources.brick).toBe(before.brick - 1);
  });

  it('rejects a road the player cannot afford', () => {
    const s = reachMainPhase();
    // p0 may or may not have resources; force them to zero
    const stripped = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 } } : p,
      ),
    };
    const someEdge = stripped.board.edgeIds[0]!;
    expect(() =>
      applyAction(stripped, { type: 'buildRoad', playerId: 'p0', edge: someEdge }),
    ).toThrow(/afford|placement/i);
  });

  it('upgrades a settlement to a city', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wheat: 2, ore: 3 });
    const settlement = s.players[0]!.settlements[0]!;
    s = applyAction(s, { type: 'buildCity', playerId: 'p0', vertex: settlement });
    expect(s.players[0]!.settlements).not.toContain(settlement);
    expect(s.players[0]!.cities).toContain(settlement);
  });

  it('rejects building a city on a non-settlement vertex', () => {
    let s = reachMainPhase();
    s = giveResources(s, 'p0', { wheat: 2, ore: 3 });
    const v = s.board.vertexIds.find((vid) => !s.players[0]!.settlements.includes(vid))!;
    expect(() =>
      applyAction(s, { type: 'buildCity', playerId: 'p0', vertex: v }),
    ).toThrow(/your own settlement/i);
  });
});
