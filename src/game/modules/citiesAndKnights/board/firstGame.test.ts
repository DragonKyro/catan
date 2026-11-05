import { describe, expect, it } from 'vitest';
import { createGame } from '../../../createGame';
import { buildGraphFromCoords } from '../../../board/graph';
import { resolvePorts } from '../../../board/scenarioAssembly';
import { hexagonalDisk } from '../../base/scenarios/helpers';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '../constants';
import { CK_FIRST_GAME_PORTS } from './firstGame';

const EDGE_ANGLE = [0, 60, 120, 180, 240, 300];

function game(seed = 1) {
  return createGame({
    playerNames: ['A', 'B', 'C', 'D'],
    seed,
    settings: { expansions: [CITIES_AND_KNIGHTS_EXPANSION_ID], baseScenarioId: 'ckFirstGame' },
  });
}

describe('C&K first-game board (rulebook p.4)', () => {
  it('places every hex and disc as printed, the same for every seed', () => {
    const expected: Record<string, [string, number | null]> = {
      '0,-2': ['brick', 6], '1,-2': ['ore', 2], '2,-2': ['brick', 5],
      '-1,-1': ['wood', 3], '0,-1': ['ore', 9], '1,-1': ['desert', null], '2,-1': ['wood', 10],
      '-2,0': ['wood', 8], '-1,0': ['wheat', 4], '0,0': ['brick', 11], '1,0': ['sheep', 3], '2,0': ['wheat', 8],
      '-2,1': ['sheep', 10], '-1,1': ['wheat', 5], '0,1': ['ore', 6], '1,1': ['sheep', 4],
      '-2,2': ['wheat', 9], '-1,2': ['sheep', 12], '0,2': ['wood', 11],
    };
    for (const seed of [1, 2, 3]) {
      const b = game(seed).board;
      for (const [id, [terrain, token]] of Object.entries(expected)) {
        expect(b.hexes[id]!.terrain).toBe(terrain);
        expect(b.hexes[id]!.numberToken ?? null).toBe(token);
      }
      expect(b.robberHex).toBe('1,-1');
      expect(b.ports.map((p) => p.type).sort()).toEqual(
        ['brick', 'generic', 'generic', 'generic', 'generic', 'ore', 'sheep', 'wheat', 'wood'],
      );
    }
  });

  it('puts each harbor on the intended coastal edge of its land hex', () => {
    const graph = buildGraphFromCoords(hexagonalDisk(3));
    const ports = resolvePorts(
      CK_FIRST_GAME_PORTS.map((a) => ({ q: a.q, r: a.r, direction: a.direction, type: a.fixedType! })),
      graph,
    );
    expect(ports).toHaveLength(9);
    CK_FIRST_GAME_PORTS.forEach((a, i) => {
      const edge = graph.edges[ports[i]!.edge]!;
      const [p1, p2] = edge.vertices.map((v) => graph.vertices[v]!.position);
      const corners = graph.hexCorners.get(`${a.q},${a.r}`)!.map((v) => graph.vertices[v]!.position);
      const cx = corners.reduce((s, p) => s + p.x, 0) / 6;
      const cy = corners.reduce((s, p) => s + p.y, 0) / 6;
      const angle = ((Math.atan2((p1!.y + p2!.y) / 2 - cy, (p1!.x + p2!.x) / 2 - cx) * 180) / Math.PI + 360) % 360;
      expect(Math.abs(angle - EDGE_ANGLE[a.direction]!)).toBeLessThan(1);
      expect(Math.max(Math.abs(a.q), Math.abs(a.r), Math.abs(a.q + a.r))).toBe(2);
    });
  });

  it('is only offered with C&K; Gold Rush and Volcano are refused with C&K', () => {
    expect(() =>
      createGame({ playerNames: ['A', 'B', 'C'], seed: 1, settings: { baseScenarioId: 'ckFirstGame' } }),
    ).toThrow(/can't be played/);
    for (const id of ['goldRush', 'volcano']) {
      expect(() =>
        createGame({
          playerNames: ['A', 'B', 'C'],
          seed: 1,
          settings: { expansions: [CITIES_AND_KNIGHTS_EXPANSION_ID], baseScenarioId: id },
        }),
      ).toThrow(/can't be played/);
    }
  });
});
