import { describe, expect, it } from 'vitest';
import { createGame } from '../../../../createGame';
import type { EdgeId, GameState, HexId, Terrain } from '../../../../types';
import { hexNumbers } from '../../../../board/hexNumbers';
import { buildGraphFromCoords } from '../../../../board/graph';
import { resolvePorts } from '../../../../board/scenarioAssembly';
import { hexagonalDisk } from '../../../base/scenarios/helpers';
import { TB_FRAME_PORTS_5_6 } from '../frame';
import { TB_DISCS_5_6, TB_OUTER_RING_5_6, isInner5_6 } from './board5_6';
import { lakeHexes } from '../../fishing/lakes';
import { wateringHoles } from '../../merchantTrains/trains';
import { castleHexes } from '../../barbarianAttack/state';
import { castleEdgeIds, isCastleEdge } from '../../barbarianAttack/knights';
import { resolveBarbarianLanding } from '../../barbarianAttack/landing';
import type { BarbarianAttackGame } from '../../barbarianAttack/state';

// Traders & Barbarians 5-6 boards (2025 T&B 5-6 rulebook pp. 5-9), checked
// against TB56-MAP-SPEC: every fixed hex, bridge site, fishing ground,
// train start and harbor is pinned by the hexes it touches, not by enum
// values.

function game(id: string, players = 5, seed = 1): GameState {
  return createGame({
    playerNames: Array.from({ length: players }, (_, i) => `P${i}`),
    seed,
    settings: { expansions: ['traders'], tradersScenarioId: id },
    randomizeTurnOrder: false,
  });
}

// The hexes an edge touches, as a sorted "a|b" key.
function edgeHexes(s: GameState, e: EdgeId): string {
  return [...s.board.edges[e]!.hexes].sort().join('|');
}
const pair = (a: string, b: string) => [a, b].sort().join('|');

function land(s: GameState): HexId[] {
  return s.board.hexIds.filter((h) => s.board.hexes[h]!.terrain !== 'sea');
}

