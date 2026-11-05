import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import type { EdgeId, GameState, MerchantTrain, VertexId } from '../../../types';
import {
  applyWagonPlacement,
  legalWagonPlacements,
  resolveWagonStarts,
} from './trains';
import { canPlaceWagon, wagonDegreeAtVertex } from './placement';

function newMerchantGame(numPlayers = 3): GameState {
  return createGame({
    playerNames: ['A', 'B', 'C', 'D'].slice(0, numPlayers),
    seed: 1,
    settings: { expansions: ['traders'], tradersScenarioId: 'merchantTrains' },
    randomizeTurnOrder: false,
  });
}

function edgeBetween(state: GameState, a: string, b: string): EdgeId {
  const e = Object.values(state.board.edges).find(
    (x) => x.hexes.includes(a) && x.hexes.includes(b),
  );
  if (!e) throw new Error(`no edge between ${a} and ${b}`);
  return e.id;
}

function edgeOf(state: GameState, v1: VertexId, v2: VertexId): EdgeId {
  const e = state.board.vertices[v1]!.edges.find((eid) =>
    state.board.edges[eid]!.vertices.includes(v2),
  );
  if (!e) throw new Error('vertices not adjacent');
  return e;
}

// A land hex away from the watering hole, for hand-built train layouts.
function farHex(state: GameState) {
  return state.board.hexes['2,-2']!;
}

describe('Merchant Trains start points', () => {
  it('starts at the NW, NE and S corners, on the edges leading away from the hex', () => {
    const s = newMerchantGame();
    const wh = s.wateringHoleHexId!;
    expect(wh).toBe('0,0');
    const starts = s.wagonStarts!;
    expect(starts.map((x) => x.label)).toEqual(['NW', 'NE', 'S']);
    // Rulebook p. 14 / TB-MAP-SPEC: NW corner → edge between (0,-1) and
    // (-1,0); NE corner → (1,-1)|(1,0); S corner → (-1,1)|(0,1).
    expect(starts[0]!.edge).toBe(edgeBetween(s, '0,-1', '-1,0'));
    expect(starts[1]!.edge).toBe(edgeBetween(s, '1,-1', '1,0'));
    expect(starts[2]!.edge).toBe(edgeBetween(s, '-1,1', '0,1'));
    for (const st of starts) {
      // The corner is on the watering hole; the start edge and its far end aren't.
      expect(s.board.vertices[st.corner]!.hexes).toContain(wh);
      expect(s.board.edges[st.edge]!.hexes).not.toContain(wh);
      expect(s.board.vertices[st.head]!.hexes).not.toContain(wh);
    }
  });

  it('the forbidden N, SE and SW corners have no start edge', () => {
    const s = newMerchantGame();
    const corners = new Set(s.wagonStarts!.map((x) => x.corner));
    const hex = s.board.hexes[s.wateringHoleHexId!]!;
    expect(hex.corners.filter((c) => corners.has(c))).toHaveLength(3);
    // The N corner (top) sits between the NW and NE neighbours, never a start.
    const n = Object.values(s.board.vertices).find(
      (v) => v.hexes.includes('0,0') && v.hexes.includes('0,-1') && v.hexes.includes('1,-1'),
    )!;
    expect(corners.has(n.id)).toBe(false);
  });

  it('resolves the same start points straight from the board', () => {
    const s = newMerchantGame(4);
    expect(resolveWagonStarts(s.board, s.wateringHoleHexId!)).toEqual(s.wagonStarts);
  });
});

