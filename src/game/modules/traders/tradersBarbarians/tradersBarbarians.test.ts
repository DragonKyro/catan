import { describe, expect, it } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { giveResources, runSetupPhase } from '../../../__testHelpers';
import {
  canConnectRoad,
  canPlaceInitialRoad,
  canPlaceInitialSettlement,
  canPlaceSettlement,
} from '../../../placement';
import { calculateVictoryPoints } from '../../../scoring/points';
import { edgeKey } from '../../../board/coords';
import { emptyBank } from '../../../resources';
import type {
  EdgeId,
  GameState,
  HexId,
  PlayerId,
  TbWagon,
  TradersBarbariansState,
  VertexId,
} from '../../../types';
import { TB_FRAME_PORTS_3_4 } from '../board/frame';
import {
  barbarianTargetEdges,
  driveOffTargets,
  legalWagonSteps,
  wagonEdgeCost,
  type TradersBarbariansGame,
} from './state';
import { TB_DECK_COUNTS, TB_WAGON_UPGRADE_COSTS } from './constants';

function newGame(seed = 1, players = 3): TradersBarbariansGame {
  return createGame({
    playerNames: ['A', 'B', 'C', 'D'].slice(0, players),
    seed,
    settings: { expansions: ['traders'], tradersScenarioId: 'tradersAndBarbarians' },
    randomizeTurnOrder: false,
  }) as TradersBarbariansGame;
}

// After setup, rolled a 3 and in the main phase with p0 to act.
function mainPhase(seed = 1, players = 3): TradersBarbariansGame {
  let s = runSetupPhase(newGame(seed, players));
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [1, 2] });
  expect(s.phase).toBe('main');
  return s as TradersBarbariansGame;
}

function patchTb(s: GameState, fn: (tb: TradersBarbariansState) => Partial<TradersBarbariansState>): TradersBarbariansGame {
  return { ...s, tradersBarbarians: { ...s.tradersBarbarians!, ...fn(s.tradersBarbarians!) } } as TradersBarbariansGame;
}

function setWagon(s: GameState, pid: PlayerId, w: Partial<TbWagon>): TradersBarbariansGame {
  return patchTb(s, (tb) => ({ wagons: { ...tb.wagons, [pid]: { ...tb.wagons[pid]!, ...w } } }));
}

function setPieces(
  s: GameState,
  pid: PlayerId,
  pieces: { settlements?: VertexId[]; cities?: VertexId[]; roads?: EdgeId[]; gold?: number },
): TradersBarbariansGame {
  return { ...s, players: s.players.map((p) => (p.id === pid ? { ...p, ...pieces } : p)) } as TradersBarbariansGame;
}

function clearBoard(s: GameState): TradersBarbariansGame {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, settlements: [], cities: [], roads: [], resources: emptyBank() })),
  } as TradersBarbariansGame;
}

const hexOf = (s: GameState, q: number, r: number) => s.board.hexes[`${q},${r}`]!;
// Corner c (0 NE, 1 SE, 2 S, 3 SW, 4 NW, 5 N) and edge d (0 E … 5 NE).
const corner = (s: GameState, q: number, r: number, c: number) => hexOf(s, q, r).corners[c]!;
const hexEdge = (s: GameState, q: number, r: number, d: number) =>
  edgeKey(hexOf(s, q, r).corners[d]!, hexOf(s, q, r).corners[(d + 1) % 6]!);
const sharedEdge = (s: GameState, a: HexId, b: HexId): EdgeId => {
  const e = Object.values(s.board.edges).find((x) => x.hexes.includes(a) && x.hexes.includes(b));
  if (!e) throw new Error(`no edge between ${a} and ${b}`);
  return e.id;
};
const loc = (s: GameState, id: string) => s.tradersBarbarians!.locations.find((l) => l.id === id)!;

// Start the End of Turn phase for the current player.
function toWagonPhase(s: GameState): TradersBarbariansGame {
  const pid = s.playerOrder[s.currentPlayerIndex]!;
  const next = applyAction(s, { type: 'endTurn', playerId: pid });
  expect(next.phase).toBe('wagonMoves');
  return next as TradersBarbariansGame;
}

