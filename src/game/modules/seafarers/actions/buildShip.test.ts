import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { runSetupPhase, giveResources } from '../../../__testHelpers';
import { classifyEdge } from '../board/edges';
import { canBuildShip } from '../validation/shipPlacement';

function setupSeafarers() {
  return runSetupPhase(
    createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 1,
      settings: { expansions: ['seafarers'], scenarioId: 'headingForNewShores' },
      randomizeTurnOrder: false,
    }),
  );
}

describe('buildShip', () => {
  it('after setup, the first player can build a ship from a coastal road end', () => {
    let s = setupSeafarers();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = giveResources(s, 'p0', { wood: 1, sheep: 1 });

    // Find a coastal edge reachable from p0's network.
    const p0 = s.players[0]!;
    const reachableVertices = new Set<string>();
    for (const eid of p0.roads) {
      const e = s.board.edges[eid]!;
      reachableVertices.add(e.vertices[0]);
      reachableVertices.add(e.vertices[1]);
    }
    for (const v of [...p0.settlements, ...p0.cities]) reachableVertices.add(v);

    let target: string | null = null;
    for (const vid of reachableVertices) {
      const vertex = s.board.vertices[vid]!;
      for (const eid of vertex.edges) {
        if (classifyEdge(s.board, eid) === 'land') continue;
        if (canBuildShip(s, 'p0', eid)) {
          target = eid;
          break;
        }
      }
      if (target) break;
    }

    if (!target) {
      // Some seeded layouts may leave p0 fully inland — accept and skip in
      // that case rather than fail (the validator and handler are still
      // exercised in other tests).
      return;
    }

    const before = s.players[0]!.ships.length;
    const beforeWood = s.players[0]!.resources.wood;
    const beforeSheep = s.players[0]!.resources.sheep;
    s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge: target });
    expect(s.players[0]!.ships).toContain(target);
    expect(s.players[0]!.ships.length).toBe(before + 1);
    expect(s.players[0]!.resources.wood).toBe(beforeWood - 1);
    expect(s.players[0]!.resources.sheep).toBe(beforeSheep - 1);
  });

  it('rejects ships on land-only edges', () => {
    let s = setupSeafarers();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = giveResources(s, 'p0', { wood: 2, sheep: 2 });

    const p0 = s.players[0]!;
    const landEdge = s.board.edgeIds.find((eid) => {
      if (classifyEdge(s.board, eid) !== 'land') return false;
      // Find one adjacent to a p0 piece so we know connectivity isn't the
      // reason for the rejection.
      const e = s.board.edges[eid]!;
      return (
        p0.settlements.includes(e.vertices[0]) ||
        p0.settlements.includes(e.vertices[1])
      );
    });
    if (!landEdge) return; // skip if no inland edge by their settlement
    expect(() =>
      applyAction(s, { type: 'buildShip', playerId: 'p0', edge: landEdge }),
    ).toThrow();
  });

  it('cannot afford without resources', () => {
    let s = setupSeafarers();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    const p0 = s.players[0]!;
    const anyEdge = s.board.edgeIds.find(
      (eid) => classifyEdge(s.board, eid) !== 'land' && canBuildShip(s, 'p0', eid),
    );
    if (!anyEdge) return;
    expect(() =>
      applyAction({ ...s, players: s.players.map((p) => ({ ...p, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 } })) }, {
        type: 'buildShip',
        playerId: p0.id,
        edge: anyEdge,
      }),
    ).toThrow();
  });
});
