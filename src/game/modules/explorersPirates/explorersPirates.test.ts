import { describe, expect, it } from 'vitest';
import { applyAction } from '../../engine';
import { calculateVictoryPoints } from '../../scoring/points';
import { canConnectRoad, canPlaceInitialSettlement, canPlaceSettlement } from '../../placement';
import { emptyBank } from '../../resources';
import { rollDie } from '../../rng';
import type { GameState, PlayerId, Terrain } from '../../types';
import {
  EP_LAIR_TOKENS,
  EP_REGION_DISCS,
  EP_START_ISLAND,
} from './board';
import { EP_COSTS, EP_DEFAULT_VP } from './constants';
import { exploreHex } from './explore';
import {
  battleReadyShips,
  bonusTileHolder,
  buildableShipEdges,
  canPlacePirateOn,
  chaseNumbers,
  harborsOf,
  legalShipSteps,
  shipBaseMp,
  shipById,
  type EpGame,
} from './state';
import {
  cornerOf,
  edgeOf,
  epGame,
  epMainPhase,
  patchEpState,
  putShip,
  runEpSetup,
  setHidden,
  setPlayer,
} from './testSupport';

// Strip every piece so a test can lay out exactly what it needs.
function bare(s: GameState): EpGame {
  const cleared = patchEpState(s, () => ({ ships: [], harbors: {} }));
  return {
    ...cleared,
    players: cleared.players.map((p) => ({ ...p, settlements: [], roads: [], resources: emptyBank(), gold: 0 })),
  } as EpGame;
}

function give(s: GameState, pid: PlayerId, res: Partial<Record<'wood' | 'brick' | 'sheep' | 'wheat' | 'ore', number>>): EpGame {
  return setPlayer(s, pid, {
    resources: { ...s.players.find((p) => p.id === pid)!.resources, ...res } as never,
  });
}

function toMovement(s: GameState): EpGame {
  return applyAction(s, { type: 'endTurn', playerId: s.playerOrder[s.currentPlayerIndex]! }) as EpGame;
}

// An rng state whose next die roll is `face`.
function rngRolling(face: number): number {
  for (let x = 1; x < 100000; x++) if (rollDie(x)[0] === face) return x;
  throw new Error('no seed');
}

function harborAt(s: GameState, pid: PlayerId, v: string): EpGame {
  const withSettlement = setPlayer(s, pid, {
    settlements: [...s.players.find((p) => p.id === pid)!.settlements, v],
  });
  return patchEpState(withSettlement, (ep) => ({ harbors: { ...ep.harbors, [v]: [] } }));
}