describe('Traders & Barbarians scenario — board', () => {
  it('places the three commodity hexes, 16 random land hexes and 16 discs without 2 / 12', () => {
    for (const seed of [1, 2, 3, 7]) {
      const s = newGame(seed);
      expect(hexOf(s, 2, -2).terrain).toBe('commodity');
      expect(hexOf(s, -2, 0).terrain).toBe('commodity');
      expect(hexOf(s, 0, 2).terrain).toBe('commodity');
      const land = Object.values(s.board.hexes).filter((h) => h.terrain !== 'sea' && h.terrain !== 'commodity');
      expect(land).toHaveLength(16);
      const counts: Record<string, number> = {};
      for (const h of land) counts[h.terrain] = (counts[h.terrain] ?? 0) + 1;
      expect(counts).toEqual({ wood: 4, sheep: 3, wheat: 3, brick: 3, ore: 3 });
      const tokens = land.map((h) => h.numberToken!).sort((a, b) => a - b);
      expect(tokens).toEqual([3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11]);
      for (const id of ['2,-2', '-2,0', '0,2']) expect(s.board.hexes[id]!.numberToken).toBeNull();
    }
  });

  it('names each location and gives each a plaza at the hex centre with 4 interior paths', () => {
    const s = newGame();
    const expected: Record<string, { hex: [number, number]; corners: number[]; x: number[] }> = {
      quarry: { hex: [2, -2], corners: [1, 2, 3, 4], x: [4, 5, 0] },
      castle: { hex: [-2, 0], corners: [5, 0, 1, 2], x: [4, 3, 2] },
      glassworks: { hex: [0, 2], corners: [5, 0, 3, 4], x: [0, 1, 2] },
    };
    for (const [id, e] of Object.entries(expected)) {
      const l = loc(s, id);
      const hex = hexOf(s, e.hex[0], e.hex[1]);
      expect(l.hex).toBe(hex.id);
      const plaza = s.board.vertices[l.plaza]!;
      expect(plaza.position).toEqual(hex.center);
      expect(plaza.hexes).toEqual([]);
      expect(plaza.edges.sort()).toEqual([...l.paths].sort());
      const pathCorners = l.paths.map((p) => s.board.edges[p]!.vertices.find((v) => v !== l.plaza)!);
      expect(pathCorners.sort()).toEqual(e.corners.map((c) => hex.corners[c]!).sort());
      for (const p of l.paths) {
        expect(s.board.edges[p]!.hexes).toEqual([hex.id]);
        expect(s.board.edgeIds).toContain(p);
      }
      // Every X edge is on the frame: it touches a sea hex.
      expect([...l.xEdges].sort()).toEqual(e.x.map((d) => hexEdge(s, e.hex[0], e.hex[1], d)).sort());
      for (const x of l.xEdges) {
        expect(s.board.edges[x]!.hexes.some((h) => s.board.hexes[h]!.terrain === 'sea')).toBe(true);
      }
    }
    // Sanity on the corner enum: corner 5 is straight above the centre, 2 below.
    const q = hexOf(s, 2, -2);
    expect(s.board.vertices[q.corners[5]!]!.position.y).toBeLessThan(q.center.y - 40);
    expect(s.board.vertices[q.corners[2]!]!.position.y).toBeGreaterThan(q.center.y + 40);
  });

  it('starts the three barbarians on the rulebook edges', () => {
    const s = newGame();
    expect(s.tradersBarbarians.barbarians).toEqual([
      sharedEdge(s, '1,-2', '1,-1'),
      sharedEdge(s, '-1,0', '-2,1'),
      sharedEdge(s, '0,1', '1,1'),
    ]);
  });

  it('uses the T&B frame harbors and no robber, Longest Road or base deck', () => {
    const s = newGame();
    expect(s.board.ports).toHaveLength(TB_FRAME_PORTS_3_4.length);
    for (const a of TB_FRAME_PORTS_3_4) {
      const port = s.board.ports.find((p) => p.edge === hexEdge(s, a.q, a.r, a.direction));
      expect(port?.type).toBe(a.fixedType);
    }
    expect(s.robberActive).toBe(false);
    expect(s.noLongestRoad).toBe(true);
    expect(s.devCardDeck).toEqual([]);
    expect(s.coinsInPlay).toBe(true);
    expect(s.settings.victoryPointsToWin).toBe(13);
  });

  it('deals 12 tokens per location and the 25-card scenario deck', () => {
    const s = newGame();
    const count = (xs: string[]) => xs.reduce<Record<string, number>>((m, x) => ({ ...m, [x]: (m[x] ?? 0) + 1 }), {});
    expect(count(loc(s, 'quarry').stack)).toEqual({ sand: 6, marble: 6 });
    expect(count(loc(s, 'castle').stack)).toEqual({ tools: 6, sand: 6 });
    expect(count(loc(s, 'glassworks').stack)).toEqual({ glass: 6, tools: 6 });
    expect(loc(s, 'quarry').needs).toEqual(['tools']);
    expect(loc(s, 'castle').needs).toEqual(['marble', 'glass']);
    expect(loc(s, 'glassworks').needs).toEqual(['sand']);
    expect(count(s.tradersBarbarians.deck)).toEqual(TB_DECK_COUNTS);
    expect(s.players.every((p) => p.gold === 5)).toBe(true);
  });
});

