import { describe, expect, it } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import { giveResources, runSetupPhase } from '../../../__testHelpers';
import { canConnectRoad, canPlaceCity, canPlaceSettlement } from '../../../placement';
import { calculateVictoryPoints } from '../../../scoring/points';
import { getBankTradeRate } from '../../../actions/trade';
import { edgeKey } from '../../../board/coords';
import type {
  BarbarianAttackState,
  BarbarianCardType,
  EdgeId,
  GameState,
  HexId,
  PlayerId,
  VertexId,
} from '../../../types';
import { TB_FRAME_PORTS_3_4 } from '../board/frame';
import {
  conqueredBuildingVertices,
  isHexConquered,
  isVertexConquered,
  type BarbarianAttackGame,
} from './state';
import { resolveBarbarianLanding } from './landing';
import { edgeColor, knightMoveTargets, knightsOnHex } from './knights';
import { expelBarbarians, distributePrisoners } from './expel';

function newGame(seed = 1, players = 3): BarbarianAttackGame {
  const s = createGame({
    playerNames: ['A', 'B', 'C', 'D'].slice(0, players),
    seed,
    settings: { expansions: ['traders'], tradersScenarioId: 'barbarianAttack' },
    randomizeTurnOrder: false,
  });
  return s as BarbarianAttackGame;
}

// After setup, rolled (a 3) and in the main phase with p0 to act.
function mainPhase(seed = 1): BarbarianAttackGame {
  let s = runSetupPhase(newGame(seed));
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [1, 2] });
  expect(s.phase).toBe('main');
  return s as BarbarianAttackGame;
}

function patchBa(s: GameState, fn: (ba: BarbarianAttackState) => Partial<BarbarianAttackState>): BarbarianAttackGame {
  return { ...s, barbarianAttack: { ...s.barbarianAttack!, ...fn(s.barbarianAttack!) } } as BarbarianAttackGame;
}

function withBarbs(s: GameState, barbs: Record<HexId, number>): BarbarianAttackGame {
  return patchBa(s, () => ({ barbarians: barbs }));
}

// The edge of `hex` in ScenarioPortAnchor direction d (0 E, 1 SE, 2 SW, 3 W,
// 4 NW, 5 NE).
function hexEdge(s: GameState, hex: HexId, d: number): EdgeId {
  const c = s.board.hexes[hex]!.corners;
  return edgeKey(c[d]!, c[(d + 1) % 6]!);
}

function edgeBetween(s: GameState, a: HexId, b: HexId): EdgeId {
  const e = Object.values(s.board.edges).find((x) => x.hexes.includes(a) && x.hexes.includes(b));
  if (!e) throw new Error(`no edge between ${a} and ${b}`);
  return e.id;
}

function setPieces(
  s: GameState,
  pid: PlayerId,
  pieces: { settlements?: VertexId[]; cities?: VertexId[]; roads?: EdgeId[] },
): BarbarianAttackGame {
  return {
    ...s,
    players: s.players.map((p) => (p.id === pid ? { ...p, ...pieces } : p)),
  } as BarbarianAttackGame;
}

function stackDeck(s: GameState, top: BarbarianCardType): BarbarianAttackGame {
  return patchBa(s, (ba) => ({ deck: [...ba.deck, top] }));
}

const NUMBER_AT: Record<string, number | null> = {
  '0,-2': 3, '1,-2': 8, '2,-2': null,
  '-1,-1': 9, '0,-1': 4, '1,-1': 5, '2,-1': 10,
  '-2,0': 12, '-1,0': 6, '0,0': 10, '1,0': 8, '2,0': 11,
  '-2,1': 4, '-1,1': 9, '0,1': 3, '1,1': 5,
  '-2,2': null, '-1,2': 6, '0,2': 2,
};
const COASTAL = ['0,-2', '1,-2', '-1,-1', '2,-1', '-2,0', '2,0', '-2,1', '1,1', '-1,2', '0,2'];
const INNER = ['0,-1', '1,-1', '-1,0', '0,0', '1,0', '-1,1', '0,1'];

function count<T extends string>(xs: T[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const x of xs) out[x] = (out[x] ?? 0) + 1;
  return out;
}

