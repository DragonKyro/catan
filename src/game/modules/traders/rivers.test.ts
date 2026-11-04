import { describe, it, expect } from 'vitest';
import { createGame } from '../../createGame';
import { applyAction } from '../../engine';
import { calculateVictoryPoints } from '../../scoring/points';
import { calculateLongestRoad } from '../../scoring/longestRoad';
import { giveResources } from '../../__testHelpers';
import type { EdgeId, GameState, PlayerId, VertexId } from '../../types';

// Rivers of Catan rules (T&B 2025 rulebook p. 11-12), one test per rule.

function rivers(seed = 1): GameState {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed,
    settings: { expansions: ['traders'], tradersScenarioId: 'riversOfCatan' },
    randomizeTurnOrder: false,
  });
}

// p0's main phase with no pieces on the board (tests place what they need).
function mainPhase(s: GameState): GameState {
  return { ...s, phase: 'main', hasRolledThisTurn: true, setupState: undefined };
}

function corner(s: GameState, hex: string, i: number): VertexId {
  return s.board.hexes[hex]!.corners[i]!;
}

function edgeBetween(s: GameState, a: VertexId, b: VertexId): EdgeId {
  const e = s.board.vertices[a]!.edges.find((id) => s.board.edges[id]!.vertices.includes(b));
  if (!e) throw new Error(`no edge ${a}-${b}`);
  return e;
}

// Hex edge `d` (0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE).
function hexEdge(s: GameState, hex: string, d: number): EdgeId {
  return edgeBetween(s, corner(s, hex, d), corner(s, hex, (d + 1) % 6));
}

function place(
  s: GameState,
  pid: PlayerId,
  pieces: { settlements?: VertexId[]; cities?: VertexId[]; roads?: EdgeId[]; bridges?: EdgeId[] },
): GameState {
  return {
    ...s,
    players: s.players.map((p) =>
      p.id === pid
        ? {
            ...p,
            settlements: [...p.settlements, ...(pieces.settlements ?? [])],
            cities: [...p.cities, ...(pieces.cities ?? [])],
            roads: [...p.roads, ...(pieces.roads ?? [])],
            bridges: [...(p.bridges ?? []), ...(pieces.bridges ?? [])],
          }
        : p,
    ),
  };
}

function gold(s: GameState, pid: PlayerId): number {
  return s.players.find((p) => p.id === pid)!.gold ?? 0;
}

function withGold(s: GameState, golds: Record<PlayerId, number>): GameState {
  return {
    ...s,
    players: s.players.map((p) => (golds[p.id] !== undefined ? { ...p, gold: golds[p.id] } : p)),
  };
}

// The hex carrying both the 12 and the 2.
function doubleHex(s: GameState) {
  return Object.values(s.board.hexes).find((h) => (h.extraNumbers ?? []).includes(2))!;
}

describe('Rivers of Catan: the 2 + 12 hex', () => {
  it('produces on a 2 and on a 12', () => {
    let s = rivers();
    const hex = doubleHex(s);
    expect(hex.numberToken).toBe(12);
    const v = hex.corners[0]!;
    s = place({ ...s, phase: 'rollOrPlayKnight', setupState: undefined }, 'p0', { settlements: [v] });
    // The robber sits on a swamp, not here.
    expect(s.board.robberHex).not.toBe(hex.id);
    const res = hex.terrain as 'wood';
    const before = s.players[0]!.resources[res];
    const on2 = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [1, 1] });
    expect(on2.players[0]!.resources[res]).toBe(before + 1);
    const on12 = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [6, 6] });
    expect(on12.players[0]!.resources[res]).toBe(before + 1);
  });

  it('is blocked on both numbers by the robber', () => {
    let s = rivers();
    const hex = doubleHex(s);
    s = place({ ...s, phase: 'rollOrPlayKnight', setupState: undefined }, 'p0', {
      settlements: [hex.corners[0]!],
    });
    s = { ...s, board: { ...s.board, robberHex: hex.id } };
    const res = hex.terrain as 'wood';
    for (const dice of [[1, 1], [6, 6]] as Array<[number, number]>) {
      const after = applyAction(s, { type: 'rollDice', playerId: 'p0', dice });
      expect(after.players[0]!.resources[res]).toBe(0);
    }
  });
});