describe('Traders & Barbarians scenario — building', () => {
  it('refuses a settlement on a plaza, and roads on X edges', () => {
    let s = clearBoard(mainPhase());
    const q = loc(s, 'quarry');
    expect(canPlaceInitialSettlement(s, q.plaza)).toBe(false);
    // A road leading into the plaza still doesn't make it a settlement spot.
    const path = q.paths[0]!;
    const cornerV = s.board.edges[path]!.vertices.find((v) => v !== q.plaza)!;
    s = setPieces(s, 'p0', { settlements: [cornerV], roads: [] });
    expect(canConnectRoad(s, 'p0', path)).toBe(true);
    s = setPieces(s, 'p0', { roads: [path] });
    expect(canPlaceSettlement(s, 'p0', q.plaza)).toBe(false);
    // Roads continue through the plaza onto another path.
    const other = q.paths.find((p) => p !== path)!;
    expect(canConnectRoad(s, 'p0', other)).toBe(true);
    // X edges: never.
    const nw = corner(s, 2, -2, 4); // quarry NW corner (has a path)
    s = setPieces(s, 'p0', { settlements: [nw], roads: [] });
    const xNw = hexEdge(s, 2, -2, 4);
    expect(q.xEdges).toContain(xNw);
    expect(canConnectRoad(s, 'p0', xNw)).toBe(false);
    expect(canPlaceInitialRoad(s, nw, xNw)).toBe(false);
  });

  it('blocks starting settlements on commodity corners between two X edges', () => {
    const s = newGame();
    for (const [q, r, c] of [[2, -2, 5], [2, -2, 0], [-2, 0, 3], [-2, 0, 4], [0, 2, 1], [0, 2, 2]] as const) {
      expect(canPlaceInitialSettlement(s, corner(s, q, r, c))).toBe(false);
    }
    // A corner with a path is a normal spot.
    expect(canPlaceInitialSettlement(s, corner(s, 2, -2, 4))).toBe(true);
  });

  it('roads may go on barbarian edges', () => {
    let s = clearBoard(mainPhase());
    const barb = s.tradersBarbarians.barbarians[0]!;
    const end = s.board.edges[barb]!.vertices[0];
    s = setPieces(s, 'p0', { settlements: [end] });
    expect(canConnectRoad(s, 'p0', barb)).toBe(true);
  });

  it('makes the second setup placement a city with the wagon on it', () => {
    const s = runSetupPhase(newGame());
    for (const p of s.players) {
      expect(p.settlements).toHaveLength(1);
      expect(p.cities).toHaveLength(1);
      expect(s.tradersBarbarians!.wagons[p.id]).toEqual({
        vertex: p.cities[0],
        level: 1,
        cargo: null,
        delivered: 0,
      });
    }
  });
});

