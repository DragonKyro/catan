import { describe, expect, it } from 'vitest';
import type { GameState, PlayerId, VertexId } from '../../types';
import { applyAction } from '../../engine';
import { getActingPlayerId, updatePlayer } from '../../helpers';
import { canConnectRoad, canPlaceSettlement } from '../../placement';
import { calculateLongestRoad } from '../../scoring/longestRoad';
import { activeMain, ckAfterSetup, putKnight, setImprovements } from './testSupport';
import {
  canPromoteKnightAt,
  knightCanAct,
  legalDisplaceTargets,
  legalKnightMoves,
} from './knights/legal';

// An empty board: every building and road removed, empty hands.
function blank(): GameState {
  const s = ckAfterSetup();
  return activeMain(
    {
      ...s,
      players: s.players.map((p) => ({
        ...p,
        settlements: [],
        cities: [],
        roads: [],
        resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      })),
    },
    'p0',
  );
}

// A straight-ish chain of `n` roads for `pid` from `start`; returns the
// vertices along it (start first).
function roadChain(state: GameState, pid: PlayerId, start: VertexId, n: number) {
  let s = state;
  const path = [start];
  let cur = start;
  for (let i = 0; i < n; i++) {
    const next = s.board.vertices[cur]!.edges
      .map((e) => s.board.edges[e]!)
      .find((e) => {
        const other = e.vertices[0] === cur ? e.vertices[1] : e.vertices[0];
        return !path.includes(other) && !s.players.some((p) => p.roads.includes(e.id));
      })!;
    const other = next.vertices[0] === cur ? next.vertices[1] : next.vertices[0];
    s = updatePlayer(s, pid, (p) => ({ ...p, roads: [...p.roads, next.id] }));
    path.push(other);
    cur = other;
  }
  return { state: s, path };
}

function inland(state: GameState): VertexId {
  return state.board.vertexIds.find(
    (v) => state.board.vertices[v]!.hexes.length === 3 && state.board.vertices[v]!.neighborVertices.length === 3,
  )!;
}

function give(s: GameState, pid: PlayerId, r: Partial<Record<'wood' | 'brick' | 'sheep' | 'wheat' | 'ore', number>>) {
  return updatePlayer(s, pid, (p) => ({ ...p, resources: { ...p.resources, ...r } }));
}

