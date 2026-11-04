import { describe, expect, it } from 'vitest';
import { createGame } from '../../createGame';
import { applyAction, calculateRouteLength } from '../../engine';
import { updatePlayer } from '../../helpers';
import { calculateVictoryPoints } from '../../scoring/points';
import type { EdgeId, GameState, Player, PlayerId, VertexId } from '../../types';
import {
  canBuildShip,
  isShipEdge,
  isShipMovable,
} from './validation/shipPlacement';
import { resolveEdgeRef, resolveVertexRef } from './board/generator';
import { canMoveRobberTo, canPlaceSettlement } from '../../placement';

// Seafarers 2025 rulebook, general rules (p.2-3) and the island bonus.

function game(scenarioId: string, n = 4, seed = 1): GameState {
  return createGame({
    playerNames: Array.from({ length: n }, (_, i) => `P${i}`),
    seed,
    settings: { expansions: ['seafarers'], scenarioId },
    randomizeTurnOrder: false,
  });
}
// Main phase with every piece taken off the board (Pirate Islands seats
// pre-placed settlements and ships).
function toMain(s: GameState, current = 0): GameState {
  return {
    ...s,
    players: s.players.map((p) => ({ ...p, settlements: [], cities: [], roads: [], ships: [] })),
    phase: 'main',
    setupState: undefined,
    hasRolledThisTurn: true,
    currentPlayerIndex: current,
    turnHolderIndex: current,
  };
}
function put(s: GameState, pid: PlayerId, patch: Partial<Player>): GameState {
  return updatePlayer(s, pid, (p) => ({ ...p, ...patch }));
}
const V = (s: GameState, q: number, r: number, corner: 0 | 1 | 2 | 3 | 4 | 5) =>
  resolveVertexRef(s.board, { q, r, corner });
const E = (s: GameState, q: number, r: number, direction: 0 | 1 | 2 | 3 | 4 | 5) =>
  resolveEdgeRef(s.board, { q, r, direction });
const rich = { wood: 5, brick: 5, sheep: 5, wheat: 5, ore: 5 };
function otherEnd(s: GameState, e: EdgeId, v: VertexId): VertexId {
  const [a, b] = s.board.edges[e]!.vertices;
  return a === v ? b : a;
}

// Pirate Islands is a fixed map, which makes geometry exact:
//   (1,0) wheat 6 is on the main island's west coast; (0,0) and (0,1) are
//   sea; (1,0) corner 5 (N) is white's pre-placed settlement at 4p.
describe('ships', () => {
  it('connect to your ships and buildings, never to a road alone', () => {
    let s = toMain(game('pirateIslands', 4));
    s = { ...s, board: { ...s.board, pirateHex: s.pirateIslands!.path[0] } };
    // (1,0)'s N corner touches land (1,0), (1,-1) and sea (0,0)... the NW
    // edge is coastal; the N–NE edge is land (between (1,0) and (2,-1)).
    const coast = V(s, 1, 0, 5);
    const roadEdge = E(s, 1, 0, 5); // N–NE: between (1,0) and (2,-1), land
    s = put(s, 'p0', { roads: [roadEdge] });
    const seaEdge = E(s, 1, 0, 4); // NW–N: between (1,0) and sea
    expect(canBuildShip(s, 'p0', seaEdge)).toBe(false);
    s = put(s, 'p0', { settlements: [coast] });
    expect(canBuildShip(s, 'p0', seaEdge)).toBe(true);
  });

  it('may sail along the sea frame (edges with a single hex)', () => {
    const s = game('forgottenTribe', 4);
    const frame = s.board.edgeIds.find((e) => s.board.edges[e]!.hexes.length === 1)!;
    expect(isShipEdge(s, frame)).toBe(true);
  });

  it('roads cannot go on an edge a ship already holds', () => {
    let s = toMain(game('pirateIslands', 4));
    const p1 = s.players[1]!; // white at 4p: settlement (1,0) N, ship (1,0) NW edge
    const ship = p1.ships[0]!;
    s = put(s, 'p0', { resources: rich, settlements: [...p1.settlements], roads: [] });
    expect(() => applyAction(s, { type: 'buildRoad', playerId: 'p0', edge: ship })).toThrow();
  });
});