describe('Traders & Barbarians scenario — production', () => {
  it('re-rolls a 2 or a 12 with the seeded RNG', () => {
    const base = runSetupPhase(newGame(5));
    for (const dice of [[1, 1], [6, 6]] as Array<[number, number]>) {
      const s = applyAction(base, { type: 'rollDice', playerId: 'p0', dice });
      const total = s.lastRoll!.total;
      expect(total).not.toBe(2);
      expect(total).not.toBe(12);
      const ev = s.tradersBarbarians!.lastEvents!.events[0]!;
      expect(ev.kind).toBe('reroll');
      if (ev.kind === 'reroll') expect(ev.rerolled[0]).toEqual(dice);
      // Same input, same result (deterministic for every peer).
      const again = applyAction(base, { type: 'rollDice', playerId: 'p0', dice });
      expect(again.lastRoll).toEqual(s.lastRoll);
    }
  });

  it('a 7 moves a barbarian (after discards) and robs the road owner', () => {
    let s = clearBoard(runSetupPhase(newGame()));
    const target = sharedEdge(s, '0,0', '1,0');
    const end = s.board.edges[target]!.vertices[0];
    s = setPieces(s, 'p1', { settlements: [end], roads: [target] });
    s = giveResources(s, 'p1', { ore: 1 }) as TradersBarbariansGame;
    s = giveResources(s, 'p2', { wood: 8 }) as TradersBarbariansGame;
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] }) as TradersBarbariansGame;
    expect(s.phase).toBe('discard');
    s = applyAction(s, { type: 'discard', playerId: 'p2', resources: { wood: 4 } }) as TradersBarbariansGame;
    expect(s.phase).toBe('moveBarbarian');
    expect(s.tradersBarbarians.pendingBarbarian).toMatchObject({ playerId: 'p0', reason: 'seven', returnTo: 'main' });
    // Can't stack barbarians or "move" one onto its own edge.
    const occupied = s.tradersBarbarians.barbarians[1]!;
    expect(() => applyAction(s, { type: 'moveTbBarbarian', playerId: 'p0', barbarian: 0, edge: occupied })).toThrow();
    expect(() =>
      applyAction(s, { type: 'moveTbBarbarian', playerId: 'p0', barbarian: 0, edge: s.tradersBarbarians.barbarians[0]! }),
    ).toThrow();
    s = applyAction(s, { type: 'moveTbBarbarian', playerId: 'p0', barbarian: 0, edge: target }) as TradersBarbariansGame;
    expect(s.phase).toBe('main');
    expect(s.tradersBarbarians.barbarians[0]).toBe(target);
    expect(s.players.find((p) => p.id === 'p0')!.resources.ore).toBe(1);
    expect(s.players.find((p) => p.id === 'p1')!.resources.ore).toBe(0);
    const ev = s.tradersBarbarians.lastEvents!.events[0]!;
    expect(ev).toMatchObject({ kind: 'barbarianMoved', victim: 'p1', stole: true, reason: 'seven' });
  });

  it('a barbarian on an empty edge or your own road steals nothing', () => {
    let s = clearBoard(runSetupPhase(newGame()));
    const own = sharedEdge(s, '0,0', '1,0');
    s = setPieces(s, 'p0', { roads: [own] });
    s = giveResources(s, 'p0', { ore: 1 }) as TradersBarbariansGame;
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] }) as TradersBarbariansGame;
    s = applyAction(s, { type: 'moveTbBarbarian', playerId: 'p0', barbarian: 2, edge: own }) as TradersBarbariansGame;
    expect(s.players.find((p) => p.id === 'p0')!.resources.ore).toBe(1);
    const ev = s.tradersBarbarians.lastEvents!.events[0]!;
    expect(ev).toMatchObject({ kind: 'barbarianMoved' });
    if (ev.kind === 'barbarianMoved') expect(ev.victim).toBeUndefined();
  });

  it('barbarians may stand on any island edge without a barbarian', () => {
    const s = newGame();
    const targets = barbarianTargetEdges(s);
    for (const b of s.tradersBarbarians.barbarians) expect(targets).not.toContain(b);
    expect(targets).toContain(loc(s, 'quarry').paths[0]);
    const seaOnly = Object.values(s.board.edges).find((e) => e.hexes.every((h) => s.board.hexes[h]!.terrain === 'sea'))!;
    expect(targets).not.toContain(seaOnly.id);
  });
});