describe('Rivers of Catan: setup', () => {
  it('forbids a starting road on a bridge site', () => {
    let s = rivers();
    const v = corner(s, '1,0', 4); // an end of the (1,-1)|(1,0) bridge site
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: v });
    const site = edgeBetween(s, corner(s, '1,0', 4), corner(s, '1,0', 5));
    expect(s.riverEdges).toContain(site);
    expect(() => applyAction(s, { type: 'placeInitialRoad', playerId: 'p0', edge: site })).toThrow();
  });

  it('pays 1 gold for a starting settlement on a river-tile corner and 1 for a road on a river-tile edge', () => {
    let s = rivers();
    const v = corner(s, '-1,0', 5); // N corner of River A's hills
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: v });
    expect(gold(s, 'p0')).toBe(1);
    // The NE edge of (-1,0) is a river-tile edge (not a bridge site).
    const road = hexEdge(s, '-1,0', 5);
    expect(s.riverEdges).not.toContain(road);
    s = applyAction(s, { type: 'placeInitialRoad', playerId: 'p0', edge: road });
    expect(gold(s, 'p0')).toBe(2);
  });

  it('pays nothing for a starting settlement away from the rivers', () => {
    let s = rivers();
    // (1,-2) N corner touches only (1,-2) and the sea frame.
    const v = corner(s, '1,-2', 5);
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: v });
    expect(gold(s, 'p0')).toBe(0);
  });
});

describe('Rivers of Catan: gold for building', () => {
  it('pays 1 gold for a road on any river-tile edge and for a settlement on any river-tile corner', () => {
    let s = mainPhase(rivers());
    // p0 settles at River B hills' NE corner and builds down to the swamp.
    s = place(s, 'p0', { settlements: [corner(s, '1,0', 0)] });
    s = giveResources(s, 'p0', { wood: 3, brick: 3, sheep: 1, wheat: 1 });
    s = applyAction(s, { type: 'buildRoad', playerId: 'p0', edge: hexEdge(s, '1,0', 0) });
    expect(gold(s, 'p0')).toBe(1);
    s = applyAction(s, { type: 'buildRoad', playerId: 'p0', edge: hexEdge(s, '1,1', 5) });
    expect(gold(s, 'p0')).toBe(2);
    s = applyAction(s, { type: 'buildSettlement', playerId: 'p0', vertex: corner(s, '1,1', 0) });
    expect(gold(s, 'p0')).toBe(3);
  });

  it('pays no gold for a city', () => {
    let s = mainPhase(rivers());
    s = place(s, 'p0', { settlements: [corner(s, '1,0', 1)] });
    s = giveResources(s, 'p0', { wheat: 2, ore: 3 });
    s = applyAction(s, { type: 'buildCity', playerId: 'p0', vertex: corner(s, '1,0', 1) });
    expect(gold(s, 'p0')).toBe(0);
  });

  it('pays nothing for a road off the river tiles', () => {
    let s = mainPhase(rivers());
    const v = corner(s, '1,-2', 5);
    s = place(s, 'p0', { settlements: [v] });
    s = giveResources(s, 'p0', { wood: 1, brick: 1 });
    s = applyAction(s, { type: 'buildRoad', playerId: 'p0', edge: hexEdge(s, '1,-2', 5) });
    expect(gold(s, 'p0')).toBe(0);
  });
});