describe('Explorers & Pirates board (Rulebook pp. 6-7)', () => {
  it('lays out the 72-hex map with the starting island face up and both regions face down', () => {
    const s = epGame(3);
    expect(s.board.hexIds).toHaveLength(72);
    const ep = s.explorersPirates;
    for (const h of EP_START_ISLAND) {
      const hex = s.board.hexes[`${h.q},${h.r}`]!;
      expect(hex.numberToken).toBe(h.token);
      expect(hex.terrain).not.toBe('sea');
    }
    expect(s.board.hexes['-3,0']!.terrain).toBe('sheep');
    const counts: Partial<Record<Terrain, number>> = {};
    for (const h of EP_START_ISLAND) {
      const t = s.board.hexes[`${h.q},${h.r}`]!.terrain;
      counts[t] = (counts[t] ?? 0) + 1;
    }
    // 14 CATAN hexes (2 hills, 4 forests, 3 pastures, 2 fields, 3 mountains)
    // plus the frame's pasture.
    expect(counts).toEqual({ brick: 2, wood: 4, sheep: 4, wheat: 2, ore: 3 });
    expect(Object.keys(ep.hidden)).toHaveLength(32);
    for (const id of Object.keys(ep.hidden)) {
      expect(s.board.hexes[id]!.terrain).toBe('sea');
      expect(s.board.hexes[id]!.numberToken).toBeNull();
    }
    expect(s.board.hexes['0,0']!.terrain).toBe('sea');
    expect(ep.councilHex).toBe('0,0');
  });

  it('deals each region its 16 hexes: 6 land, 1 sea, 3 gold fields, 3 shoals, 3 spice farms', () => {
    const ep = epGame(5).explorersPirates;
    for (const region of ['parrot', 'goose'] as const) {
      const tiles = Object.values(ep.hidden).filter((t) => t.region === region);
      expect(tiles).toHaveLength(16);
      expect(tiles.filter((t) => t.terrain === 'gold')).toHaveLength(3);
      expect(tiles.filter((t) => t.shoal !== undefined).map((t) => t.shoal).sort()).toEqual(
        region === 'parrot' ? [1, 2, 3] : [4, 5, 6],
      );
      expect(tiles.filter((t) => t.terrain === 'sea' && t.shoal === undefined)).toHaveLength(1);
      expect(tiles.filter((t) => t.terrain === 'spice').map((t) => t.ability).sort()).toEqual([
        'fastGold',
        'pirateBonus',
        'swiftVoyage',
      ]);
      expect(tiles.find((t) => t.ability === 'pirateBonus')!.pirateNumber).toBe(region === 'parrot' ? 5 : 4);
      const land = tiles.filter((t) => ['wood', 'brick', 'sheep', 'wheat', 'ore'].includes(t.terrain));
      expect(land).toHaveLength(6);
      expect([...ep.discs[region]].sort((a, b) => a - b)).toEqual([...EP_REGION_DISCS[region]]);
    }
    expect([...ep.lairTokens].sort((a, b) => a - b)).toEqual([...EP_LAIR_TOKENS]);
  });

  it('marks the 14 harbor intersections on the east coast and the Council anchors', () => {
    const s = epGame();
    const ep = s.explorersPirates;
    expect(ep.harborSites).toHaveLength(14);
    for (const [q, r] of [
      [1, -3],
      [0, -2],
      [-1, -1],
      [-1, 0],
      [-2, 1],
      [-2, 2],
      [-2, 3],
    ] as const) {
      expect(ep.harborSites).toContain(cornerOf(s, q, r, 0));
      expect(ep.harborSites).toContain(cornerOf(s, q, r, 1));
    }
    expect(ep.councilAnchors).toEqual([cornerOf(s, 0, 0, 5), cornerOf(s, 0, 0, 2)]);
    // Each harbor site is coastal: it touches the sea next to the island.
    for (const v of ep.harborSites) {
      expect(s.board.vertices[v]!.hexes.some((h) => s.board.hexes[h]!.terrain === 'sea')).toBe(true);
    }
  });

  it('plays to 17 VP with 2 gold each, no robber, dev cards or Longest Road', () => {
    const s = epGame();
    expect(s.settings.victoryPointsToWin).toBe(EP_DEFAULT_VP);
    expect(s.players.every((p) => p.gold === 2)).toBe(true);
    expect(s.robberActive).toBe(false);
    expect(s.devCardDeck).toEqual([]);
    expect(s.noLongestRoad).toBe(true);
    expect(s.supplyTradeRate).toBe(3);
  });
});

describe('setup (Rulebook p. 7)', () => {
  it('places a harbor settlement, then a settlement, then a road and a ship with a settler', () => {
    let s: GameState = epGame(2);
    // Round 1: only the marked intersections.
    const island = cornerOf(s, -2, 0, 3);
    expect(canPlaceInitialSettlement(s, island)).toBe(false);
    const site = s.explorersPirates!.harborSites[0]!;
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: site });
    expect(harborsOf(s, 'p0')).toEqual([site]);
    expect(s.setupState?.step).toBe('settlement');
    expect(s.currentPlayerIndex).toBe(1);
    s = runEpSetup(s);
    expect(s.phase).toBe('rollOrPlayKnight');
    for (const p of s.players) {
      expect(p.settlements).toHaveLength(2);
      expect(harborsOf(s, p.id)).toHaveLength(1);
      expect(p.roads).toHaveLength(1);
      const ships = s.explorersPirates!.ships.filter((x) => x.owner === p.id);
      expect(ships).toHaveLength(1);
      expect(ships[0]!.cargo).toEqual(['settler']);
      // 2 + 2 VP.
      expect(calculateVictoryPoints(s, p.id, true)).toBe(3);
    }
  });

  it('pays the round-2 settlement 1 resource per adjacent hex, the harbor settlement nothing', () => {
    let s: GameState = epGame(4);
    s = runEpSetup(s);
    for (const p of s.players) {
      const plain = p.settlements.find((v) => !s.explorersPirates!.harbors[v])!;
      const expected = s.board.vertices[plain]!.hexes.filter((h) => s.board.hexes[h]!.terrain !== 'sea').length;
      const cards = Object.values(p.resources).reduce((a, b) => a + b, 0);
      expect(cards).toBe(expected);
    }
  });
});