function terrainCounts(s: GameState, hexes: HexId[]): Partial<Record<Terrain, number>> {
  const out: Partial<Record<Terrain, number>> = {};
  for (const h of hexes) {
    const t = s.board.hexes[h]!.terrain;
    out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}

function discs(s: GameState): number[] {
  return land(s)
    .filter((h) => s.board.hexes[h]!.terrain !== 'lake')
    .flatMap((h) => hexNumbers(s.board.hexes[h]!))
    .sort((a, b) => a - b);
}

const SORTED_DISCS = [...TB_DISCS_5_6].sort((a, b) => a - b);

// Harbor: land hex, the sea hex across its edge, printed type.
const HARBORS_5_6: Array<[string, string, string]> = [
  ['1,-3', '1,-4', 'ore'],
  ['2,-3', '3,-4', 'generic'],
  ['2,-2', '3,-2', 'sheep'],
  ['1,1', '2,1', 'generic'],
  ['-1,3', '0,3', 'sheep'],
  ['-2,3', '-2,4', 'wood'],
  ['-3,3', '-4,4', 'generic'],
  ['-3,2', '-4,2', 'brick'],
  ['-3,0', '-4,0', 'generic'],
  ['-2,-1', '-2,-2', 'wheat'],
  ['0,-3', '-1,-3', 'generic'],
];

describe('T&B 5-6 frame harbors', () => {
  it('resolves the eleven printed harbors to the rulebook edges', () => {
    const graph = buildGraphFromCoords(hexagonalDisk(4));
    const ports = resolvePorts(
      TB_FRAME_PORTS_5_6.map((a) => ({ q: a.q, r: a.r, direction: a.direction, type: a.fixedType! })),
      graph,
    );
    expect(ports).toHaveLength(11);
    expect(new Set(ports.map((p) => p.edge)).size).toBe(11);
  });

  for (const id of ['riversOfCatan', 'fishingOnCatan', 'merchantTrains', 'barbarianAttack']) {
    it(`${id}: every harbor sits between its land hex and the sea, with its printed type`, () => {
      const s = game(id);
      const got = s.board.ports.map((p) => `${edgeHexes(s, p.edge)}:${p.type}`).sort();
      const want = HARBORS_5_6.map(([a, b, t]) => `${pair(a, b)}:${t}`).sort();
      expect(got).toEqual(want);
    });
  }
});

describe('Rivers of Catan 5-6', () => {
  it('places the three river tiles, ten bridge sites and the robber on the swamp', () => {
    for (const seed of [1, 2, 3]) {
      const s = game('riversOfCatan', 5, seed);
      const t = (h: string) => s.board.hexes[h]!.terrain;
      expect([t('-2,0'), t('-2,1'), t('-2,2'), t('-2,3')]).toEqual(['ore', 'brick', 'sheep', 'swamp']);
      expect([t('-1,-1'), t('0,-2'), t('1,-3')]).toEqual(['ore', 'brick', 'swamp']);
      expect([t('0,0'), t('1,0'), t('2,0')]).toEqual(['ore', 'sheep', 'sheep']);
      expect(s.rivers!.map((r) => r.hexes)).toEqual([
        ['-2,0', '-2,1', '-2,2', '-2,3'],
        ['-1,-1', '0,-2', '1,-3'],
        ['0,0', '1,0', '2,0'],
      ]);
      expect(s.riverEdges!.map((e) => edgeHexes(s, e)).sort()).toEqual(
        [
          pair('-2,0', '-2,1'),
          pair('-2,1', '-2,2'),
          pair('-2,2', '-2,3'),
          pair('-2,3', '-3,4'), // swamp's SW edge, into the sea
          pair('-1,-1', '0,-2'),
          pair('0,-2', '1,-3'),
          pair('1,-3', '1,-4'), // swamp's NW edge (the 2:1 ore harbor's edge)
          pair('0,0', '1,0'),
          pair('1,0', '2,0'),
          pair('2,0', '3,-1'), // (2,0)'s NE edge
        ].sort(),
      );
      expect(s.board.robberHex).toBe('-2,3');
      // Totals with the rivers: wood 6, wheat 6, sheep 6, brick 5, ore 5, swamp 2.
      expect(terrainCounts(s, land(s))).toEqual({ wood: 6, wheat: 6, sheep: 6, brick: 5, ore: 5, swamp: 2 });
      // All 28 CATAN 5-6 discs, one per non-swamp hex: no 2-on-12 stacking.
      expect(land(s).some((h) => (s.board.hexes[h]!.extraNumbers?.length ?? 0) > 0)).toBe(false);
      expect(discs(s)).toEqual(SORTED_DISCS);
      expect(s.wealthTiles?.poor).toHaveLength(5);
    }
  });
});

describe('Fishing on Catan 5-6', () => {
  it('puts both lakes in the inner area with their own printed numbers', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = game('fishingOnCatan', 6, seed);
      const lakes = lakeHexes(s);
      expect(lakes).toHaveLength(2);
      for (const h of lakes) {
        const { q, r } = s.board.hexes[h]!.coord;
        expect(isInner5_6(q, r)).toBe(true);
      }
      expect(lakes.map((h) => hexNumbers(s.board.hexes[h]!).sort((a, b) => a - b)).sort()).toEqual(
        [
          [2, 3, 11, 12],
          [4, 10],
        ].sort(),
      );
      expect(terrainCounts(s, land(s))).toEqual({ wood: 6, sheep: 6, wheat: 6, brick: 5, ore: 5, lake: 2 });
      expect(discs(s)).toEqual(SORTED_DISCS);
    }
  });

  it('fills the eight harbor-free notches with fishing grounds 4, 5, 5, 6, 8, 9, 9, 10', () => {
    const s = game('fishingOnCatan');
    // Notch sea hex → the two land hexes whose coastal edges it fills.
    const notches: Array<[string, string, string]> = [
      ['2,-4', '1,-3', '2,-3'],
      ['3,-3', '2,-3', '2,-2'],
      ['3,-1', '2,-1', '2,0'],
      ['1,2', '1,1', '0,2'],
      ['-3,4', '-3,3', '-2,3'],
      ['-4,3', '-3,2', '-3,3'],
      ['-4,1', '-3,0', '-3,1'],
      ['-3,-1', '-2,-1', '-3,0'],
    ];
    const grounds = s.fishingGrounds!;
    expect(grounds).toHaveLength(8);
    grounds.forEach((fg, i) => {
      const [sea, a, b] = notches[i]!;
      expect(fg.edges.map((e) => edgeHexes(s, e)).sort()).toEqual([pair(sea, a), pair(sea, b)].sort());
      // Its three corners are the notch hex's corners on those two edges.
      for (const v of fg.vertices) expect(s.board.vertices[v]!.hexes).toContain(sea);
      expect(new Set(fg.vertices).size).toBe(3);
    });
    expect(grounds.map((g) => g.token).sort((a, b) => a - b)).toEqual([4, 5, 5, 6, 8, 9, 9, 10]);
    // No fishing ground shares an edge with a harbor.
    const portEdges = new Set(s.board.ports.map((p) => p.edge));
    expect(grounds.flatMap((g) => g.edges).some((e) => portEdges.has(e))).toBe(false);
  });

  it('adds the 14 T&B 5-6 fish tokens (15 / 15 / 13 + the boot)', () => {
    const pool = game('fishingOnCatan').fishTokenPool!;
    const count = (t: string) => pool.filter((x) => x === t).length;
    expect([count('one'), count('two'), count('three'), count('oldBoot')]).toEqual([15, 15, 13, 1]);
    // 3-4 players keep the 30-token bag.
    expect(game('fishingOnCatan', 4).fishTokenPool).toHaveLength(30);
  });
});