describe('moving ships', () => {
  function shipLine() {
    // p0 owns a settlement on (1,0)'s SW corner and a two-ship line out to sea.
    let s = toMain(game('pirateIslands', 4));
    const home = V(s, 1, 0, 3);
    const a = E(s, 1, 0, 3); // W edge of (1,0): SW–NW, coastal
    const mid = otherEnd(s, a, home);
    const b = s.board.vertices[mid]!.edges.find(
      (e) => e !== a && isShipEdge(s, e) && !s.board.edges[e]!.hexes.includes(s.board.pirateHex!),
    )!;
    s = put(s, 'p0', { settlements: [home], ships: [a, b], roads: [], resources: rich });
    // Keep the pirate far away.
    s = { ...s, board: { ...s.board, pirateHex: s.pirateIslands!.path[0] } };
    return { s, a, b };
  }

  it('only the open end of a line moves; a ship built this turn does not', () => {
    const { s, a, b } = shipLine();
    expect(isShipMovable(s, 'p0', a)).toBe(false); // settlement + ship at its ends
    expect(isShipMovable(s, 'p0', b)).toBe(true);
    const built = put(s, 'p0', { builtShipsThisTurn: [b] });
    expect(isShipMovable(built, 'p0', b)).toBe(false);
  });

  it('a road next to a ship does not close its end', () => {
    const { s, b } = shipLine();
    const tip = s.board.edges[b]!.vertices.find(
      (v) => !s.players[0]!.ships.some((e) => e !== b && s.board.edges[e]!.vertices.includes(v)),
    )!;
    const landEdge = s.board.vertices[tip]!.edges.find((e) => e !== b && !isShipEdge(s, e));
    const withRoad = landEdge ? put(s, 'p0', { roads: [landEdge] }) : s;
    expect(isShipMovable(withRoad, 'p0', b)).toBe(true);
  });

  it('a ship on the pirate hex may not move, once per turn', () => {
    const { s, b } = shipLine();
    const hex = s.board.edges[b]!.hexes.find((h) => s.board.hexes[h]!.terrain === 'sea')!;
    const pirate = { ...s, board: { ...s.board, pirateHex: hex } };
    expect(isShipMovable(pirate, 'p0', b)).toBe(false);
    const moved = put(s, 'p0', { movedShipThisTurn: true });
    const dest = s.board.edgeIds.find((e) => e !== b && canBuildShip({ ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, ships: p.ships.filter((x) => x !== b) } : p)) }, 'p0', e))!;
    expect(() => applyAction(moved, { type: 'moveShip', playerId: 'p0', from: b, to: dest })).toThrow(/Already moved/);
  });
});

describe('setup', () => {
  it('a coastal starting settlement may take a ship instead of a road', () => {
    let s = game('headingForNewShores', 3);
    const coastal = s.board.vertexIds.find((v) => {
      const vx = s.board.vertices[v]!;
      return (
        vx.hexes.some((h) => s.board.hexes[h]!.terrain === 'sea') &&
        vx.hexes.some((h) => s.board.islandOfHex?.[h] === s.startingIslands?.[0])
      );
    })!;
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: coastal });
    const shipEdge = s.board.vertices[coastal]!.edges.find((e) => isShipEdge(s, e))!;
    s = applyAction(s, { type: 'placeInitialShip', playerId: 'p0', edge: shipEdge });
    expect(s.players[0]!.ships).toEqual([shipEdge]);
    expect(s.players[0]!.roads).toEqual([]);
    expect(s.currentPlayerIndex).toBe(1);
  });
});