describe('Merchant Trains placement', () => {
  it('the first wagons can only go on the three start edges', () => {
    const s = newMerchantGame();
    const legal = legalWagonPlacements(s);
    expect(legal).toEqual(s.wagonStarts!.map((x) => ({ edge: x.edge, train: null })));
    // Any other edge of the watering hole is not a start.
    const side = Object.values(s.board.edges).find((e) => e.hexes.includes('0,0'))!;
    expect(canPlaceWagon(s, side.id)).toBe(false);
  });

  it('a new train faces away from the watering hole and extends only at its front', () => {
    let s = newMerchantGame();
    const nw = s.wagonStarts![0]!;
    s = applyWagonPlacement(s, { edge: nw.edge, train: null });
    expect(s.wagonSupply).toBe(21);
    expect(s.wagons).toEqual([{ edge: nw.edge, front: nw.head, train: 1 }]);
    expect(s.merchantTrains).toEqual([{ id: 1, start: nw.corner, head: nw.head, ended: false }]);
    const ext = legalWagonPlacements(s).filter((p) => p.train === 1);
    // Two free edges at the front intersection; none back at the corner.
    expect(ext).toHaveLength(2);
    for (const p of ext) {
      expect(s.board.edges[p.edge]!.vertices).toContain(nw.head);
    }
    // Add one: the old front is now the middle — no branching from it.
    s = applyWagonPlacement(s, ext[0]!);
    const branch = ext[1]!.edge;
    expect(legalWagonPlacements(s).some((p) => p.edge === branch)).toBe(false);
    expect(s.wagons![1]!.front).toBe(s.merchantTrains![0]!.head);
    expect(wagonDegreeAtVertex(s, nw.head)).toBe(2);
  });

  it('two fronts meeting at an intersection merge; the merged train goes on from there', () => {
    const s0 = newMerchantGame();
    const c = farHex(s0).corners;
    // Train 1's front at c0, train 2's front at c2 (hand-built).
    const trains: MerchantTrain[] = [
      { id: 1, start: 'x', head: c[0]!, ended: false },
      { id: 2, start: 'y', head: c[2]!, ended: false },
    ];
    let s: GameState = { ...s0, merchantTrains: trains, wagons: [] };
    s = applyWagonPlacement(s, { edge: edgeOf(s, c[0]!, c[1]!), train: 1 });
    expect(s.merchantTrains![0]!.head).toBe(c[1]);
    s = applyWagonPlacement(s, { edge: edgeOf(s, c[2]!, c[1]!), train: 2 });
    const [t1, t2] = s.merchantTrains!;
    expect(t2).toMatchObject({ ended: true, mergedInto: 1, head: c[1] });
    expect(t1).toMatchObject({ ended: false, head: c[1] });
    // Only train 1 (the merged train) can go on, from c1, on its one free edge.
    const legal = legalWagonPlacements({ ...s, wagonStarts: [] });
    expect(legal).toHaveLength(1);
    expect(legal[0]!.train).toBe(1);
  });

  it('a front running into the middle of another train ends there', () => {
    const s0 = newMerchantGame();
    const c = farHex(s0).corners;
    const outward = s0.board.vertices[c[1]!]!.neighborVertices.find(
      (v) => v !== c[0] && v !== c[2],
    )!;
    let s: GameState = {
      ...s0,
      merchantTrains: [
        { id: 1, start: 'x', head: c[0]!, ended: false },
        { id: 2, start: 'y', head: outward, ended: false },
      ],
      wagons: [],
    };
    s = applyWagonPlacement(s, { edge: edgeOf(s, c[0]!, c[1]!), train: 1 });
    s = applyWagonPlacement(s, { edge: edgeOf(s, c[1]!, c[2]!), train: 1 });
    // Train 1 runs c0 → c1 → c2; train 2 now reaches c1, its middle.
    s = applyWagonPlacement(s, { edge: edgeOf(s, outward, c[1]!), train: 2 });
    const [t1, t2] = s.merchantTrains!;
    expect(t2.ended).toBe(true);
    expect(t2.mergedInto).toBeUndefined();
    expect(t1.ended).toBe(false);
    expect(legalWagonPlacements(s).some((p) => p.train === 2)).toBe(false);
  });

  it('a train whose front has no free edge ends', () => {
    const s0 = newMerchantGame();
    const c = farHex(s0).corners;
    const v = s0.board.vertices[c[1]!]!;
    // Fill every edge at c1 except one, then extend into c1.
    const [into, ...rest] = v.edges;
    const fromVertex = s0.board.edges[into!]!.vertices.find((x) => x !== c[1])!;
    let s: GameState = {
      ...s0,
      merchantTrains: [{ id: 1, start: 'x', head: fromVertex, ended: false }],
      wagons: rest.map((edge) => ({ edge, train: 99 })),
    };
    s = applyWagonPlacement(s, { edge: into!, train: 1 });
    expect(s.merchantTrains![0]!.ended).toBe(true);
  });

  it('no wagon can be placed once the 22-wagon supply is empty', () => {
    const s = { ...newMerchantGame(), wagonSupply: 0 };
    expect(legalWagonPlacements(s)).toEqual([]);
  });
});