describe('Merchant Trains 5-6', () => {
  it('has two watering holes with three train starts each and 33 wagons', () => {
    const s = game('merchantTrains', 6);
    expect(wateringHoles(s)).toEqual(['-1,-1', '0,1']);
    expect(s.wagonSupply).toBe(33);
    const starts = s.wagonStarts!;
    expect(starts).toHaveLength(6);
    const byHole = (hole: string) =>
      starts
        .filter((st) => s.board.hexes[hole]!.corners.includes(st.corner))
        .map((st) => `${st.label}:${edgeHexes(s, st.edge)}`)
        .sort();
    expect(byHole('-1,-1')).toEqual(
      [`NW:${pair('-1,-2', '-2,-1')}`, `NE:${pair('0,-2', '0,-1')}`, `S:${pair('-2,0', '-1,0')}`].sort(),
    );
    expect(byHole('0,1')).toEqual(
      [`NW:${pair('0,0', '-1,1')}`, `NE:${pair('1,0', '1,1')}`, `S:${pair('-1,2', '0,2')}`].sort(),
    );
    expect(terrainCounts(s, land(s))).toEqual({ wood: 6, brick: 5, sheep: 6, wheat: 6, ore: 5, wateringHole: 2 });
    expect(discs(s)).toEqual(SORTED_DISCS);
    // 3-4 players keep one hole, three starts and 22 wagons.
    const small = game('merchantTrains', 4);
    expect(wateringHoles(small)).toEqual(['0,0']);
    expect(small.wagonStarts).toHaveLength(3);
    expect(small.wagonSupply).toBe(22);
  });
});