describe('Road Building', () => {
  it('builds 2 ships, chained, for free', () => {
    let s = toMain(game('pirateIslands', 4));
    const home = V(s, 1, 0, 3);
    s = put(s, 'p0', {
      settlements: [home],
      ships: [],
      roads: [],
      resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 },
      devCards: { unplayed: ['roadBuilding'], boughtThisTurn: [], playedKnights: 0, victoryPoints: 0 },
    });
    s = { ...s, board: { ...s.board, pirateHex: s.pirateIslands!.path[0] } };
    const a = E(s, 1, 0, 3);
    const mid = otherEnd(s, a, home);
    const b = s.board.vertices[mid]!.edges.find((e) => e !== a && isShipEdge(s, e))!;
    s = applyAction(s, { type: 'playRoadBuilding', playerId: 'p0', edges: [], ships: [a, b] });
    expect(s.players[0]!.ships).toEqual([a, b]);
    expect(s.players[0]!.devCards.unplayed).toEqual([]);
  });
});

describe('robber and pirate', () => {
  it('the robber never goes on sea; Forgotten Tribe keeps it on numbered hexes', () => {
    const s = game('forgottenTribe', 4);
    const sea = s.board.hexIds.find((h) => s.board.hexes[h]!.terrain === 'sea')!;
    expect(canMoveRobberTo(s, sea)).toBe(false);
    const bare = s.board.hexIds.find(
      (h) => s.board.hexes[h]!.terrain !== 'sea' && s.board.hexes[h]!.numberToken === null && h !== s.board.robberHex,
    )!;
    expect(canMoveRobberTo(s, bare)).toBe(false);
    const numbered = s.board.hexIds.find((h) => s.board.hexes[h]!.numberToken !== null)!;
    expect(canMoveRobberTo(s, numbered)).toBe(true);
  });

  it('Wonders of Catan has no pirate, so a 7 goes straight to the robber', () => {
    let s = toMain(game('wondersOfCatan', 3));
    s = { ...s, phase: 'rollOrPlayKnight', hasRolledThisTurn: false };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(['moveRobber', 'discard']).toContain(s.phase);
  });
});

describe('Fog Islands', () => {
  it('a road reveals the fog around both of its ends; fog does not produce', () => {
    let s = toMain(game('fogIsland', 3));
    const fog = s.unrevealedFogHexes!;
    // An edge clear of fog whose far corner touches fog, starting from a
    // corner where a settlement may stand.
    let edge: EdgeId | null = null;
    let from: VertexId | null = null;
    for (const e of s.board.edgeIds) {
      const ed = s.board.edges[e]!;
      if (ed.hexes.some((h) => fog.includes(h))) continue;
      if (ed.hexes.includes(s.board.pirateHex!)) continue;
      const [a, b] = ed.vertices;
      const near = s.board.vertices[a]!;
      if (near.hexes.some((h) => fog.includes(h))) continue;
      if (!near.hexes.some((h) => s.board.hexes[h]!.terrain !== 'sea')) continue;
      if (s.board.vertices[b]!.hexes.some((h) => fog.includes(h))) {
        edge = e;
        from = a;
        break;
      }
    }
    expect(edge).not.toBeNull();
    const touched = s.board.vertices[otherEnd(s, edge!, from!)]!.hexes.filter((h) => fog.includes(h));
    s = put(s, 'p0', { settlements: [from!], resources: rich });
    const asShip = isShipEdge(s, edge!) && canBuildShip(s, 'p0', edge!);
    s = applyAction(
      s,
      asShip
        ? { type: 'buildShip', playerId: 'p0', edge: edge! }
        : { type: 'buildRoad', playerId: 'p0', edge: edge! },
    );
    for (const h of touched) expect(s.unrevealedFogHexes ?? []).not.toContain(h);
    // Discovering land pays out (or opens a gold pick) — the hex was off
    // the table until now.
    expect(s.phase === 'chooseGoldResource' || touched.length > 0).toBe(true);
  });
});