describe('Barbarian Attack — board and setup', () => {
  it('prints the rulebook number discs, castle and desert', () => {
    const s = newGame();
    for (const [id, n] of Object.entries(NUMBER_AT)) {
      expect(s.board.hexes[id]!.numberToken, id).toBe(n);
    }
    expect(s.board.hexes['-2,2']!.terrain).toBe('castle');
    expect(s.board.hexes['2,-2']!.terrain).toBe('desert');
  });

  it('deals the coastal and inner terrain pools separately', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = newGame(seed);
      expect(count(COASTAL.map((h) => s.board.hexes[h]!.terrain))).toEqual({
        brick: 2, wood: 2, sheep: 3, wheat: 2, ore: 1,
      });
      expect(count(INNER.map((h) => s.board.hexes[h]!.terrain))).toEqual({
        brick: 1, wood: 1, sheep: 1, wheat: 2, ore: 2,
      });
    }
    const a = newGame(1);
    const b = newGame(2);
    expect(COASTAL.map((h) => a.board.hexes[h]!.terrain)).not.toEqual(
      COASTAL.map((h) => b.board.hexes[h]!.terrain),
    );
  });

  it('has the nine T&B frame harbors with their printed types', () => {
    const s = newGame();
    expect(s.board.ports).toHaveLength(9);
    TB_FRAME_PORTS_3_4.forEach((a) => {
      const e = hexEdge(s, `${a.q},${a.r}`, a.direction);
      expect(s.board.ports.find((p) => p.edge === e)?.type).toBe(a.fixedType);
    });
  });

  it('starts one barbarian on the 2 and one on the 12; 34 in the supply', () => {
    const s = newGame();
    expect(s.barbarianAttack.barbarians).toEqual({ '0,2': 1, '-2,0': 1 });
    expect(s.barbarianAttack.supply).toBe(34);
  });

  it('expels in rulebook order: from the 4 by the castle, clockwise', () => {
    const s = newGame();
    const order = s.barbarianAttack.coastalHexes;
    expect(order).toEqual([
      '-2,1', '-2,0', '-1,-1', '0,-2', '1,-2', '2,-2', '2,-1', '2,0', '1,1', '0,2', '-1,2', '-2,2',
    ]);
    expect(order.map((h) => s.board.hexes[h]!.numberToken)).toEqual([
      4, 12, 9, 3, 8, null, 10, 11, 5, 2, 6, null,
    ]);
  });

  it('uses its own 26-card deck: no base cards, no robber, no Largest Army, coins, 12 VP', () => {
    const s = newGame();
    expect(count(s.barbarianAttack.deck)).toEqual({
      capture: 4, knighthood: 14, swiftKnight: 4, treason: 4,
    });
    expect(s.devCardDeck).toEqual([]);
    expect(s.robberActive).toBe(false);
    expect(s.noLargestArmy).toBe(true);
    expect(s.coinsInPlay).toBe(true);
    expect(s.wealthTiles).toBeUndefined();
    expect(s.settings.victoryPointsToWin).toBe(12);
  });

  it('turns the second starting placement into a city with 1 card per hex', () => {
    const s = runSetupPhase(newGame());
    for (const p of s.players) {
      expect(p.settlements).toHaveLength(1);
      expect(p.cities).toHaveLength(1);
      const city = s.board.vertices[p.cities[0]!]!;
      const producing = city.hexes.filter((h) => {
        const t = s.board.hexes[h]!.terrain;
        return t !== 'sea' && t !== 'desert' && t !== 'castle';
      }).length;
      const cards = Object.values(p.resources).reduce((a, b) => a + b, 0);
      expect(cards).toBe(producing);
      expect(calculateVictoryPoints(s, p.id, true)).toBe(3);
    }
  });

  it('colours edges like the castle tile: purple NW/SE, green NE/SW, brown W/E', () => {
    const s = newGame();
    const castle = s.barbarianAttack.castleHex;
    const byDirection = [0, 1, 2, 3, 4, 5].map((d) => edgeColor(s, hexEdge(s, castle, d)));
    // 0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE
    expect(byDirection).toEqual(['brown', 'purple', 'green', 'brown', 'purple', 'green']);
  });
});