describe('Barbarian Attack 5-6', () => {
  const NUMBERS: Record<string, number> = {
    '0,-3': 12, '1,-3': 9, '2,-3': 3,
    '-1,-2': 4, '0,-2': 5, '1,-2': 10, '2,-2': 8,
    '-2,-1': 5, '-1,-1': 11, '0,-1': 6, '1,-1': 3,
    '-2,0': 8, '-1,0': 10, '0,0': 4, '1,0': 6,
    '-2,1': 3, '-1,1': 8, '0,1': 11, '1,1': 9,
    '-3,2': 6, '-2,2': 4, '-1,2': 9, '0,2': 10,
    '-3,3': 2, '-2,3': 5, '-1,3': 11,
  };

  it('prints the numbers, castles and deserts in place and deals each area its terrain', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = game('barbarianAttack', 5, seed);
      for (const [h, n] of Object.entries(NUMBERS)) expect(s.board.hexes[h]!.numberToken).toBe(n);
      expect(castleHexes(s.barbarianAttack!)).toEqual(['-3,0', '2,0']);
      expect(s.board.hexes['-3,0']!.terrain).toBe('castle');
      expect(s.board.hexes['2,0']!.terrain).toBe('castle');
      expect(s.board.hexes['2,-1']!.terrain).toBe('desert');
      expect(s.board.hexes['-3,1']!.terrain).toBe('desert');
      const outer = TB_OUTER_RING_5_6.map((c) => `${c.q},${c.r}`).filter((h) => NUMBERS[h] !== undefined);
      expect(outer).toHaveLength(12);
      expect(terrainCounts(s, outer)).toEqual({ brick: 3, wood: 3, sheep: 2, wheat: 2, ore: 2 });
      const inner = land(s).filter((h) => {
        const { q, r } = s.board.hexes[h]!.coord;
        return isInner5_6(q, r);
      });
      expect(inner).toHaveLength(14);
      expect(terrainCounts(s, inner)).toEqual({ brick: 2, wood: 2, sheep: 3, wheat: 4, ore: 3 });
    }
  });

  it('expels clockwise from the 5 by the castle, starts a barbarian on the 2 and the 12, 48 in all', () => {
    const s = game('barbarianAttack', 6);
    const ba = s.barbarianAttack!;
    expect(ba.coastalHexes).toEqual([
      '-2,-1', '-1,-2', '0,-3', '1,-3', '2,-3', '2,-2', '2,-1', '2,0',
      '1,1', '0,2', '-1,3', '-2,3', '-3,3', '-3,2', '-3,1', '-3,0',
    ]);
    // The first hex is a 5 next to a castle.
    expect(s.board.hexes['-2,-1']!.numberToken).toBe(5);
    expect(s.board.edges[Object.keys(s.board.edges).find((e) => edgeHexes(s, e) === pair('-2,-1', '-3,0'))!]).toBeDefined();
    expect(ba.barbarians).toEqual({ '-3,3': 1, '0,-3': 1 });
    expect(ba.supply).toBe(46);
    expect(game('barbarianAttack', 4).barbarianAttack!.supply).toBe(34);
  });

  it('treats the edges of both castles as castle edges', () => {
    const s = game('barbarianAttack', 5);
    const edges = castleEdgeIds(s);
    expect(edges).toHaveLength(12);
    for (const e of edges) expect(isCastleEdge(s, e)).toBe(true);
    const touches = (h: string) => edges.filter((e) => s.board.edges[e]!.hexes.includes(h)).length;
    expect([touches('-3,0'), touches('2,0')]).toEqual([6, 6]);
  });

  it('lands a barbarian on both coastal 5s (or both 9s) when that number is rolled', () => {
    let saw = false;
    for (let seed = 1; seed < 60 && !saw; seed++) {
      const s = { ...game('barbarianAttack', 5), rngState: seed * 104729 } as BarbarianAttackGame;
      const next = resolveBarbarianLanding(s, 'p0') as BarbarianAttackGame;
      const ev = next.barbarianAttack.lastEvents!.events[0]!;
      if (ev.kind !== 'landing') throw new Error('expected a landing');
      const totals = ev.rolls.map((r) => r.dice[0] + r.dice[1]);
      for (const n of [5, 9]) {
        if (!totals.includes(n)) continue;
        saw = true;
        const hexes = ev.rolls.filter((r) => r.dice[0] + r.dice[1] === n).map((r) => r.hex).sort();
        expect(hexes).toEqual(n === 5 ? ['-2,-1', '-2,3'] : ['1,-3', '1,1']);
        for (const h of hexes) expect(next.barbarianAttack.barbarians[h]).toBe(1);
      }
      // 3 distinct numbers; 3-5 barbarians.
      expect(new Set(totals).size).toBe(3);
      expect(ev.rolls.length).toBeGreaterThanOrEqual(3);
      expect(ev.rolls.length).toBeLessThanOrEqual(5);
      expect(next.barbarianAttack.supply).toBe(s.barbarianAttack.supply - ev.rolls.length);
    }
    expect(saw).toBe(true);
  });
});

describe('T&B player counts', () => {
  it('allows every T&B scenario at 5 and 6 players, not at 7', () => {
    for (const id of ['riversOfCatan', 'fishingOnCatan', 'merchantTrains', 'barbarianAttack']) {
      expect(game(id, 5).board.hexIds.filter((h) => game(id, 5).board.hexes[h]!.terrain !== 'sea')).toHaveLength(30);
      expect(game(id, 6).players).toHaveLength(6);
      expect(() => game(id, 7)).toThrow(/at most 6/);
    }
  });

  it('keeps the win targets as printed (10 / 10 / 12 / 12)', () => {
    expect(game('riversOfCatan', 6).settings.victoryPointsToWin).toBe(10);
    expect(game('fishingOnCatan', 6).settings.victoryPointsToWin).toBe(10);
    expect(game('merchantTrains', 6).settings.victoryPointsToWin).toBe(12);
    expect(game('barbarianAttack', 6).settings.victoryPointsToWin).toBe(12);
  });
});