describe('production (Rulebook p. 8)', () => {
  it('settlements and harbor settlements each collect 1; anyone who gets nothing takes 1 gold', () => {
    let s: GameState = bare(runEpSetup(epGame(1)));
    // p0: a harbor settlement on the 9 hex (1,-3); p1: a settlement there too.
    s = harborAt(s, 'p0', cornerOf(s, 1, -3, 0));
    s = setPlayer(s, 'p1', { settlements: [cornerOf(s, 1, -3, 3)] });
    const terrain = s.board.hexes['1,-3']!.terrain as 'wood';
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [4, 5] });
    expect(s.players[0]!.resources[terrain]).toBe(1);
    expect(s.players[1]!.resources[terrain]).toBe(1);
    expect(s.players[0]!.gold).toBe(0);
    expect(s.players[2]!.gold).toBe(1);
  });

  it('a 7 discards half above 7 cards, then the roller places their pirate ship and robs a ship owner', () => {
    let s: GameState = bare(runEpSetup(epGame(1)));
    s = give(s, 'p1', { wood: 8 });
    s = putShip(s, { id: 'x', owner: 'p1', edge: edgeOf(s, 1, -1, 1) });
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(s.phase).toBe('discard');
    s = applyAction(s, { type: 'discard', playerId: 'p1', resources: { wood: 4 } });
    expect(s.phase).toBe('epPlacePirate');
    // Not next to the starting island, not the frame, not face down.
    expect(canPlacePirateOn(s, '0,-1')).toBe(false);
    expect(canPlacePirateOn(s, '8,0')).toBe(false);
    expect(canPlacePirateOn(s, '2,-1')).toBe(false);
    expect(canPlacePirateOn(s, '1,0')).toBe(true);
    expect(() => applyAction(s, { type: 'epPlacePirate', playerId: 'p0', hex: '1,0', stealFrom: null })).toThrow();
    s = applyAction(s, { type: 'epPlacePirate', playerId: 'p0', hex: '1,0', stealFrom: 'p1' });
    expect(s.phase).toBe('main');
    expect(s.explorersPirates!.pirate).toEqual({ owner: 'p0', hex: '1,0' });
    expect(s.players[0]!.resources.wood).toBe(1);
    expect(s.players[1]!.resources.wood).toBe(3);
  });

  it('robs 1 gold from a ship owner with no cards', () => {
    let s: GameState = bare(runEpSetup(epGame(1)));
    s = setPlayer(s, 'p1', { gold: 3 });
    s = putShip(s, { id: 'x', owner: 'p1', edge: edgeOf(s, 1, -1, 1) });
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    s = applyAction(s, { type: 'epPlacePirate', playerId: 'p0', hex: '1,0', stealFrom: 'p1' });
    expect(s.players[1]!.gold).toBe(2);
    expect(s.players[0]!.gold).toBe(1);
  });
});

