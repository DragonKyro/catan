import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import { getActingPlayerId } from '@/game/helpers';
import {
  canConnectRoad, canPlaceCity, canPlaceInitialRoad, canPlaceInitialSettlement, canPlaceSettlement,
} from '@/game/placement';
import type { GameState } from '@/game/types';
import { boardIndex, NONE } from './board';
import { sampleGames, type Sample } from './testSupport';
import { observe, type CatanDraft } from './observation';
import {
  EDGE_DIM, EDGE_LAYOUT, ENCODER_VERSION, GLOBAL_DIM, GLOBAL_LAYOUT, HEX_DIM, HEX_LAYOUT, VERTEX_DIM, VERTEX_LAYOUT,
  encodeObservation, type CatanFeatures, type FeatureLayout,
} from './encode';

const SAMPLES: Sample[] = [
  ...sampleGames({ players: 3, games: 1, seed: 77, every: 3, maxSteps: 1500 }),
  ...sampleGames({ players: 4, games: 2, seed: 78, every: 3, maxSteps: 1500 }),
  ...sampleGames({ players: 6, games: 1, seed: 79, every: 4, maxSteps: 1500 }),
  ...sampleGames({ players: 8, games: 1, seed: 80, every: 5, maxSteps: 1500 }),
];

const encode = (s: Sample, viewer: string, draft?: CatanDraft) =>
  encodeObservation(observe(s.state, viewer, s.knowledge[viewer]!, { draft }));

/** One entity row's (or the global vector's) segment. */
function seg(f: CatanFeatures, part: 'hexes' | 'vertices' | 'edges' | 'global', row: number, name: string): number[] {
  const [layout, dim]: [FeatureLayout, number] = part === 'hexes' ? [HEX_LAYOUT, HEX_DIM]
    : part === 'vertices' ? [VERTEX_LAYOUT, VERTEX_DIM] : part === 'edges' ? [EDGE_LAYOUT, EDGE_DIM] : [GLOBAL_LAYOUT, GLOBAL_DIM];
  const s = layout.seg(name);
  return Array.from(f[part].subarray(row * dim + s.offset, row * dim + s.offset + s.size));
}