describe('Traders & Barbarians scenario — development cards', () => {
  it('buys from the scenario deck: Swift Journey into the scenario hand, VP counted at once', () => {
    let s = mainPhase();
    s = patchTb(s, () => ({ deck: ['knight', 'victoryPoint', 'swiftJourney'] }));
    s = giveResources(s, 'p0', { sheep: 3, wheat: 3, ore: 3 }) as TradersBarbariansGame;
    const vp0 = calculateVictoryPoints(s, 'p0', true);
    s = applyAction(s, { type: 'buyDevCard', playerId: 'p0' }) as TradersBarbariansGame;
    expect(s.tradersBarbarians.swiftJourney.p0).toEqual({ unplayed: 0, boughtThisTurn: 1 });
    s = applyAction(s, { type: 'buyDevCard', playerId: 'p0' }) as TradersBarbariansGame;
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(vp0 + 1);
    expect(calculateVictoryPoints(s, 'p0', false)).toBe(vp0);
    s = applyAction(s, { type: 'buyDevCard', playerId: 'p0' }) as TradersBarbariansGame;
    expect(s.players[0]!.devCards.boughtThisTurn).toEqual(['knight']);
    expect(s.tradersBarbarians.deck).toEqual([]);
    expect(() => applyAction(s, { type: 'buyDevCard', playerId: 'p0' })).toThrow();
    // A knight bought this turn can't be played.
    expect(() => applyAction(s, { type: 'playKnight', playerId: 'p0' })).toThrow();
  });

  it('Knight moves a barbarian and steals from the road owner; counts for Largest Army', () => {
    let s = clearBoard(mainPhase());
    const target = sharedEdge(s, '0,0', '0,-1');
    s = setPieces(s, 'p2', { roads: [target] });
    s = giveResources(s, 'p2', { brick: 1 }) as TradersBarbariansGame;
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, devCards: { ...p.devCards, unplayed: ['knight', 'knight'], playedKnights: 2 } } : p,
      ),
    };
    s = applyAction(s, { type: 'playKnight', playerId: 'p0' }) as TradersBarbariansGame;
    expect(s.phase).toBe('moveBarbarian');
    // The third knight takes Largest Army (+2 VP).
    expect(s.largestArmy?.holder).toBe('p0');
    expect(s.tradersBarbarians.pendingBarbarian).toMatchObject({ reason: 'knight', returnTo: 'main' });
    s = applyAction(s, { type: 'moveTbBarbarian', playerId: 'p0', barbarian: 1, edge: target }) as TradersBarbariansGame;
    expect(s.phase).toBe('main');
    expect(s.players[0]!.resources.brick).toBe(1);
    expect(s.players[0]!.devCards.playedKnights).toBe(3);
    // One development card per turn.
    expect(() => applyAction(s, { type: 'playKnight', playerId: 'p0' })).toThrow();
  });

  it('Knight may be played before the roll and while the wagon moves', () => {
    let s = runSetupPhase(newGame()) as TradersBarbariansGame;
    s = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, devCards: { ...p.devCards, unplayed: ['knight'] } } : p)) };
    let t = applyAction(s, { type: 'playKnight', playerId: 'p0' }) as TradersBarbariansGame;
    expect(t.tradersBarbarians.pendingBarbarian?.returnTo).toBe('rollOrPlayKnight');
    const free = barbarianTargetEdges(t)[0]!;
    t = applyAction(t, { type: 'moveTbBarbarian', playerId: 'p0', barbarian: 0, edge: free }) as TradersBarbariansGame;
    expect(t.phase).toBe('rollOrPlayKnight');
    // During the wagon phase.
    let w = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [1, 2] });
    w = toWagonPhase(w);
    w = applyAction(w, { type: 'playKnight', playerId: 'p0' });
    expect((w as TradersBarbariansGame).tradersBarbarians.pendingBarbarian?.returnTo).toBe('wagonMoves');
    w = applyAction(w, { type: 'moveTbBarbarian', playerId: 'p0', barbarian: 0, edge: free });
    expect(w.phase).toBe('wagonMoves');
  });
});

// A clean End of Turn fixture: p0 to move, empty board, wagon at `start`.
function wagonFixture(start: VertexId, level = 1, gold = 5): TradersBarbariansGame {
  let s = clearBoard(mainPhase());
  s = setWagon(s, 'p0', { vertex: start, level, cargo: null, delivered: 0 });
  s = setPieces(s, 'p0', { gold });
  // Park the barbarians far from the test area.
  s = patchTb(s, () => ({ barbarians: [] }));
  return toWagonPhase(s);
}