describe('Rivers of Catan: bridges (rulebook p. 12)', () => {
  // The bridge site between River B's mountains (1,-1) and hills (1,0).
  function site(s: GameState): EdgeId {
    return edgeBetween(s, corner(s, '1,0', 4), corner(s, '1,0', 5));
  }

  it('costs 2 brick + 1 lumber and pays 3 gold', () => {
    let s = mainPhase(rivers());
    s = place(s, 'p0', { settlements: [corner(s, '1,0', 4)] });
    s = giveResources(s, 'p0', { brick: 1, wood: 1 });
    expect(() => applyAction(s, { type: 'buildBridge', playerId: 'p0', edge: site(s) })).toThrow(/afford/);
    s = giveResources(s, 'p0', { brick: 1 });
    s = applyAction(s, { type: 'buildBridge', playerId: 'p0', edge: site(s) });
    expect(s.players[0]!.bridges).toEqual([site(s)]);
    expect(s.players[0]!.resources.brick).toBe(0);
    expect(s.players[0]!.resources.wood).toBe(0);
    expect(gold(s, 'p0')).toBe(3);
  });

  it('only goes on a bridge site, and roads never do', () => {
    let s = mainPhase(rivers());
    s = place(s, 'p0', { settlements: [corner(s, '1,0', 4)] });
    s = giveResources(s, 'p0', { brick: 4, wood: 4 });
    const notSite = hexEdge(s, '1,0', 3);
    expect(() => applyAction(s, { type: 'buildBridge', playerId: 'p0', edge: notSite })).toThrow(/bridge sites/);
    expect(() => applyAction(s, { type: 'buildRoad', playerId: 'p0', edge: site(s) })).toThrow(/Invalid road/);
  });

  it('must connect to your own road, bridge or building', () => {
    let s = mainPhase(rivers());
    s = place(s, 'p0', { settlements: [corner(s, '1,-2', 5)] });
    s = giveResources(s, 'p0', { brick: 2, wood: 1 });
    expect(() => applyAction(s, { type: 'buildBridge', playerId: 'p0', edge: site(s) })).toThrow(/Invalid bridge/);
  });

  it('may not be built past an opponent\'s settlement', () => {
    let s = mainPhase(rivers());
    const end = corner(s, '1,0', 5);
    // p0's road reaches the bridge site's N end, where p1 has settled.
    s = place(s, 'p1', { settlements: [end] });
    s = place(s, 'p0', { settlements: [corner(s, '1,0', 1)], roads: [hexEdge(s, '1,0', 0), hexEdge(s, '1,0', 5)] });
    s = giveResources(s, 'p0', { brick: 2, wood: 1 });
    expect(() => applyAction(s, { type: 'buildBridge', playerId: 'p0', edge: site(s) })).toThrow(/Invalid bridge/);
  });

  it('allows at most 3 bridges per player', () => {
    let s = mainPhase(rivers());
    const sites = s.riverEdges!;
    s = place(s, 'p0', { bridges: sites.slice(0, 3) });
    s = place(s, 'p0', { settlements: [s.board.edges[sites[3]!]!.vertices[0]] });
    s = giveResources(s, 'p0', { brick: 2, wood: 1 });
    expect(() => applyAction(s, { type: 'buildBridge', playerId: 'p0', edge: sites[3]! })).toThrow(/No bridges left/);
  });

  it('cannot be placed with Road Building', () => {
    let s = mainPhase(rivers());
    s = place(s, 'p0', { settlements: [corner(s, '1,0', 4)] });
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, devCards: { ...p.devCards, unplayed: ['roadBuilding'] } } : p,
      ),
    };
    expect(() =>
      applyAction(s, { type: 'playRoadBuilding', playerId: 'p0', edges: [site(s)] }),
    ).toThrow();
  });

  it('counts as a road for Longest Route, and roads can continue from it', () => {
    let s = mainPhase(rivers());
    s = place(s, 'p0', { settlements: [corner(s, '1,0', 3)], roads: [hexEdge(s, '1,0', 3)] });
    expect(calculateLongestRoad(s, 'p0')).toBe(1);
    s = place(s, 'p0', { bridges: [site(s)] });
    expect(calculateLongestRoad(s, 'p0')).toBe(2);
    s = giveResources(s, 'p0', { wood: 1, brick: 1 });
    s = applyAction(s, { type: 'buildRoad', playerId: 'p0', edge: hexEdge(s, '1,0', 5) });
    expect(calculateLongestRoad(s, 'p0')).toBe(3);
  });
});