describe('Action phase builds (Rulebook pp. 9-10)', () => {
  it('upgrades a coastal settlement to a harbor settlement for 2 wheat + 2 ore (2 VP)', () => {
    let s: GameState = bare(epMainPhase(1));
    const coastal = cornerOf(s, 0, -2, 0);
    const inland = cornerOf(s, -2, 0, 0);
    s = setPlayer(s, 'p0', { settlements: [coastal, inland] });
    s = give(s, 'p0', { wheat: 4, ore: 4 });
    expect(() => applyAction(s, { type: 'epBuildHarbor', playerId: 'p0', vertex: inland })).toThrow();
    s = applyAction(s, { type: 'epBuildHarbor', playerId: 'p0', vertex: coastal });
    expect(harborsOf(s, 'p0')).toEqual([coastal]);
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(3);
    expect(s.players[0]!.resources).toMatchObject({ wheat: 2, ore: 2 });
  });

  it('builds ships next to a harbor settlement and recycles one when all three are out', () => {
    let s: GameState = bare(epMainPhase(1));
    const v = cornerOf(s, 1, -3, 0);
    s = harborAt(s, 'p0', v);
    s = give(s, 'p0', { wood: 4, sheep: 4 });
    const edges = buildableShipEdges(s, 'p0');
    expect(edges.length).toBeGreaterThan(0);
    for (const e of edges) expect(s.board.edges[e]!.vertices).toContain(v);
    s = applyAction(s, { type: 'epBuildShip', playerId: 'p0', edge: edges[0]! });
    expect(s.players[0]!.resources).toMatchObject({ wood: 3, sheep: 3 });
    // A built ship can't share an edge.
    expect(buildableShipEdges(s, 'p0')).not.toContain(edges[0]);
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 1) });
    s = putShip(s, { id: 'b', owner: 'p0', edge: edgeOf(s, 1, -1, 2) });
    const free = buildableShipEdges(s, 'p0')[0]!;
    expect(() => applyAction(s, { type: 'epBuildShip', playerId: 'p0', edge: free })).toThrow(/return one/);
    s = applyAction(s, { type: 'epBuildShip', playerId: 'p0', edge: free, recycle: 'a' });
    expect(shipById(s, 'a')).toBeUndefined();
    expect(s.explorersPirates!.ships.filter((x) => x.owner === 'p0')).toHaveLength(3);
  });

  it('places settlers and crews on harbor settlements or ships beside them, 2 slots each', () => {
    let s: GameState = bare(epMainPhase(1));
    const v = cornerOf(s, 1, -3, 0);
    s = harborAt(s, 'p0', v);
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -3, 0) });
    s = putShip(s, { id: 'far', owner: 'p0', edge: edgeOf(s, 1, 0, 0) });
    s = give(s, 'p0', { brick: 2, wood: 2, sheep: 6, wheat: 2, ore: 4 });
    s = applyAction(s, { type: 'epBuildSettler', playerId: 'p0', at: { harbor: v } });
    expect(s.explorersPirates!.harbors[v]).toEqual(['settler']);
    // Full: a crew needs room (or an eviction).
    expect(() => applyAction(s, { type: 'epBuildCrew', playerId: 'p0', at: { harbor: v } })).toThrow(/room/);
    s = applyAction(s, { type: 'epBuildCrew', playerId: 'p0', at: { ship: 'a' } });
    s = applyAction(s, { type: 'epBuildCrew', playerId: 'p0', at: { ship: 'a' } });
    expect(shipById(s, 'a')!.cargo).toEqual(['crew', 'crew']);
    expect(() => applyAction(s, { type: 'epBuildCrew', playerId: 'p0', at: { ship: 'far' } })).toThrow(/next to/);
    s = applyAction(s, { type: 'epBuildCrew', playerId: 'p0', at: { harbor: v }, evict: ['settler'] });
    expect(s.explorersPirates!.harbors[v]).toEqual(['crew']);
  });

  it('keeps roads and settlements off unexplored hexes and uncaptured gold fields', () => {
    let s: GameState = bare(epMainPhase(1));
    // A settlement on the east tip of the island; the parrot hex (2,-1) is two
    // sea hexes away, so test the rules on a revealed neighbour instead.
    s = setHidden(s, '2,-1', { terrain: 'gold' });
    [s] = exploreHex(s as EpGame, 'p0', '2,-1');
    const v = cornerOf(s, 2, -1, 3);
    s = setPlayer(s, 'p0', { roads: [edgeOf(s, 2, -1, 2)] });
    expect(canPlaceSettlement(s, 'p0', v)).toBe(false);
    s = patchEpState(s, (ep) => ({ lairs: ep.lairs.map((l) => ({ ...l, captured: true })) }));
    // Still next to the hidden (2,0)? (2,0) is sea on the map, so now it's open.
    expect(canPlaceSettlement(s, 'p0', v)).toBe(true);
    // An edge of a face-down hex takes no road.
    expect(canConnectRoad(s, 'p0', edgeOf(s, 2, -1, 0))).toBe(false);
  });

  it('trades 3:1 with the supply, buys 1 gold for 3 cards, and 2 gold buys a card twice a turn', () => {
    let s: GameState = bare(epMainPhase(1));
    s = give(s, 'p0', { wood: 9 });
    s = setPlayer(s, 'p0', { gold: 6 });
    s = applyAction(s, { type: 'bankTrade', playerId: 'p0', give: 'wood', receive: 'ore' });
    expect(s.players[0]!.resources).toMatchObject({ wood: 6, ore: 1 });
    s = applyAction(s, { type: 'buyGold', playerId: 'p0', give: 'wood' });
    expect(s.players[0]!.gold).toBe(7);
    s = applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'brick' });
    s = applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'brick' });
    expect(() => applyAction(s, { type: 'spendGold', playerId: 'p0', resource: 'brick' })).toThrow();
    expect(s.players[0]!.resources.brick).toBe(2);
    expect(s.players[0]!.gold).toBe(3);
  });

  it('refuses cities and development cards', () => {
    const s = epMainPhase(1);
    expect(() => applyAction(s, { type: 'buildCity', playerId: 'p0', vertex: s.players[0]!.settlements[0]! })).toThrow(/not used/);
    expect(() => applyAction(s, { type: 'buyDevCard', playerId: 'p0' })).toThrow(/not used/);
  });
});