describe('catan feature encoder', () => {
  it('has contiguous layouts with unique segment names', () => {
    for (const layout of [HEX_LAYOUT, VERTEX_LAYOUT, EDGE_LAYOUT, GLOBAL_LAYOUT]) {
      let at = 0;
      for (const s of layout.segments) {
        expect(s.offset).toBe(at);
        expect(s.size).toBeGreaterThan(0);
        at += s.size;
      }
      expect(at).toBe(layout.dim);
      expect(new Set(layout.segments.map((s) => s.name)).size).toBe(layout.segments.length);
    }
  });

  it('matches the versioned sizes (bump ENCODER_VERSION when these change)', () => {
    expect({ version: ENCODER_VERSION, hex: HEX_DIM, vertex: VERTEX_DIM, edge: EDGE_DIM, global: GLOBAL_DIM })
      .toEqual({ version: 1, hex: 29, vertex: 38, edge: 11, global: 371 });
  });

  it('indexes every base board with consistent topology', () => {
    const sizes: Record<number, [number, number, number]> = { 4: [19, 54, 72], 6: [30, 80, 109], 8: [37, 96, 132] };
    for (const [players, [H, V, E]] of Object.entries(sizes)) {
      const state = createGame({ playerNames: Array.from({ length: Number(players) }, (_, i) => `p${i}`), seed: 2 });
      const idx = boardIndex(state.board);
      expect([idx.hexIds.length, idx.vertexIds.length, idx.edgeIds.length]).toEqual([H, V, E]);
      // Another game of the same variant shares the index (topology is fixed per variant).
      const other = createGame({ playerNames: Array.from({ length: Number(players) }, (_, i) => `q${i}`), seed: 99 });
      expect(boardIndex(other.board)).toBe(idx);
      for (let e = 0; e < E; e++) {
        const [a, b] = [idx.edgeVertices[e * 2]!, idx.edgeVertices[e * 2 + 1]!];
        expect(Array.from(idx.vertexNeighbors.subarray(a * 3, a * 3 + 3))).toContain(b);
        expect(Array.from(idx.vertexEdges.subarray(a * 3, a * 3 + 3))).toContain(e);
      }
      for (let h = 0; h < H; h++) {
        const corners = Array.from(idx.hexVertices.subarray(h * 6, h * 6 + 6));
        expect(new Set(corners).size).toBe(6);
        expect(corners).not.toContain(NONE);
      }
    }
  });

  it('writes bounded, finite values for every sampled state and seat', () => {
    expect(SAMPLES.length).toBeGreaterThan(300);
    for (const s of SAMPLES) {
      for (const p of s.state.players) {
        const f = encode(s, p.id);
        for (const part of ['hexes', 'vertices', 'edges', 'global'] as const) {
          const bad = Array.from(f[part]).findIndex((v) => !(Number.isFinite(v) && Math.abs(v) <= 4));
          expect(bad).toBe(-1);
        }
      }
    }
  });

  it('placement features agree with the engine\'s own rules', () => {
    let checked = 0;
    for (const s of SAMPLES) {
      const state = s.state;
      const id = getActingPlayerId(state);
      const setup = state.phase === 'setupRound1' || state.phase === 'setupRound2';
      if (!setup && state.phase !== 'main') continue;
      const me = state.players.find((p) => p.id === id)!;
      const f = encode(s, id);
      const idx = boardIndex(state.board);
      idx.vertexIds.forEach((v, i) => {
        const settle = me.settlements.length < 5
          && (setup ? canPlaceInitialSettlement(state, v) : canPlaceSettlement(state, id, v));
        expect(seg(f, 'vertices', i, 'canSettle')[0]).toBe(settle ? 1 : 0);
        expect(seg(f, 'vertices', i, 'canCity')[0]).toBe(me.cities.length < 4 && canPlaceCity(state, id, v) ? 1 : 0);
        if (settle && !setup) expect(seg(f, 'vertices', i, 'myDistance')[0]).toBe(1);
      });
      const anchor = state.setupState?.step === 'road' ? state.setupState.lastPlacedSettlement : null;
      idx.edgeIds.forEach((e, i) => {
        const road = me.roads.length < 15 && (setup
          ? anchor !== null && canPlaceInitialRoad(state, anchor, e)
          : canConnectRoad(state, id, e));
        if (!setup || anchor) expect(seg(f, 'edges', i, 'canRoad')[0]).toBe(road ? 1 : 0);
      });
      checked++;
    }
    expect(checked).toBeGreaterThan(100);
  });

  it('a Road Building draft counts its first road as the viewer\'s', () => {
    let checked = 0;
    for (const s of SAMPLES) {
      const state = s.state;
      if (state.phase !== 'main' || state.pendingTrade || state.players.length !== 4) continue;
      const id = getActingPlayerId(state);
      const idx = boardIndex(state.board);
      const first = idx.edgeIds.find((e) => canConnectRoad(state, id, e));
      if (!first) continue;
      const f = encode(s, id, { roadBuilding: [first] });
      const placed: GameState = {
        ...state,
        players: state.players.map((p) => (p.id === id ? { ...p, roads: [...p.roads, first] } : p)),
      };
      const me = placed.players.find((p) => p.id === id)!;
      idx.edgeIds.forEach((e, i) => {
        expect(seg(f, 'edges', i, 'canRoad')[0]).toBe(me.roads.length < 15 && canConnectRoad(placed, id, e) ? 1 : 0);
        expect(seg(f, 'edges', i, 'draftRoad')[0]).toBe(e === first ? 1 : 0);
        if (e === first) expect(seg(f, 'edges', i, 'road')[0]).toBe(1);
      });
      if (++checked >= 20) break;
    }
    expect(checked).toBeGreaterThan(5);
  });

  it('encodes seats by role: next1..3 present at 4 players, next3 absent at 3, far pooled at 6+', () => {
    const at = (players: number) => {
      const s = SAMPLES.find((x) => x.state.players.length === players && x.state.phase === 'main')!;
      return encode(s, s.state.playerOrder[0]!);
    };
    const three = at(3);
    expect(seg(three, 'global', 0, 'next2.present')).toEqual([1]);
    expect(seg(three, 'global', 0, 'next3.present')).toEqual([0]);
    expect(seg(three, 'global', 0, 'far.count')).toEqual([0]);
    const four = at(4);
    expect(seg(four, 'global', 0, 'next3.present')).toEqual([1]);
    expect(seg(four, 'global', 0, 'far.count')).toEqual([0]);
    const six = at(6);
    expect(seg(six, 'global', 0, 'far.count')[0]).toBeCloseTo(2 / 4);
  });

  it('marks the viewer\'s own pieces as seat slot 0 and reacts to its own hand (control)', () => {
    const s = SAMPLES.find((x) => x.state.players.length === 4 && x.state.phase === 'main')!;
    const viewer = s.state.playerOrder[1]!;
    const f = encode(s, viewer);
    const idx = boardIndex(s.state.board);
    const me = s.state.players.find((p) => p.id === viewer)!;
    for (const v of me.settlements) expect(seg(f, 'vertices', idx.vertexIndex.get(v)!, 'owner')).toEqual([1, 0, 0, 0, 0]);
    for (const e of me.roads) expect(seg(f, 'edges', idx.edgeIndex.get(e)!, 'road')).toEqual([1, 0, 0, 0, 0]);
    const richer: Sample = {
      ...s,
      state: { ...s.state, players: s.state.players.map((p) => (p.id === viewer ? { ...p, resources: { ...p.resources, ore: p.resources.ore + 3 } } : p)) },
    };
    expect(seg(encode(richer, viewer), 'global', 0, 'me.hand')).not.toEqual(seg(f, 'global', 0, 'me.hand'));
  });
});