describe('Barbarian Attack — landings', () => {
  it('rolls 3 different non-7 numbers and lands one barbarian on each coastal hex', () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const s = { ...newGame(), rngState: seed * 7919 } as BarbarianAttackGame;
      const next = resolveBarbarianLanding(s, 'p0') as BarbarianAttackGame;
      const ev = next.barbarianAttack.lastEvents!.events[0]!;
      expect(ev.kind).toBe('landing');
      if (ev.kind !== 'landing') return;
      const totals = ev.rolls.map((r) => r.dice[0] + r.dice[1]);
      expect(totals).toHaveLength(3);
      expect(new Set(totals).size).toBe(3);
      expect(totals).not.toContain(7);
      for (const r of ev.rolls) {
        expect(s.board.hexes[r.hex]!.numberToken).toBe(r.dice[0] + r.dice[1]);
        expect(next.barbarianAttack.barbarians[r.hex]).toBe((s.barbarianAttack.barbarians[r.hex] ?? 0) + 1);
      }
      expect(next.barbarianAttack.supply).toBe(s.barbarianAttack.supply - 3);
      expect(next.rngState).not.toBe(s.rngState);
      // Deterministic for every peer.
      expect(resolveBarbarianLanding(s, 'p0')).toEqual(next);
    }
  });

  it('skips a conquered hex and stops when the supply runs out', () => {
    // Every numbered coastal hex already conquered: nothing lands.
    const full: Record<HexId, number> = {};
    for (const h of COASTAL) full[h] = 3;
    let s = withBarbs(newGame(), full);
    let next = resolveBarbarianLanding(s, 'p0') as BarbarianAttackGame;
    expect(next.barbarianAttack.barbarians).toEqual(full);
    const ev = next.barbarianAttack.lastEvents!.events[0]!;
    expect(ev.kind === 'landing' && ev.rolls.every((r) => !r.placed)).toBe(true);

    s = patchBa(newGame(), () => ({ supply: 1 }));
    next = resolveBarbarianLanding(s, 'p0') as BarbarianAttackGame;
    expect(next.barbarianAttack.supply).toBe(0);
    const ev2 = next.barbarianAttack.lastEvents!.events[0]!;
    expect(ev2.kind === 'landing' && ev2.rolls.length === 1 && ev2.supplyEmpty).toBe(true);
  });

  it('runs after a settlement or city is built in play, not during setup', () => {
    let s = mainPhase();
    const setupBarbs = runSetupPhase(newGame()).barbarianAttack!.barbarians;
    expect(setupBarbs).toEqual({ '0,2': 1, '-2,0': 1 });
    const p0 = s.players.find((p) => p.id === 'p0')!;
    s = giveResources(s, 'p0', { wheat: 2, ore: 3 }) as BarbarianAttackGame;
    const before = s.barbarianAttack.supply;
    s = applyAction(s, { type: 'buildCity', playerId: 'p0', vertex: p0.settlements[0]! }) as BarbarianAttackGame;
    expect(s.barbarianAttack.supply).toBe(before - 3);
    expect(s.barbarianAttack.lastEvents!.events[0]!.kind).toBe('landing');
  });
});

describe('Barbarian Attack — conquest', () => {
  it('a conquered hex does not produce', () => {
    let s = runSetupPhase(newGame());
    // Find a player with a building on the 3 inner? Use a coastal hex the
    // setup touched.
    const p = s.players[0]!;
    const v = p.settlements[0]!;
    const coastal = s.board.vertices[v]!.hexes.find((h) => COASTAL.includes(h));
    if (!coastal) return;
    const n = s.board.hexes[coastal]!.numberToken!;
    const dice: [number, number] = n <= 7 ? [1, n - 1] : [6, n - 6];
    const free = applyAction(s, { type: 'rollDice', playerId: 'p0', dice });
    s = withBarbs(s, { [coastal]: 3 });
    const blocked = applyAction(s, { type: 'rollDice', playerId: 'p0', dice });
    const res = s.board.hexes[coastal]!.terrain as 'wood';
    const gainFree = free.players[0]!.resources[res] - s.players[0]!.resources[res];
    const gainBlocked = blocked.players[0]!.resources[res] - s.players[0]!.resources[res];
    expect(gainFree).toBeGreaterThan(gainBlocked);
    expect(blocked.board).toBe(s.board);
  });

  it('nothing is built on the edges or corners of a conquered hex', () => {
    let s = mainPhase();
    const hex = '-1,-1';
    const corner = s.board.hexes[hex]!.corners[0]!;
    const edge = hexEdge(s, hex, 0);
    // Give p0 a road on the edge next to the corner so connectivity holds.
    const v = s.board.vertices[corner]!;
    const roadIn = v.edges.find((e) => e !== edge && !s.board.edges[e]!.hexes.includes(hex));
    s = setPieces(s, 'p0', { roads: [roadIn!] , settlements: s.players[0]!.settlements });
    const before = canPlaceSettlement(s, 'p0', corner);
    s = withBarbs(s, { [hex]: 3 });
    expect(canPlaceSettlement(s, 'p0', corner)).toBe(false);
    expect(canConnectRoad(s, 'p0', edge)).toBe(false);
    // Upgrading a settlement on a conquered corner is building there too.
    s = setPieces(s, 'p0', { settlements: [corner] });
    expect(canPlaceCity(s, 'p0', corner)).toBe(false);
    s = giveResources(s, 'p0', { wheat: 2, ore: 3 }) as BarbarianAttackGame;
    expect(() => applyAction(s, { type: 'buildCity', playerId: 'p0', vertex: corner })).toThrow();
    void before;
  });

  it('a building touching only conquered hexes and the frame is conquered: 0 VP, no port', () => {
    let s = mainPhase();
    // (1,-2) NE edge holds the 2:1 brick harbor; its N corner touches only
    // (1,-2) and the frame.
    const harborEdge = hexEdge(s, '1,-2', 5);
    const [va, vb] = s.board.edges[harborEdge]!.vertices;
    const lonely = [va, vb].find((v) =>
      s.board.vertices[v]!.hexes.filter((h) => s.board.hexes[h]!.terrain !== 'sea').length === 1,
    )!;
    s = setPieces(s, 'p1', { settlements: [lonely], cities: [], ports: ['brick'] } as never);
    s = { ...s, players: s.players.map((p) => (p.id === 'p1' ? { ...p, ports: ['brick'] } : p)) } as BarbarianAttackGame;
    expect(calculateVictoryPoints(s, 'p1', true)).toBe(1);
    expect(getBankTradeRate(s, 'p1', 'brick')).toBe(2);

    // Three barbarians land on (1,-2) through a landing: conquered.
    s = withBarbs(s, { '1,-2': 2 });
    s = { ...s, rngState: findRngFor(s, '1,-2') } as BarbarianAttackGame;
    s = resolveBarbarianLanding(s, 'p0') as BarbarianAttackGame;
    expect(isHexConquered(s, '1,-2')).toBe(true);
    expect(isVertexConquered(s, lonely)).toBe(true);
    expect(conqueredBuildingVertices(s).has(lonely)).toBe(true);
    expect(calculateVictoryPoints(s, 'p1', true)).toBe(0);
    expect(getBankTradeRate(s, 'p1', 'brick')).toBe(4);

    // A building also touching an unconquered hex is not conquered.
    const shared = s.board.hexes['1,-2']!.corners.find(
      (v) => s.board.vertices[v]!.hexes.includes('0,-2'),
    )!;
    expect(isVertexConquered(s, shared)).toBe(false);
  });
});

