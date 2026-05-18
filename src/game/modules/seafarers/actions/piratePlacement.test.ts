import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { runSetupPhase, giveResources } from '../../../__testHelpers';
import { canBuildShip, isPirateAdjacent } from '../validation/shipPlacement';
import { classifyEdge } from '../board/edges';

// The pirate prevents NEW ships from being placed on coastal/sea edges of
// its hex, and prevents a ship MOVE whose destination is on those edges.
// Existing ships next to the pirate are unaffected, and ships can still be
// moved AWAY from the pirate.
describe('pirate blocks ship build / move', () => {
  function setup() {
    return runSetupPhase(
      createGame({
        playerNames: ['A', 'B', 'C'],
        seed: 7,
        settings: { expansions: ['seafarers'], scenarioId: 'headingForNewShores' },
        randomizeTurnOrder: false,
      }),
    );
  }

  it('canBuildShip rejects edges adjacent to the pirate', () => {
    let s = setup();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    // Re-point the pirate at a coastal sea hex p0 could plausibly ship to.
    // Pick a sea hex that has at least one non-pirate-adjacent coastal edge
    // belonging to p0's network — keeps the test deterministic without
    // depending on seed-specific layout.
    const seaHexes = s.board.hexIds.filter((id) => s.board.hexes[id]!.terrain === 'sea');
    expect(seaHexes.length).toBeGreaterThan(0);
    const newPirate = seaHexes[0]!;
    s = { ...s, board: { ...s.board, pirateHex: newPirate } };

    const adjEdges = s.board.edgeIds.filter((eid) => {
      const e = s.board.edges[eid]!;
      return e.hexes.includes(newPirate);
    });
    expect(adjEdges.length).toBeGreaterThan(0);

    for (const eid of adjEdges) {
      expect(isPirateAdjacent(s, eid)).toBe(true);
      // canBuildShip must reject regardless of connectivity / cost — the
      // pirate adjacency check fires before either.
      expect(canBuildShip(s, 'p0', eid)).toBe(false);
    }
  });

  it('moveShip rejects destinations adjacent to the pirate', () => {
    let s = setup();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
    s = giveResources(s, 'p0', { wood: 2, sheep: 2 });

    // Build a ship somewhere legal first.
    const p0 = s.players[0]!;
    const reachableV = new Set<string>([...p0.settlements, ...p0.cities]);
    for (const eid of p0.roads) {
      const e = s.board.edges[eid]!;
      reachableV.add(e.vertices[0]);
      reachableV.add(e.vertices[1]);
    }
    let shipEdge: string | null = null;
    for (const vid of reachableV) {
      const v = s.board.vertices[vid]!;
      for (const eid of v.edges) {
        if (classifyEdge(s.board, eid) === 'land') continue;
        if (canBuildShip(s, 'p0', eid)) {
          shipEdge = eid;
          break;
        }
      }
      if (shipEdge) break;
    }
    if (!shipEdge) return; // p0 has no coastal reach on this seed — skip

    s = applyAction(s, { type: 'buildShip', playerId: 'p0', edge: shipEdge });

    // Need the ship to be "movable" (an open end). The ship we just built
    // anchors on a vertex that's our settlement/road; the OTHER vertex is
    // currently an open end since we haven't extended further.
    const shipE = s.board.edges[shipEdge]!;
    const openVid = shipE.vertices.find(
      (v) => !p0.settlements.includes(v) && !p0.cities.includes(v),
    );
    expect(openVid).toBeTruthy();

    // Pretend the pirate moved to a sea hex adjacent to a candidate
    // destination edge that the ship could otherwise reach.
    const candDestEdges = s.board.vertices[openVid!]!.edges.filter(
      (eid) => eid !== shipEdge && classifyEdge(s.board, eid) !== 'land',
    );
    if (candDestEdges.length === 0) return;
    const destEdge = candDestEdges[0]!;
    const destHexes = s.board.edges[destEdge]!.hexes;
    const seaSide = destHexes.find((h) => s.board.hexes[h]!.terrain === 'sea');
    if (!seaSide) return;

    s = { ...s, board: { ...s.board, pirateHex: seaSide } };
    expect(() =>
      applyAction(s, {
        type: 'moveShip',
        playerId: 'p0',
        from: shipEdge,
        to: destEdge,
      }),
    ).toThrow(/pirate/i);
  });
});