describe('Traders & Barbarians scenario — wagon movement', () => {
  it('starts the End of Turn phase with the wagon board MP', () => {
    for (const [level, mp] of [[1, 4], [2, 5], [3, 6], [4, 7], [5, 7]]) {
      const s = wagonFixture(corner(newGame(), 0, 0, 0), level);
      expect(s.tradersBarbarians.wagonTurn!.mp).toBe(mp);
    }
  });

  it('costs 2 MP with no road, 1 on your road, 1 + 1 gold on a rival road, +2 with a barbarian', () => {
    let s = wagonFixture(corner(newGame(), 0, 0, 0));
    const a = corner(s, 0, 0, 0); // NE
    const b = corner(s, 0, 0, 1); // SE
    const c = corner(s, 0, 0, 2); // S
    const ab = edgeKey(a, b);
    const bc = edgeKey(b, c);
    expect(wagonEdgeCost(s, 'p0', ab)).toEqual({ mp: 2, toll: null });
    s = setPieces(s, 'p0', { roads: [ab] });
    s = setPieces(s, 'p1', { roads: [bc] });
    expect(wagonEdgeCost(s, 'p0', ab)).toEqual({ mp: 1, toll: null });
    expect(wagonEdgeCost(s, 'p0', bc)).toEqual({ mp: 1, toll: 'p1' });
    s = patchTb(s, () => ({ barbarians: [ab] }));
    expect(wagonEdgeCost(s, 'p0', ab)).toEqual({ mp: 3, toll: null });
    s = patchTb(s, () => ({ barbarians: [] }));
    s = applyAction(s, { type: 'moveWagon', playerId: 'p0', to: b }) as TradersBarbariansGame;
    expect(s.tradersBarbarians.wagonTurn!.mp).toBe(3);
    s = applyAction(s, { type: 'moveWagon', playerId: 'p0', to: c }) as TradersBarbariansGame;
    expect(s.tradersBarbarians.wagonTurn!.mp).toBe(2);
    expect(s.players.find((p) => p.id === 'p0')!.gold).toBe(4);
    expect(s.players.find((p) => p.id === 'p1')!.gold).toBe(6);
    expect(s.tradersBarbarians.wagons.p0!.vertex).toBe(c);
  });

  it('must afford the whole edge, and the toll', () => {
    let s = wagonFixture(corner(newGame(), 0, 0, 0), 1, 0);
    const a = corner(s, 0, 0, 0);
    const b = corner(s, 0, 0, 1);
    const c = corner(s, 0, 0, 2);
    const d = corner(s, 0, 0, 3);
    s = setPieces(s, 'p1', { roads: [edgeKey(b, c)] });
    s = applyAction(s, { type: 'moveWagon', playerId: 'p0', to: b }) as TradersBarbariansGame; // 2 left
    // No gold: the rival road is closed.
    expect(legalWagonSteps(s, 'p0').map((x) => x.to)).not.toContain(c);
    expect(() => applyAction(s, { type: 'moveWagon', playerId: 'p0', to: c })).toThrow();
    s = applyAction(s, { type: 'moveWagon', playerId: 'p0', to: a }) as TradersBarbariansGame; // back, 0 left
    expect(s.tradersBarbarians.wagonTurn!.mp).toBe(0);
    expect(legalWagonSteps(s, 'p0')).toEqual([]);
    expect(() => applyAction(s, { type: 'moveWagon', playerId: 'p0', to: b })).toThrow();
    // Not along a non-edge.
    expect(() => applyAction(s, { type: 'moveWagon', playerId: 'p0', to: d })).toThrow();
  });

  it('spends 1 wheat for +2 MP once per move action', () => {
    let s = wagonFixture(corner(newGame(), 0, 0, 0));
    s = giveResources(s, 'p0', { wheat: 2 }) as TradersBarbariansGame;
    s = applyAction(s, { type: 'boostWagon', playerId: 'p0' }) as TradersBarbariansGame;
    expect(s.tradersBarbarians.wagonTurn!.mp).toBe(6);
    expect(s.players[0]!.resources.wheat).toBe(1);
    expect(() => applyAction(s, { type: 'boostWagon', playerId: 'p0' })).toThrow();
  });

  it('entering a plaza ends the move, delivers a wanted token for VP + gold, then picks up', () => {
    const g = newGame();
    const q = loc(g, 'quarry');
    const path = q.paths[0]!;
    const start = g.board.edges[path]!.vertices.find((v) => v !== q.plaza)!;
    let s = wagonFixture(start, 3);
    s = setWagon(s, 'p0', { cargo: { good: 'tools', from: 'castle' } });
    s = patchTb(s, (tb) => ({
      locations: tb.locations.map((l) => (l.id === 'quarry' ? { ...l, stack: ['sand', 'marble'] } : l)),
    }));
    const vp0 = calculateVictoryPoints(s, 'p0', true);
    s = applyAction(s, { type: 'moveWagon', playerId: 'p0', to: q.plaza }) as TradersBarbariansGame;
    expect(s.tradersBarbarians.wagonTurn!.ended).toBe(true);
    expect(s.tradersBarbarians.wagons.p0).toMatchObject({
      vertex: q.plaza,
      delivered: 1,
      cargo: { good: 'marble', from: 'quarry' },
    });
    expect(s.players[0]!.gold).toBe(5 + 3); // level 3 pays 3
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(vp0 + 1);
    expect(loc(s, 'quarry').stack).toEqual(['sand']);
    // Move over even with MP left.
    expect(legalWagonSteps(s, 'p0')).toEqual([]);
    expect(() => applyAction(s, { type: 'moveWagon', playerId: 'p0', to: start })).toThrow();
    const kinds = s.tradersBarbarians.lastEvents!.events.map((e) => e.kind);
    expect(kinds).toEqual(['deliver', 'pickUp']);
  });

  it('a token the location does not want stays on the wagon (carry max 1)', () => {
    const g = newGame();
    const q = loc(g, 'quarry');
    const start = g.board.edges[q.paths[0]!]!.vertices.find((v) => v !== q.plaza)!;
    let s = wagonFixture(start);
    s = setWagon(s, 'p0', { cargo: { good: 'glass', from: 'glassworks' } });
    const before = loc(s, 'quarry').stack.length;
    s = applyAction(s, { type: 'moveWagon', playerId: 'p0', to: q.plaza }) as TradersBarbariansGame;
    expect(s.tradersBarbarians.wagons.p0).toMatchObject({ delivered: 0, cargo: { good: 'glass' } });
    expect(loc(s, 'quarry').stack).toHaveLength(before);
  });

  it('an empty stack leaves the wagon empty', () => {
    const g = newGame();
    const q = loc(g, 'quarry');
    const start = g.board.edges[q.paths[0]!]!.vertices.find((v) => v !== q.plaza)!;
    let s = wagonFixture(start);
    s = patchTb(s, (tb) => ({ locations: tb.locations.map((l) => (l.id === 'quarry' ? { ...l, stack: [] } : l)) }));
    s = applyAction(s, { type: 'moveWagon', playerId: 'p0', to: q.plaza }) as TradersBarbariansGame;
    expect(s.tradersBarbarians.wagons.p0!.cargo).toBeNull();
    expect(s.tradersBarbarians.lastEvents!.events.map((e) => e.kind)).toEqual(['stackEmpty']);
  });

  it('leaves the plaza next turn along any path', () => {
    const g = newGame();
    const q = loc(g, 'quarry');
    const s = wagonFixture(q.plaza);
    const steps = legalWagonSteps(s, 'p0');
    expect(steps.map((x) => x.edge).sort()).toEqual([...q.paths].sort());
  });

  it('a second endTurn passes the turn', () => {
    const s = wagonFixture(corner(newGame(), 0, 0, 0));
    const t = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(t.phase).toBe('rollOrPlayKnight');
    expect(t.currentPlayerIndex).toBe(1);
    expect(t.tradersBarbarians!.wagonTurn).toBeUndefined();
  });

  it('wins with 13 VP reached by a delivery during the End of Turn phase', () => {
    const g = newGame();
    const q = loc(g, 'quarry');
    const start = g.board.edges[q.paths[0]!]!.vertices.find((v) => v !== q.plaza)!;
    let s = wagonFixture(start);
    // Buildings on the board are cleared: give 12 VP of deliveries.
    s = setWagon(s, 'p0', { delivered: 12, cargo: { good: 'tools', from: 'castle' } });
    expect(s.phase).toBe('wagonMoves');
    s = applyAction(s, { type: 'moveWagon', playerId: 'p0', to: q.plaza }) as TradersBarbariansGame;
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe('p0');
  });
});