// An rng state whose first landing roll names `hex`.
function findRngFor(s: GameState, hex: HexId): number {
  for (let seed = 1; seed < 100000; seed++) {
    const next = resolveBarbarianLanding({ ...s, rngState: seed }, 'p0') as BarbarianAttackGame;
    const ev = next.barbarianAttack.lastEvents!.events[0]!;
    if (ev.kind === 'landing' && ev.rolls[0]?.hex === hex) return seed;
  }
  throw new Error('no seed');
}

describe('Barbarian Attack — resolving a 7', () => {
  it('discards as normal, then the roller steals from a player of their choice', () => {
    let s = runSetupPhase(newGame());
    s = giveResources(s, 'p1', { wood: 5, brick: 5 });
    s = giveResources(s, 'p2', { ore: 1 });
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(s.phase).toBe('discard');
    const p1 = s.players.find((p) => p.id === 'p1')!;
    const half = Math.floor(Object.values(p1.resources).reduce((a, b) => a + b, 0) / 2);
    s = applyAction(s, { type: 'discard', playerId: 'p1', resources: { wood: Math.min(5, half), brick: Math.max(0, half - 5) } });
    expect(s.phase).toBe('stealResource');
    const p0Before = Object.values(s.players[0]!.resources).reduce((a, b) => a + b, 0);
    s = applyAction(s, { type: 'stealResource', playerId: 'p0', stealFrom: 'p2' });
    expect(s.phase).toBe('main');
    expect(Object.values(s.players[0]!.resources).reduce((a, b) => a + b, 0)).toBe(p0Before + 1);
  });

  it('goes straight to the steal without discards', () => {
    let s = runSetupPhase(newGame());
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [1, 6] });
    expect(s.phase).toBe('stealResource');
  });
});