describe('Rivers of Catan: wealth status', () => {
  it('gives Wealthiest (+1 VP) to the unique richest and Poor (-2 VP) to everyone tied for least', () => {
    let s = mainPhase(rivers());
    s = place(s, 'p0', { settlements: [corner(s, '1,0', 4)] });
    s = giveResources(s, 'p0', { brick: 2, wood: 1 });
    s = applyAction(s, { type: 'buildBridge', playerId: 'p0', edge: s.riverEdges!.find((e) => s.board.edges[e]!.vertices.includes(corner(s, '1,0', 4)))! });
    expect(s.wealthTiles).toEqual({ wealthiest: 'p0', poor: ['p1', 'p2'] });
    expect(calculateVictoryPoints(s, 'p0', false)).toBe(1 + 1);
    expect(calculateVictoryPoints(s, 'p1', false)).toBe(-2);
  });

  it('leaves Wealthiest with nobody on a tie', () => {
    let s = mainPhase(rivers());
    s = withGold(s, { p0: 3, p1: 3, p2: 1 });
    s = place(s, 'p2', { settlements: [corner(s, '1,0', 1)] });
    s = giveResources(s, 'p2', { brick: 2, wood: 2 });
    s = { ...s, currentPlayerIndex: 2 };
    s = applyAction(s, { type: 'buildRoad', playerId: 'p2', edge: hexEdge(s, '1,0', 0) });
    // p2 now 2 gold: still least.
    expect(s.wealthTiles).toEqual({ wealthiest: null, poor: ['p2'] });
  });
});

describe('Rivers of Catan: coins', () => {
  it('spends 2 gold for a resource of choice, at most twice a turn', () => {
    let s = withGold(mainPhase(rivers()), { p0: 7 });
    s = applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'ore' });
    s = applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'wheat' });
    expect(gold(s, 'p0')).toBe(3);
    expect(s.players[0]!.resources.ore).toBe(1);
    expect(s.players[0]!.resources.wheat).toBe(1);
    expect(() => applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'ore' })).toThrow(/2 times/);
  });

  it('resets the 2-per-turn count on the next turn', () => {
    let s = withGold(mainPhase(rivers()), { p0: 6, p1: 6 });
    s = applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'ore' });
    s = applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'ore' });
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    expect(s.goldSpendsThisTurn).toBeUndefined();
    s = applyAction(s, { type: 'rollDice', playerId: 'p1', dice: [1, 2] });
    s = applyAction(s, { type: 'spendGold', playerId: 'p1', resource: 'wood' });
    expect(gold(s, 'p1')).toBe(4);
  });

  it('needs 2 gold, and only on your own turn', () => {
    const s = withGold(mainPhase(rivers()), { p0: 1, p1: 5 });
    expect(() => applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'ore' })).toThrow(/2 gold/);
    expect(() => applyAction(s, { type: 'spendGold', playerId: 'p1', resource: 'ore' })).toThrow(/turn/);
  });

  it('buys 1 gold for 4 cards, 3 with a 3:1 harbor, 2 of the harbor resource with a 2:1', () => {
    let s = giveResources(mainPhase(rivers()), 'p0', { wood: 4, ore: 4 });
    s = applyAction(s, { type: 'buyGold', playerId: 'p0', give: 'wood' });
    expect(gold(s, 'p0')).toBe(1);
    expect(s.players[0]!.resources.wood).toBe(0);
    const generic = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: ['generic' as const] } : p)) };
    const g = applyAction(generic, { type: 'buyGold', playerId: 'p0', give: 'ore' });
    expect(g.players[0]!.resources.ore).toBe(1);
    const ore = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, ports: ['ore' as const] } : p)) };
    const o = applyAction(ore, { type: 'buyGold', playerId: 'p0', give: 'ore' });
    expect(o.players[0]!.resources.ore).toBe(2);
    expect(gold(o, 'p0')).toBe(2);
  });

  it('refuses to buy gold without enough cards', () => {
    const s = giveResources(mainPhase(rivers()), 'p0', { wood: 3 });
    expect(() => applyAction(s, { type: 'buyGold', playerId: 'p0', give: 'wood' })).toThrow(/need 4/);
  });

  it('keeps gold out of the hand size: no discard on a 7 for gold', () => {
    let s = withGold({ ...rivers(), phase: 'rollOrPlayKnight', setupState: undefined }, { p1: 20 });
    s = giveResources(s, 'p1', { wood: 7 });
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(s.discardState).toBeUndefined();
  });

  it('is not available in scenarios without coins', () => {
    const fishing = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 1,
      settings: { expansions: ['traders'], tradersScenarioId: 'fishingOnCatan' },
      randomizeTurnOrder: false,
    });
    const s = withGold(mainPhase(fishing), { p0: 4 });
    expect(() => applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'ore' })).toThrow(/Coins/);
  });
});