describe('Traders & Barbarians scenario — drive off', () => {
  function driveFixture(level: number, seed = 1): TradersBarbariansGame {
    const g = newGame(seed);
    const a = corner(g, 0, 0, 0);
    let s = wagonFixture(a, level);
    s = patchTb(s, () => ({ barbarians: [edgeKey(a, corner(g, 0, 0, 1)), sharedEdge(g, '-1,1', '-1,2')] }));
    return s;
  }

  it('needs an upgraded wagon next to the barbarian', () => {
    const s = driveFixture(1);
    expect(driveOffTargets(s, 'p0')).toEqual([]);
    expect(() => applyAction(s, { type: 'driveOffBarbarian', playerId: 'p0', barbarian: 0 })).toThrow();
    const up = driveFixture(2);
    expect(driveOffTargets(up, 'p0')).toEqual([0]);
    expect(() => applyAction(up, { type: 'driveOffBarbarian', playerId: 'p0', barbarian: 1 })).toThrow();
  });

  it('rolls the seeded die against the level range, once per barbarian per turn', () => {
    let successes = 0;
    let failures = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = { ...driveFixture(3), rngState: seed * 7919 };
      const t = applyAction(s, { type: 'driveOffBarbarian', playerId: 'p0', barbarian: 0 }) as TradersBarbariansGame;
      const ev = t.tradersBarbarians.lastEvents!.events[0]!;
      if (ev.kind !== 'driveOff') throw new Error('expected a driveOff event');
      expect(ev.success).toBe(ev.die >= 5);
      if (ev.success) {
        successes++;
        expect(t.phase).toBe('moveBarbarian');
        expect(t.tradersBarbarians.pendingBarbarian).toMatchObject({ reason: 'driveOff', barbarian: 0, returnTo: 'wagonMoves' });
        // Only that barbarian may move, and nobody is robbed.
        const free = barbarianTargetEdges(t)[0]!;
        expect(() => applyAction(t, { type: 'moveTbBarbarian', playerId: 'p0', barbarian: 1, edge: free })).toThrow();
        const after = applyAction(t, { type: 'moveTbBarbarian', playerId: 'p0', barbarian: 0, edge: free }) as TradersBarbariansGame;
        expect(after.phase).toBe('wagonMoves');
        expect(driveOffTargets(after, 'p0')).toEqual([]);
      } else {
        failures++;
        expect(t.phase).toBe('wagonMoves');
        expect(() => applyAction(t, { type: 'driveOffBarbarian', playerId: 'p0', barbarian: 0 })).toThrow();
        // The wagon keeps moving as normal (3 MP across the barbarian's edge).
        expect(legalWagonSteps(t, 'p0').find((x) => x.to === corner(t, 0, 0, 1))?.mp).toBe(4);
      }
    }
    expect(successes).toBeGreaterThan(0);
    expect(failures).toBeGreaterThan(0);
  });
});