describe('C&K knights (p.9-10)', () => {
  it('each player has 2 knights of each strength', () => {
    const s = ckAfterSetup();
    for (const p of s.players) expect(s.knightSupply![p.id]).toEqual({ 1: 2, 2: 2, 3: 2 });
  });

  it('recruit: basic only, inactive, on an empty intersection on your road, no distance rule', () => {
    let s = blank();
    const start = inland(s);
    s = updatePlayer(s, 'p0', (p) => ({ ...p, settlements: [start] }));
    const { state, path } = roadChain(s, 'p0', start, 2);
    s = give(state, 'p0', { sheep: 1, ore: 1 });
    // Right next to the settlement: allowed (knights ignore the Distance Rule).
    s = applyAction(s, { type: 'recruitKnight', playerId: 'p0', vertex: path[1]! });
    expect(s.knights![path[1]!]).toMatchObject({ playerId: 'p0', strength: 1, active: false });
    // Not on the settlement itself, not off the road.
    s = give(s, 'p0', { sheep: 2, ore: 2 });
    expect(() => applyAction(s, { type: 'recruitKnight', playerId: 'p0', vertex: start })).toThrow();
    const offRoad = s.board.vertexIds.find(
      (v) => !path.includes(v) && !s.board.vertices[v]!.neighborVertices.some((n) => path.includes(n)),
    )!;
    expect(() => applyAction(s, { type: 'recruitKnight', playerId: 'p0', vertex: offRoad })).toThrow();
    // Out of basic knights → must promote first.
    s = putKnight(s, 'p0', path[2]!, 1);
    expect(s.knightSupply!.p0[1]).toBe(0);
    expect(() =>
      applyAction(s, { type: 'recruitKnight', playerId: 'p0', vertex: path[2]! }),
    ).toThrow(/promote/);
  });

  it('promote: once per knight per turn, status kept; mighty needs politics 3', () => {
    let s = blank();
    const { state, path } = roadChain(s, 'p0', inland(s), 3);
    s = putKnight(state, 'p0', path[1]!, 1, true);
    s = putKnight(s, 'p0', path[3]!, 2, false);
    s = give(s, 'p0', { sheep: 5, ore: 5 });
    s = applyAction(s, { type: 'promoteKnight', playerId: 'p0', vertex: path[1]! });
    expect(s.knights![path[1]!]).toMatchObject({ strength: 2, active: true });
    expect(canPromoteKnightAt(s, 'p0', path[1]!)).toBe(false);
    expect(() => applyAction(s, { type: 'promoteKnight', playerId: 'p0', vertex: path[1]! })).toThrow(/already promoted/);
    // A different knight may still be promoted this turn — but not to mighty yet.
    expect(() => applyAction(s, { type: 'promoteKnight', playerId: 'p0', vertex: path[3]! })).toThrow(/Politics level 3/);
    s = setImprovements(s, 'p0', { politics: 3 });
    s = applyAction(s, { type: 'promoteKnight', playerId: 'p0', vertex: path[3]! });
    expect(s.knights![path[3]!]).toMatchObject({ strength: 3, active: false });
    // Next turn the first knight may be promoted again.
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.knights![path[1]!]!.promotedThisTurn).toBeUndefined();
  });

  it('activate then act is not allowed; act then activate is', () => {
    let s = blank();
    const { state, path } = roadChain(s, 'p0', inland(s), 3);
    s = putKnight(state, 'p0', path[0]!, 1, false);
    s = putKnight(s, 'p0', path[3]!, 1, true);
    s = give(s, 'p0', { wheat: 2 });
    s = applyAction(s, { type: 'activateKnight', playerId: 'p0', vertex: path[0]! });
    expect(knightCanAct(s, path[0]!)).toBe(false);
    expect(() =>
      applyAction(s, { type: 'moveKnight', playerId: 'p0', from: path[0]!, to: path[1]! }),
    ).toThrow(/activated this turn/);
    // The other knight was active from the start of the turn: it moves, lies
    // down, and can be stood up again (but not act again).
    s = applyAction(s, { type: 'moveKnight', playerId: 'p0', from: path[3]!, to: path[2]! });
    expect(s.knights![path[2]!]!.active).toBe(false);
    s = applyAction(s, { type: 'activateKnight', playerId: 'p0', vertex: path[2]! });
    expect(s.knights![path[2]!]!.active).toBe(true);
    expect(knightCanAct(s, path[2]!)).toBe(false);
  });

  it('move: along your own routes, past your own pieces, not past others', () => {
    let s = blank();
    const { state, path } = roadChain(s, 'p0', inland(s), 4);
    s = putKnight(state, 'p0', path[0]!, 1, true);
    s = updatePlayer(s, 'p0', (p) => ({ ...p, settlements: [path[1]!] }));
    s = putKnight(s, 'p1', path[3]!, 1, false);
    const moves = legalKnightMoves(s, path[0]!);
    expect(moves).toContain(path[2]!); // past own settlement
    expect(moves).not.toContain(path[4]!); // beyond p1's knight
    expect(moves).not.toContain(path[1]!); // occupied
  });

  it('displace a weaker knight; its owner moves it (status kept) or it returns to supply', () => {
    let s = blank();
    const a = roadChain(s, 'p0', inland(s), 2);
    s = a.state;
    // p1 owns a road leaving the contested vertex so the knight can retreat.
    const branch = s.board.vertices[a.path[2]!]!.edges.find(
      (e) => !s.players.some((p) => p.roads.includes(e)),
    )!;
    s = updatePlayer(s, 'p1', (p) => ({ ...p, roads: [branch] }));
    const retreat = s.board.edges[branch]!.vertices.find((v) => v !== a.path[2])!;
    s = putKnight(s, 'p0', a.path[0]!, 2, true);
    s = putKnight(s, 'p1', a.path[2]!, 1, true);
    expect(legalDisplaceTargets(s, a.path[0]!)).toEqual([a.path[2]!]);
    s = applyAction(s, { type: 'displaceKnight', playerId: 'p0', from: a.path[0]!, to: a.path[2]! });
    expect(s.phase).toBe('displacedKnightMove');
    expect(getActingPlayerId(s)).toBe('p1');
    expect(s.knights![a.path[2]!]).toMatchObject({ playerId: 'p0', active: false });
    s = applyAction(s, { type: 'displacedKnightMove', playerId: 'p1', to: retreat });
    expect(s.knights![retreat]).toMatchObject({ playerId: 'p1', strength: 1, active: true });
    expect(s.phase).toBe('main');

    // Equal strength can't displace; with nowhere to go the knight is removed.
    let t = blank();
    const b = roadChain(t, 'p0', inland(t), 2);
    t = putKnight(b.state, 'p0', b.path[0]!, 2, true);
    t = putKnight(t, 'p1', b.path[2]!, 2, true);
    expect(legalDisplaceTargets(t, b.path[0]!)).toEqual([]);
    t = { ...t, knights: { ...t.knights!, [b.path[2]!]: { playerId: 'p1', strength: 1, active: false } } };
    t = applyAction(t, { type: 'displaceKnight', playerId: 'p0', from: b.path[0]!, to: b.path[2]! });
    expect(t.phase).toBe('main');
    expect(Object.values(t.knights!).some((k) => k.playerId === 'p1')).toBe(false);
    expect(t.knightSupply!.p1[1]).toBe(3);
  });

  it('chase away the robber from a corner of its hex, once the robber is active', () => {
    let s = blank();
    const hex = s.board.hexIds.find((h) => s.board.hexes[h]!.terrain === 'wood')!;
    const corner = s.board.hexes[hex]!.corners[0]!;
    s = putKnight(s, 'p0', corner, 1, true);
    s = { ...s, board: { ...s.board, robberHex: hex } };
    expect(() => applyAction(s, { type: 'chaseRobber', playerId: 'p0', vertex: corner })).toThrow(/robber/);
    s = { ...s, robberActive: true };
    s = applyAction(s, { type: 'chaseRobber', playerId: 'p0', vertex: corner });
    expect(s.phase).toBe('moveRobber');
    expect(s.knights![corner]!.active).toBe(false);
    const target = s.board.hexIds.find((h) => h !== hex && s.board.hexes[h]!.terrain !== 'sea')!;
    s = applyAction(s, { type: 'moveRobber', playerId: 'p0', hex: target, stealFrom: null });
    expect(s.phase).toBe('main');
  });

  it("knights block opponents' roads and settlement sites, and break their Longest Route", () => {
    let s = blank();
    const { state, path } = roadChain(s, 'p1', inland(s), 6);
    s = putKnight(state, 'p0', path[3]!, 1, false);
    expect(calculateLongestRoad(s, 'p1')).toBe(3);
    expect(canPlaceSettlement(s, 'p1', path[3]!)).toBe(false);
    // p0's knight at the end of a p1 road stops p1 extending past it.
    let t = blank();
    const c = roadChain(t, 'p1', inland(t), 2);
    t = putKnight(c.state, 'p0', c.path[2]!, 1, false);
    const beyond = t.board.vertices[c.path[2]!]!.edges.find(
      (e) => !t.players.some((p) => p.roads.includes(e)),
    )!;
    expect(canConnectRoad(t, 'p1', beyond)).toBe(false);
  });
});