describe('Barbarian Attack — development cards', () => {
  function buy(s: GameState, card: BarbarianCardType): BarbarianAttackGame {
    let next = stackDeck(s, card);
    next = giveResources(next, 'p0', { sheep: 1, wheat: 1, ore: 1 }) as BarbarianAttackGame;
    return applyAction(next, { type: 'buyDevCard', playerId: 'p0' }) as BarbarianAttackGame;
  }

  it('costs the normal price and asks for the choice at once', () => {
    const s = mainPhase();
    const next = buy(s, 'knighthood');
    expect(next.phase).toBe('barbarianCard');
    expect(next.barbarianAttack.pendingCard).toEqual({ playerId: 'p0', card: 'knighthood' });
    expect(next.players[0]!.resources).toEqual(s.players[0]!.resources);
    expect(next.bank.sheep).toBe(s.bank.sheep + 1);
  });

  it('Capture takes a barbarian prisoner (and liberates a conquered hex)', () => {
    let s = withBarbs(mainPhase(), { '2,0': 3 });
    s = buy(s, 'capture');
    expect(() => applyAction(s, { type: 'resolveBarbarianCard', playerId: 'p0', hex: '1,1' })).toThrow();
    s = applyAction(s, { type: 'resolveBarbarianCard', playerId: 'p0', hex: '2,0' }) as BarbarianAttackGame;
    expect(s.barbarianAttack.barbarians['2,0']).toBe(2);
    expect(isHexConquered(s, '2,0')).toBe(false);
    expect(s.barbarianAttack.prisoners.p0).toBe(1);
    expect(s.barbarianAttack.discard).toContain('capture');
    expect(s.phase).toBe('main');
  });

  it('Capture with no barbarian on the coast is discarded and another card drawn', () => {
    let s = withBarbs(mainPhase(), {});
    s = patchBa(s, (ba) => ({ deck: [...ba.deck, 'swiftKnight', 'capture'] }));
    s = giveResources(s, 'p0', { sheep: 1, wheat: 1, ore: 1 }) as BarbarianAttackGame;
    s = applyAction(s, { type: 'buyDevCard', playerId: 'p0' }) as BarbarianAttackGame;
    expect(s.barbarianAttack.pendingCard?.card).toBe('swiftKnight');
    expect(s.barbarianAttack.discard).toEqual(['capture']);
    const ev = s.barbarianAttack.lastEvents!.events[0]!;
    expect(ev.kind === 'cardDrawn' && ev.skippedCaptures === 1).toBe(true);
  });

  it('Knighthood places a knight on a free castle edge only', () => {
    let s = buy(mainPhase(), 'knighthood');
    const inner = edgeBetween(s, '-1,1', '0,1');
    expect(() => applyAction(s, { type: 'resolveBarbarianCard', playerId: 'p0', edge: inner })).toThrow();
    const castleEdge = edgeBetween(s, '-2,2', '-2,1');
    s = applyAction(s, { type: 'resolveBarbarianCard', playerId: 'p0', edge: castleEdge }) as BarbarianAttackGame;
    expect(s.barbarianAttack.knights[castleEdge]).toBe('p0');
    // The same castle edge is no longer free.
    s = buy(s, 'knighthood');
    expect(() =>
      applyAction(s, { type: 'resolveBarbarianCard', playerId: 'p0', edge: castleEdge }),
    ).toThrow();
  });

  it('Swift Knight places a knight on any edge without one', () => {
    let s = buy(mainPhase(), 'swiftKnight');
    const e = edgeBetween(s, '0,0', '1,0');
    s = applyAction(s, { type: 'resolveBarbarianCard', playerId: 'p0', edge: e }) as BarbarianAttackGame;
    expect(s.barbarianAttack.knights[e]).toBe('p0');
  });

  it('knight cards do nothing when all 6 knights are on the board', () => {
    let s = mainPhase();
    const edges = s.board.edgeIds.filter((e) => s.board.edges[e]!.hexes.includes('0,0'));
    s = patchBa(s, () => ({ knights: Object.fromEntries(edges.map((e) => [e, 'p0'])) }));
    s = buy(s, 'swiftKnight');
    expect(s.phase).toBe('main');
    const ev = s.barbarianAttack.lastEvents!.events[0]!;
    expect(ev.kind === 'cardDrawn' && ev.wasted).toBe(true);
    expect(s.barbarianAttack.discard).toContain('swiftKnight');
  });

  it('Treason pays 2 gold and moves 2 barbarians between 4 different coastal hexes', () => {
    let s = withBarbs(mainPhase(), { '0,2': 1, '-2,0': 2, '2,0': 2 });
    s = buy(s, 'treason');
    const gold = s.players[0]!.gold ?? 0;
    // Same source twice.
    expect(() =>
      applyAction(s, {
        type: 'resolveBarbarianCard', playerId: 'p0',
        moves: [{ from: '-2,0', to: '1,1' }, { from: '-2,0', to: '0,-2' }],
      }),
    ).toThrow();
    // Destination is a source.
    expect(() =>
      applyAction(s, {
        type: 'resolveBarbarianCard', playerId: 'p0',
        moves: [{ from: '-2,0', to: '0,2' }, { from: '0,2', to: '0,-2' }],
      }),
    ).toThrow();
    // From the supply while the board has barbarians.
    expect(() =>
      applyAction(s, {
        type: 'resolveBarbarianCard', playerId: 'p0',
        moves: [{ from: null, to: '1,1' }, { from: '0,2', to: '0,-2' }],
      }),
    ).toThrow();
    // Only one move.
    expect(() =>
      applyAction(s, { type: 'resolveBarbarianCard', playerId: 'p0', moves: [{ from: '0,2', to: '1,1' }] }),
    ).toThrow();
    const next = applyAction(s, {
      type: 'resolveBarbarianCard', playerId: 'p0',
      moves: [{ from: '-2,0', to: '2,0' }, { from: '0,2', to: '1,1' }],
    }) as BarbarianAttackGame;
    expect(next.barbarianAttack.barbarians).toEqual({ '-2,0': 1, '2,0': 3, '1,1': 1 });
    expect(isHexConquered(next, '2,0')).toBe(true);
    expect(next.players[0]!.gold).toBe(gold + 2);
    expect(next.barbarianAttack.supply).toBe(s.barbarianAttack.supply);
  });

  it('Treason takes from the supply when the board has too few barbarians', () => {
    let s = withBarbs(mainPhase(), { '0,2': 1 });
    s = buy(s, 'treason');
    const supply = s.barbarianAttack.supply;
    const next = applyAction(s, {
      type: 'resolveBarbarianCard', playerId: 'p0',
      moves: [{ from: '0,2', to: '1,1' }, { from: null, to: '0,-2' }],
    }) as BarbarianAttackGame;
    expect(next.barbarianAttack.barbarians).toEqual({ '1,1': 1, '0,-2': 1 });
    expect(next.barbarianAttack.supply).toBe(supply - 1);
  });

  it('may not move a barbarian onto a conquered hex', () => {
    let s = withBarbs(mainPhase(), { '0,2': 1, '-2,0': 1, '2,0': 3 });
    s = buy(s, 'treason');
    expect(() =>
      applyAction(s, {
        type: 'resolveBarbarianCard', playerId: 'p0',
        moves: [{ from: '0,2', to: '2,0' }, { from: '-2,0', to: '1,1' }],
      }),
    ).toThrow();
  });

  it('reshuffles the discard pile when the deck runs out', () => {
    let s = patchBa(mainPhase(), () => ({ deck: [], discard: ['knighthood', 'knighthood'] }));
    s = giveResources(s, 'p0', { sheep: 1, wheat: 1, ore: 1 }) as BarbarianAttackGame;
    s = applyAction(s, { type: 'buyDevCard', playerId: 'p0' }) as BarbarianAttackGame;
    expect(s.barbarianAttack.pendingCard?.card).toBe('knighthood');
    expect(s.barbarianAttack.deck).toEqual(['knighthood']);
    expect(s.barbarianAttack.discard).toEqual([]);
  });
});