describe('Movement phase (Rulebook pp. 10-12)', () => {
  it('moves a ship up to 4 edges, 6 for 1 wool, one ship at a time', () => {
    let s: GameState = bare(epMainPhase(1));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 3, 0, 0) });
    s = putShip(s, { id: 'b', owner: 'p0', edge: edgeOf(s, 1, 0, 3) });
    s = give(s, 'p0', { sheep: 1 });
    s = toMovement(s);
    expect(s.phase).toBe('epMovement');
    s = applyAction(s, { type: 'epBoostShip', playerId: 'p0', ship: 'a' });
    let steps = 0;
    let prev = shipById(s, 'a')!.edge;
    while (legalShipSteps(s, 'a').length > 0 && steps < 10) {
      const options = legalShipSteps(s, 'a').filter((e) => e !== prev);
      prev = shipById(s, 'a')!.edge;
      s = applyAction(s, { type: 'epMoveShip', playerId: 'p0', ship: 'a', to: options[0] ?? legalShipSteps(s, 'a')[0]! });
      steps++;
      if (s.explorersPirates!.movement!.moving === null) break;
    }
    expect(steps).toBeLessThanOrEqual(6);
    // Start ship b: ship a's move is over for the turn.
    const toB = legalShipSteps(s, 'b')[0]!;
    s = applyAction(s, { type: 'epMoveShip', playerId: 'p0', ship: 'b', to: toB });
    expect(legalShipSteps(s, 'a')).toEqual([]);
  });

  it('explores a face-down hex when a ship end touches it, ending the move', () => {
    let s: GameState = bare(epMainPhase(1));
    s = setHidden(s, '2,-1', { terrain: 'wood' });
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 2) });
    s = toMovement(s);
    const disc = s.explorersPirates!.discs.parrot.at(-1);
    s = applyAction(s, { type: 'epMoveShip', playerId: 'p0', ship: 'a', to: edgeOf(s, 1, -1, 1) });
    expect(s.explorersPirates!.hidden['2,-1']).toBeUndefined();
    expect(s.board.hexes['2,-1']).toMatchObject({ terrain: 'wood', numberToken: disc });
    expect(s.players[0]!.resources.wood).toBe(1);
    expect(s.explorersPirates!.movement!.moving).toBeNull();
    expect(legalShipSteps(s, 'a')).toEqual([]);
  });

  it('exploring a gold field lays a lair; a spice farm a sack per player; no-resource hexes pay 2 gold', () => {
    let s: GameState = bare(epMainPhase(1));
    s = setHidden(s, '2,-1', { terrain: 'gold' });
    s = setHidden(s, '2,1', { terrain: 'spice', ability: 'fastGold' });
    let ev;
    [s, ev] = exploreHex(s as EpGame, 'p0', '2,-1');
    expect(ev).toMatchObject({ kind: 'explore', reward: 'gold' });
    [s] = exploreHex(s as EpGame, 'p0', '2,1');
    const ep = s.explorersPirates!;
    expect(ep.lairs).toEqual([{ hex: '2,-1', number: expect.any(Number), crews: [], captured: false }]);
    expect(s.board.hexes['2,-1']!.numberToken).toBeNull();
    expect(ep.farms[0]).toMatchObject({ hex: '2,1', ability: 'fastGold', sacks: ['p0', 'p1', 'p2'], crews: [] });
    expect(s.players[0]!.gold).toBe(4);
  });

  it('charges 1 gold tribute once per ship for sailing along an opponent pirate', () => {
    let s: GameState = bare(epMainPhase(1));
    // Turn (2,-1) over first so the steps below don't explore.
    s = setHidden(s, '2,-1', { terrain: 'sea' });
    [s] = exploreHex(s as EpGame, 'p0', '2,-1');
    s = setPlayer(s, 'p0', { gold: 0 });
    s = patchEpState(s, () => ({ pirate: { owner: 'p1', hex: '1,0' } }));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 2) });
    s = toMovement(s);
    // No gold: can't step onto the pirate's hex edges.
    expect(legalShipSteps(s, 'a')).not.toContain(edgeOf(s, 1, -1, 1));
    s = setPlayer(s, 'p0', { gold: 2 });
    s = applyAction(s, { type: 'epMoveShip', playerId: 'p0', ship: 'a', to: edgeOf(s, 1, -1, 1) });
    expect(s.players[0]!.gold).toBe(1);
    const next = legalShipSteps(s, 'a').find((e) => s.board.edges[e]!.hexes.includes('1,0'))!;
    s = applyAction(s, { type: 'epMoveShip', playerId: 'p0', ship: 'a', to: next });
    expect(s.players[0]!.gold).toBe(1);
  });

  it('a battle-ready ship chases the pirate away on a 6 and the chaser places theirs', () => {
    let s: GameState = bare(epMainPhase(1));
    s = patchEpState(s, () => ({ pirate: { owner: 'p1', hex: '1,0' } }));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 1) });
    s = putShip(s, { id: 'v', owner: 'p2', edge: edgeOf(s, 4, -1, 1) });
    s = give(s, 'p2', { ore: 1 });
    s = toMovement(s);
    expect(battleReadyShips(s, 'p0').map((x) => x.id)).toEqual(['a']);
    expect(chaseNumbers(s, 'p0')).toEqual([6]);
    s = { ...s, rngState: rngRolling(2) };
    s = applyAction(s, { type: 'epChasePirate', playerId: 'p0', ship: 'a' });
    expect(s.phase).toBe('epMovement');
    expect(battleReadyShips(s, 'p0')).toEqual([]);
    s = putShip(s, { id: 'a2', owner: 'p0', edge: edgeOf(s, 1, 0, 2) });
    s = { ...s, rngState: rngRolling(6) };
    s = applyAction(s, { type: 'epChasePirate', playerId: 'p0', ship: 'a2' });
    expect(s.phase).toBe('epPlacePirate');
    // A different hex from the chased pirate.
    expect(canPlacePirateOn(s, '1,0')).toBe(false);
    s = applyAction(s, { type: 'epPlacePirate', playerId: 'p0', hex: '4,0', stealFrom: 'p2' });
    expect(s.phase).toBe('epMovement');
    expect(s.explorersPirates!.pirate).toEqual({ owner: 'p0', hex: '4,0' });
    expect(s.players[0]!.resources.ore).toBe(1);
  });

  it('founds a settlement from a ship with a settler (distance rule, no road)', () => {
    let s: GameState = bare(epMainPhase(1));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, -1, -1, 0), cargo: ['settler'] });
    s = toMovement(s);
    const v = cornerOf(s, -1, -1, 0);
    s = applyAction(s, { type: 'epFoundSettlement', playerId: 'p0', ship: 'a', vertex: v });
    expect(s.players[0]!.settlements).toContain(v);
    expect(shipById(s, 'a')).toBeUndefined();
  });
});