describe('Traders & Barbarians scenario — wagon upgrades and Swift Journey', () => {
  it('upgrades through the four costs; level 5 is worth 1 VP', () => {
    let s = mainPhase();
    const vp0 = calculateVictoryPoints(s, 'p0', true);
    for (let level = 1; level < 5; level++) {
      expect(() => applyAction(s, { type: 'upgradeWagon', playerId: 'p0' })).toThrow();
      s = giveResources(s, 'p0', TB_WAGON_UPGRADE_COSTS[level]!) as TradersBarbariansGame;
      const before = s.players[0]!.resources;
      s = applyAction(s, { type: 'upgradeWagon', playerId: 'p0' }) as TradersBarbariansGame;
      expect(s.tradersBarbarians.wagons.p0!.level).toBe(level + 1);
      expect(s.players[0]!.resources.wood).toBe(before.wood - (TB_WAGON_UPGRADE_COSTS[level]!.wood ?? 0));
    }
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(vp0 + 1);
    s = giveResources(s, 'p0', { wood: 2, sheep: 1, ore: 1 }) as TradersBarbariansGame;
    expect(() => applyAction(s, { type: 'upgradeWagon', playerId: 'p0' })).toThrow();
  });

  it('upgrades only in the Action phase', () => {
    const s = giveResources(wagonFixture(corner(newGame(), 0, 0, 0)), 'p0', { wood: 1, sheep: 1, ore: 1 });
    expect(() => applyAction(s, { type: 'upgradeWagon', playerId: 'p0' })).toThrow();
  });

  it('Swift Journey grants a second move with full MP (and another wheat boost), once', () => {
    let s = wagonFixture(corner(newGame(), 0, 0, 0), 2);
    s = patchTb(s, (tb) => ({ swiftJourney: { ...tb.swiftJourney, p0: { unplayed: 2, boughtThisTurn: 0 } } }));
    s = giveResources(s, 'p0', { wheat: 2 }) as TradersBarbariansGame;
    s = applyAction(s, { type: 'boostWagon', playerId: 'p0' }) as TradersBarbariansGame;
    s = applyAction(s, { type: 'moveWagon', playerId: 'p0', to: corner(s, 0, 0, 1) }) as TradersBarbariansGame;
    s = applyAction(s, { type: 'playSwiftJourney', playerId: 'p0' }) as TradersBarbariansGame;
    expect(s.tradersBarbarians.wagonTurn).toMatchObject({ mp: 5, moveAction: 2, boosted: false, swiftJourney: true });
    expect(s.hasPlayedDevCardThisTurn).toBe(true);
    s = applyAction(s, { type: 'boostWagon', playerId: 'p0' }) as TradersBarbariansGame;
    expect(s.tradersBarbarians.wagonTurn!.mp).toBe(7);
    expect(() => applyAction(s, { type: 'playSwiftJourney', playerId: 'p0' })).toThrow();
  });

  it('a Swift Journey bought this turn waits for the next turn', () => {
    let s = mainPhase();
    s = patchTb(s, () => ({ deck: ['swiftJourney'] }));
    s = giveResources(s, 'p0', { sheep: 1, wheat: 1, ore: 1 }) as TradersBarbariansGame;
    s = applyAction(s, { type: 'buyDevCard', playerId: 'p0' }) as TradersBarbariansGame;
    s = toWagonPhase(s);
    expect(() => applyAction(s, { type: 'playSwiftJourney', playerId: 'p0' })).toThrow();
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' }) as TradersBarbariansGame;
    expect(s.tradersBarbarians.swiftJourney.p0).toEqual({ unplayed: 1, boughtThisTurn: 0 });
  });
});