describe('Barbarian Attack — moving knights', () => {
  // p0's knight on the edge between (0,0) and (1,0).
  function withKnight(edge?: EdgeId): [BarbarianAttackGame, EdgeId] {
    const s = mainPhase();
    const e = edge ?? edgeBetween(s, '0,0', '1,0');
    return [patchBa(s, () => ({ knights: { [e]: 'p0' } })), e];
  }

  it('end of turn opens the knight step when you have knights; Done passes the turn', () => {
    let [s] = withKnight();
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    expect(s.phase).toBe('barbarianKnightMoves');
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    expect(s.phase).toBe('rollOrPlayKnight');
    expect(s.playerOrder[s.currentPlayerIndex]).toBe('p1');
  });

  it('without knights the turn ends at once', () => {
    let s = mainPhase();
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    expect(s.phase).toBe('rollOrPlayKnight');
  });

  it('moves up to 3 edges free, 4-5 for 1 wheat, once per knight', () => {
    let [s, e] = withKnight();
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    const targets = knightMoveTargets(s, e);
    const near = targets.find((t) => t.distance === 3)!;
    const far = targets.find((t) => t.distance === 5)!;
    expect(targets.some((t) => t.distance > 5)).toBe(false);
    // Too far without the boost / without wheat.
    expect(() => applyAction(s, { type: 'moveBarbarianKnight', playerId: 'p0', from: e, to: far.edge })).toThrow();
    const noWheat = { ...s, players: s.players.map((p) => (p.id === 'p0' ? { ...p, resources: { ...p.resources, wheat: 0 } } : p)) };
    expect(() =>
      applyAction(noWheat, { type: 'moveBarbarianKnight', playerId: 'p0', from: e, to: far.edge, boost: true }),
    ).toThrow();
    // 3 edges: free.
    const free = applyAction(s, { type: 'moveBarbarianKnight', playerId: 'p0', from: e, to: near.edge }) as BarbarianAttackGame;
    expect(free.barbarianAttack.knights[near.edge]).toBe('p0');
    expect(free.barbarianAttack.knights[e]).toBeUndefined();
    expect(free.players[0]!.resources).toEqual(s.players[0]!.resources);
    // The same knight can't move again.
    const again = knightMoveTargets(free, near.edge)[0]!;
    expect(() =>
      applyAction(free, { type: 'moveBarbarianKnight', playerId: 'p0', from: near.edge, to: again.edge }),
    ).toThrow();
    // 5 edges with wheat.
    const rich = giveResources(s, 'p0', { wheat: 1 });
    const boosted = applyAction(rich, {
      type: 'moveBarbarianKnight', playerId: 'p0', from: e, to: far.edge, boost: true,
    });
    expect(boosted.players[0]!.resources.wheat).toBe(rich.players[0]!.resources.wheat - 1);
  });

  it('ends on an edge without a knight and never on a castle edge', () => {
    const s0 = mainPhase();
    const e = edgeBetween(s0, '-2,1', '-1,1');
    const other = edgeBetween(s0, '-2,1', '-1,0');
    let s = patchBa(s0, () => ({ knights: { [e]: 'p0', [other]: 'p1' } }));
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    const targets = knightMoveTargets(s, e).map((t) => t.edge);
    expect(targets).not.toContain(other);
    const castleEdges = s.board.edgeIds.filter((x) => s.board.edges[x]!.hexes.includes('-2,2'));
    for (const c of castleEdges) expect(targets).not.toContain(c);
    expect(() => applyAction(s, { type: 'moveBarbarianKnight', playerId: 'p0', from: e, to: other })).toThrow();
  });

  it('a knight on a castle edge must move before the turn ends', () => {
    const s0 = mainPhase();
    const castleEdge = edgeBetween(s0, '-2,2', '-1,2');
    let s = patchBa(s0, () => ({ knights: { [castleEdge]: 'p0' } }));
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    expect(() => applyAction(s, { type: 'endTurn', playerId: 'p0' })).toThrow(/castle/);
    const to = knightMoveTargets(s, castleEdge).find((t) => !t.boost)!;
    s = applyAction(s, { type: 'moveBarbarianKnight', playerId: 'p0', from: castleEdge, to: to.edge }) as BarbarianAttackGame;
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    expect(s.phase).toBe('rollOrPlayKnight');
  });
});