describe('missions (Rulebook pp. 13-15)', () => {
  function withRevealed(s: GameState, hex: string, tile: Parameters<typeof setHidden>[2]): EpGame {
    let out = setHidden(s, hex, tile);
    [out] = exploreHex(out, 'p0', hex);
    return out;
  }

  it('captures a pirate lair with the third crew and resolves it when the Movement phase ends', () => {
    let s: GameState = bare(epMainPhase(1));
    s = withRevealed(s, '2,-1', { terrain: 'gold' });
    s = patchEpState(s, (ep) => ({ lairs: ep.lairs.map((l) => ({ ...l, crews: ['p1'] })) }));
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 0), cargo: ['crew', 'crew'] });
    s = setPlayer(s, 'p0', { gold: 0 });
    s = setPlayer(s, 'p1', { gold: 0 });
    s = toMovement(s);
    s = applyAction(s, { type: 'epCrewToLair', playerId: 'p0', ship: 'a', hex: '2,-1' });
    s = applyAction(s, { type: 'epCrewToLair', playerId: 'p0', ship: 'a', hex: '2,-1' });
    expect(s.explorersPirates!.pendingLairs).toEqual(['2,-1']);
    const number = s.explorersPirates!.lairs[0]!.number;
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' });
    const ep = s.explorersPirates!;
    expect(ep.pendingLairs).toEqual([]);
    expect(s.board.hexes['2,-1']!.numberToken).toBe(number);
    expect(s.players[0]!.gold).toBe(2);
    expect(s.players[1]!.gold).toBe(2);
    const p0 = ep.tracks.pirateLairs.p0!;
    const p1 = ep.tracks.pirateLairs.p1!;
    expect(p0 + p1).toBe(3);
    // The hero takes one crew back: 2 crews stay.
    expect(ep.lairs[0]!.crews).toHaveLength(2);
    expect(ep.lairs[0]!.captured).toBe(true);
    expect(s.currentPlayerIndex).toBe(1);
  });

  it('a captured gold field produces 2 gold per building', () => {
    let s: GameState = bare(runEpSetup(epGame(1)));
    s = withRevealed(s, '2,-1', { terrain: 'gold' });
    s = patchEpState(s, (ep) => ({ lairs: ep.lairs.map((l) => ({ ...l, captured: true })) }));
    const number = s.explorersPirates!.lairs[0]!.number;
    s = { ...s, board: { ...s.board, hexes: { ...s.board.hexes, '2,-1': { ...s.board.hexes['2,-1']!, numberToken: number } } } };
    s = setPlayer(s, 'p1', { settlements: [cornerOf(s, 2, -1, 2)], gold: 0 });
    const dice: [number, number] = number <= 6 ? [1, number - 1] : [6, number - 6];
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice });
    expect(s.players[1]!.gold).toBe(2);
  });

  it('fish: a roll fills a shoal, an empty ship loads the haul, the Council takes it', () => {
    let s: GameState = bare(epMainPhase(1));
    s = withRevealed(s, '2,-1', { terrain: 'sea', shoal: 3 });
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 1) });
    s = toMovement(s);
    s = { ...s, rngState: rngRolling(3) };
    s = applyAction(s, { type: 'epFishRoll', playerId: 'p0' });
    expect(s.explorersPirates!.shoals[0]!.haul).toBe(true);
    expect(s.explorersPirates!.fishSupply).toBe(5);
    expect(() => applyAction(s, { type: 'epFishRoll', playerId: 'p0' })).toThrow();
    s = applyAction(s, { type: 'epLoadFish', playerId: 'p0', ship: 'a', hex: '2,-1' });
    expect(shipById(s, 'a')!.cargo).toEqual(['fish']);
    // Sail to an edge touching the Council's south anchor.
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 0, 0, 1), cargo: ['fish'] });
    s = applyAction(s, { type: 'epDeliver', playerId: 'p0', ship: 'a' });
    expect(s.explorersPirates!.tracks.fish.p0).toBe(1);
    expect(s.explorersPirates!.fishSupply).toBe(6);
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(2);
  });

  it('spices: a crew opens the farm (its advantage too), one sack per player, delivered at the Council', () => {
    let s: GameState = bare(epMainPhase(1));
    s = withRevealed(s, '2,-1', { terrain: 'spice', ability: 'swiftVoyage' });
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 1, -1, 0), cargo: ['crew'] });
    s = toMovement(s);
    expect(() => applyAction(s, { type: 'epLoadSpice', playerId: 'p0', ship: 'a', hex: '2,-1' })).toThrow(/crew/);
    expect(shipBaseMp(s, 'p0')).toBe(4);
    s = applyAction(s, { type: 'epCrewToFarm', playerId: 'p0', ship: 'a', hex: '2,-1' });
    expect(shipBaseMp(s, 'p0')).toBe(5);
    s = applyAction(s, { type: 'epLoadSpice', playerId: 'p0', ship: 'a', hex: '2,-1' });
    expect(() => applyAction(s, { type: 'epLoadSpice', playerId: 'p0', ship: 'a', hex: '2,-1' })).toThrow(/already/);
    // Settlements may now go on the farm for p0 only.
    const v = cornerOf(s, 2, -1, 3);
    s = setPlayer(s, 'p0', { roads: [edgeOf(s, 2, -1, 2)] });
    s = setPlayer(s, 'p1', { roads: [edgeOf(s, 2, -1, 3)] });
    expect(canPlaceSettlement(s, 'p0', v)).toBe(true);
    expect(canPlaceSettlement(s, 'p1', v)).toBe(false);
    s = putShip(s, { id: 'a', owner: 'p0', edge: edgeOf(s, 0, 0, 5), cargo: ['spice'] });
    s = applyAction(s, { type: 'epDeliver', playerId: 'p0', ship: 'a' });
    expect(s.explorersPirates!.tracks.spice.p0).toBe(1);
  });

  it('Pirate Bonus farms add their number to the chase roll (both: 4, 5 and 6); Fast Gold trades a card for gold', () => {
    let s: GameState = bare(epMainPhase(1));
    s = patchEpState(s, () => ({
      farms: [
        { hex: '2,-1', ability: 'pirateBonus', pirateNumber: 5, sacks: [], crews: ['p0'] },
        { hex: '2,1', ability: 'fastGold', sacks: [], crews: ['p0'] },
      ],
    }));
    expect(chaseNumbers(s, 'p0')).toEqual([5, 6]);
    s = patchEpState(s, (ep) => ({
      farms: [...ep.farms, { hex: '4,1', ability: 'pirateBonus', pirateNumber: 4, sacks: [], crews: ['p0'] }],
    }));
    expect(chaseNumbers(s, 'p0')).toEqual([4, 5, 6]);
    s = give(s, 'p0', { wood: 2 });
    s = applyAction(s, { type: 'epFastGold', playerId: 'p0', give: 'wood' });
    expect(s.players[0]!.gold).toBe(1);
    expect(() => applyAction(s, { type: 'epFastGold', playerId: 'p0', give: 'wood' })).toThrow(/already/);
  });

  it('track VPs plus the bonus tile, which a tie leaves with the first to arrive', () => {
    let s: GameState = bare(epMainPhase(1));
    s = patchEpState(s, () => ({
      tracks: { pirateLairs: { p0: 3, p1: 3, p2: 0 }, fish: { p0: 7, p1: 0, p2: 0 }, spice: { p0: 0, p1: 0, p2: 0 } },
      arrivals: { pirateLairs: { p0: 5, p1: 2 }, fish: { p0: 1 }, spice: {} },
    }));
    expect(bonusTileHolder(s, 'pirateLairs')).toBe('p1');
    expect(bonusTileHolder(s, 'fish')).toBe('p0');
    expect(bonusTileHolder(s, 'spice')).toBeNull();
    // p0: lairs space 3 = 2 VP, fish space 7 = 3 VP + tile.
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(6);
    expect(calculateVictoryPoints(s, 'p1', true)).toBe(3);
  });

  it('wins with 17 VP during your own turn', () => {
    let s: GameState = bare(epMainPhase(1));
    s = patchEpState(s, () => ({
      tracks: { pirateLairs: { p0: 7 }, fish: { p0: 7 }, spice: { p0: 6 } } as never,
      arrivals: { pirateLairs: { p0: 1 }, fish: { p0: 1 }, spice: { p0: 1 } },
    }));
    // 12 mission VP + 4 settlements = 16; a fifth settlement wins.
    const spots = [cornerOf(s, -3, 0, 4), cornerOf(s, -3, 2, 4), cornerOf(s, -2, -1, 4), cornerOf(s, 0, -3, 4)];
    s = setPlayer(s, 'p0', { settlements: spots, roads: [edgeOf(s, -3, 3, 3)] });
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(16);
    s = give(s, 'p0', { brick: 1, wood: 1, sheep: 1, wheat: 1 });
    const v = s.board.edges[edgeOf(s, -3, 3, 3)]!.vertices.find((x) => canPlaceSettlement(s, 'p0', x))!;
    s = applyAction(s, { type: 'buildSettlement', playerId: 'p0', vertex: v });
    expect(s.phase).toBe('gameOver');
    expect(s.winner).toBe('p0');
  });

  it('settlement costs leave the harbor cost table intact', () => {
    expect(EP_COSTS.harbor).toEqual({ wheat: 2, ore: 2 });
  });
});