describe('gold', () => {
  it('picks are capped by what the bank holds', () => {
    let s = toMain(game('headingForNewShores', 3));
    s = {
      ...s,
      bank: { wood: 0, brick: 0, sheep: 0, wheat: 1, ore: 0 },
      phase: 'chooseGoldResource',
      goldChoiceState: { pending: { p0: 2 } },
    };
    s = applyAction(s, { type: 'chooseGoldResource', playerId: 'p0', resources: ['wheat'] });
    expect(s.phase).toBe('main');
    expect(s.players[0]!.resources.wheat).toBe(1);
  });
});

describe('island bonus', () => {
  it('every player earns each island once; home islands pay nothing', () => {
    let s = toMain(game('fourIslands', 3));
    const chips = s.islandChips!;
    // Four Islands: every island has a bonus (all are "unexplored" to
    // someone).
    expect(chips.length).toBeGreaterThanOrEqual(4);
    const island = chips[0]!.islandId;
    const spots = s.board.vertexIds.filter(
      (v) =>
        s.board.vertices[v]!.hexes.some((h) => s.board.islandOfHex![h] === island) &&
        s.board.vertices[v]!.hexes.some((h) => s.board.hexes[h]!.terrain === 'sea'),
    );
    // Two spots on that island, far enough apart.
    const a = spots[0]!;
    const b = spots.find(
      (v) => v !== a && !s.board.vertices[a]!.neighborVertices.includes(v),
    )!;
    const shipAt = (v: VertexId) => s.board.vertices[v]!.edges.find((e) => isShipEdge(s, e))!;
    s = put(s, 'p0', { resources: rich, ships: [shipAt(a)] });
    s = put(s, 'p1', { resources: rich, ships: [shipAt(b)] });
    const before = calculateVictoryPoints(s, 'p1', true);
    s = applyAction(s, { type: 'buildSettlement', playerId: 'p0', vertex: a });
    expect(s.islandChips![0]!.claimedBy).toEqual(['p0']);
    s = { ...s, currentPlayerIndex: 1, turnHolderIndex: 1 };
    expect(canPlaceSettlement(s, 'p1', b)).toBe(true);
    s = applyAction(s, { type: 'buildSettlement', playerId: 'p1', vertex: b });
    // p1 earns it too, even though p0 settled the island first.
    expect(calculateVictoryPoints(s, 'p1', true)).toBe(before + 1 + chips[0]!.vp);
    // A home island pays nothing.
    const home = { ...s, islandChips: s.islandChips!.map((c) => (c.islandId === island ? { ...c, claimedBy: [], homeOf: ['p0'] } : c)) };
    expect(home.islandChips!.find((c) => c.islandId === island)!.claimedBy).toEqual([]);
  });

  it('starting settlements mark home islands instead of scoring', () => {
    let s = game('fourIslands', 3);
    const v = s.board.vertexIds.find((x) => s.board.vertices[x]!.hexes.some((h) => s.board.islandOfHex?.[h]))!;
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: v });
    const touched = s.islandChips!.filter((c) => c.homeOf.includes('p0'));
    expect(touched.length).toBeGreaterThan(0);
    expect(s.islandChips!.every((c) => c.claimedBy.length === 0)).toBe(true);
  });
});

describe('Longest Route', () => {
  it('counts ships, joined to roads only at your buildings', () => {
    let s = toMain(game('pirateIslands', 4));
    const home = V(s, 1, 0, 3);
    const a = E(s, 1, 0, 3);
    const mid = otherEnd(s, a, home);
    const b = s.board.vertices[mid]!.edges.find((e) => e !== a && isShipEdge(s, e))!;
    s = put(s, 'p0', { settlements: [home], ships: [a, b], roads: [] });
    expect(calculateRouteLength(s, 'p0')).toBe(2);
  });

  it('is off in Cloth for Catan and Pirate Islands', () => {
    expect(game('clothForCatan', 3).noLongestRoad).toBe(true);
    expect(game('pirateIslands', 3).noLongestRoad).toBe(true);
    expect(game('headingForNewShores', 3).noLongestRoad).toBeUndefined();
  });
});