describe('Barbarian Attack — expelling barbarians', () => {
  function edgesOf(s: GameState, hex: HexId): EdgeId[] {
    return [0, 1, 2, 3, 4, 5].map((d) => hexEdge(s, hex, d));
  }

  it('needs at least 1 barbarian and more knights than barbarians', () => {
    const s0 = mainPhase();
    const [e0, e1] = edgesOf(s0, '2,0');
    // 1 barbarian, 1 knight: no victory.
    let s = patchBa(s0, () => ({ barbarians: { '2,0': 1 }, knights: { [e0!]: 'p0' } }));
    expect(expelBarbarians(s, 'p0')).toBe(s);
    // 2 knights beat 1 barbarian; the single involved player takes it.
    s = patchBa(s0, () => ({ barbarians: { '2,0': 1 }, knights: { [e0!]: 'p0', [e1!]: 'p0' } }));
    const next = expelBarbarians(s, 'p0') as BarbarianAttackGame;
    expect(next.barbarianAttack.barbarians['2,0']).toBeUndefined();
    expect(next.barbarianAttack.prisoners.p0).toBe(1);
    // No barbarian, any knights: nothing.
    s = patchBa(s0, () => ({ barbarians: {}, knights: { [e0!]: 'p0', [e1!]: 'p0' } }));
    expect(expelBarbarians(s, 'p0')).toBe(s);
  });

  it('two players: 1 prisoner each, the leftover to whoever has more knights', () => {
    const s0 = mainPhase();
    const [a, b, c, d] = edgesOf(s0, '2,0');
    const s = patchBa(s0, () => ({
      barbarians: { '2,0': 3 },
      knights: { [a!]: 'p0', [b!]: 'p0', [c!]: 'p0', [d!]: 'p1' },
    }));
    const next = expelBarbarians(s, 'p0') as BarbarianAttackGame;
    const res = (next.barbarianAttack.lastEvents!.events[0] as { results: Array<{ prisoners: Record<string, number>; liberated: boolean }> }).results[0]!;
    expect(res.prisoners).toEqual({ p0: 2, p1: 1 });
    expect(res.liberated).toBe(true);
    expect(next.barbarianAttack.prisoners).toMatchObject({ p0: 2, p1: 1 });
  });

  it('a tie for the leftover is rolled for; the loser takes 3 gold', () => {
    const [prisoners, consolation] = distributePrisoners(['p0', 'p1'], { p0: 2, p1: 2 }, 3, 12345, {});
    expect(prisoners.p0! + prisoners.p1!).toBe(3);
    expect(Math.max(prisoners.p0!, prisoners.p1!)).toBe(2);
    expect(consolation).toHaveLength(1);
    expect(prisoners[consolation[0]!]).toBe(1);
  });

  it('too few prisoners: everyone rolls, the rest take 3 gold each', () => {
    const rolls: Record<string, number[]> = {};
    const [prisoners, consolation] = distributePrisoners(['p0', 'p1', 'p2'], { p0: 1, p1: 1, p2: 1 }, 2, 999, rolls);
    expect(Object.keys(prisoners)).toHaveLength(2);
    expect(consolation).toHaveLength(1);
    expect(Object.keys(rolls).sort()).toEqual(['p0', 'p1', 'p2']);
    const [p1only, cons1] = distributePrisoners(['p0', 'p1'], { p0: 3, p1: 1 }, 1, 7, {});
    expect(Object.values(p1only)).toEqual([1]);
    expect(cons1).toHaveLength(1);
  });

  it('pays the consolation gold and removes knights on the rolled orientation (+3 gold each)', () => {
    const s0 = mainPhase();
    const edges = edgesOf(s0, '2,0');
    const knights = Object.fromEntries(edges.map((e, i) => [e, i % 2 === 0 ? 'p0' : 'p1']));
    const s = patchBa(s0, () => ({ barbarians: { '2,0': 1 }, knights }));
    const next = expelBarbarians(s, 'p0') as BarbarianAttackGame;
    const ev = next.barbarianAttack.lastEvents!.events[0]!;
    if (ev.kind !== 'expel') throw new Error('expected expel');
    const r = ev.results[0]!;
    // Exactly the two edges of the rolled orientation lose their knights.
    const lost = edges.filter((e) => !next.barbarianAttack.knights[e]);
    expect(lost).toHaveLength(2);
    for (const e of lost) expect(edgeColor(s, e)).toBe(r.lossColor);
    // Gold: 3 per knight lost + 3 for the player left without a prisoner.
    for (const pid of ['p0', 'p1']) {
      const lostN = r.knightsLost[pid] ?? 0;
      const cons = r.consolation.includes(pid) ? 3 : 0;
      const p = next.players.find((x) => x.id === pid)!;
      const before = s.players.find((x) => x.id === pid)!;
      expect((p.gold ?? 0) - (before.gold ?? 0)).toBe(3 * lostN + cons);
    }
  });

  it('checks hexes in order, so a knight lost on one hex no longer counts on the next', () => {
    const s0 = mainPhase();
    // (-2,1) [first] and (-2,0) [second] share an edge.
    const shared = edgeBetween(s0, '-2,1', '-2,0');
    const a = edgesOf(s0, '-2,1').find((e) => e !== shared && !s0.board.edges[e]!.hexes.includes('-2,0'))!;
    const b = edgesOf(s0, '-2,0').find((e) => e !== shared && !s0.board.edges[e]!.hexes.includes('-2,1'))!;
    const s = patchBa(s0, () => ({
      barbarians: { '-2,1': 1, '-2,0': 1 },
      knights: { [shared]: 'p0', [a]: 'p0', [b]: 'p0' },
    }));
    expect(knightsOnHex(s, '-2,0').p0).toBe(2);
    let sawLost = false;
    let sawKept = false;
    for (let seed = 1; seed < 200 && !(sawLost && sawKept); seed++) {
      const next = expelBarbarians({ ...s, rngState: seed }, 'p0') as BarbarianAttackGame;
      const ev = next.barbarianAttack.lastEvents!.events[0]!;
      if (ev.kind !== 'expel') throw new Error('expected expel');
      expect(ev.results[0]!.hex).toBe('-2,1');
      if (ev.results[0]!.lossColor === edgeColor(s, shared)) {
        // The shared knight fell on the 4: the 12 is now 1 knight v 1.
        sawLost = true;
        expect(ev.results.map((r) => r.hex)).toEqual(['-2,1']);
      } else {
        sawKept = true;
        expect(ev.results.map((r) => r.hex)).toEqual(['-2,1', '-2,0']);
      }
    }
    expect(sawLost && sawKept).toBe(true);
  });

  it('runs at the end of the turn; prisoners pair into VP and can win the game', () => {
    const s0 = mainPhase();
    const [a, b, c, d] = edgesOf(s0, '2,0');
    let s = patchBa(s0, (ba) => ({
      barbarians: { '2,0': 3 },
      knights: { [a!]: 'p0', [b!]: 'p0', [c!]: 'p0', [d!]: 'p0' },
      prisoners: { ...ba.prisoners, p0: 1 },
    }));
    const vp = calculateVictoryPoints(s, 'p0', true);
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    s = applyAction(s, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    expect(s.barbarianAttack.prisoners.p0).toBe(4);
    expect(calculateVictoryPoints(s, 'p0', true)).toBe(vp + 2);

    // Same fight with the player 2 VP from the target: they win on their turn.
    let w = patchBa(s0, (ba) => ({
      barbarians: { '2,0': 3 },
      knights: { [a!]: 'p0', [b!]: 'p0', [c!]: 'p0', [d!]: 'p0' },
      prisoners: { ...ba.prisoners, p0: 1 },
    }));
    w = { ...w, settings: { ...w.settings, victoryPointsToWin: vp + 2 } } as BarbarianAttackGame;
    w = applyAction(w, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    w = applyAction(w, { type: 'endTurn', playerId: 'p0' }) as BarbarianAttackGame;
    expect(w.phase).toBe('gameOver');
    expect(w.winner).toBe('p0');
  });
});
