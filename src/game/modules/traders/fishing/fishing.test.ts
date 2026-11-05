import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction, hasPlayerWon } from '../../../engine';
import { getActingPlayerId } from '../../../helpers';
import { giveResources } from '../../../__testHelpers';
import type { FishTokenType, GameState, PlayerId, VertexId } from '../../../types';

// Fishing on Catan rules (T&B 2025 rulebook p. 9-10), one test per rule.

function fishing(seed = 1): GameState {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed,
    settings: { expansions: ['traders'], tradersScenarioId: 'fishingOnCatan' },
    randomizeTurnOrder: false,
  });
}

function rollPhase(s: GameState): GameState {
  return { ...s, phase: 'rollOrPlayKnight', setupState: undefined };
}
function mainPhase(s: GameState): GameState {
  return { ...s, phase: 'main', hasRolledThisTurn: true, setupState: undefined };
}

function settle(s: GameState, pid: PlayerId, v: VertexId, city = false): GameState {
  return {
    ...s,
    players: s.players.map((p) =>
      p.id === pid
        ? city
          ? { ...p, cities: [...p.cities, v] }
          : { ...p, settlements: [...p.settlements, v] }
        : p,
    ),
  };
}

function fish(s: GameState, pid: PlayerId): Array<'one' | 'two' | 'three'> {
  return s.players.find((p) => p.id === pid)!.fishTokens ?? [];
}

function setFish(s: GameState, pid: PlayerId, tokens: Array<'one' | 'two' | 'three'>): GameState {
  return { ...s, players: s.players.map((p) => (p.id === pid ? { ...p, fishTokens: tokens } : p)) };
}

// A pool with only fish (no boot), so draws are predictable in count.
function bootless(s: GameState, n = 20): GameState {
  const pool: FishTokenType[] = Array.from({ length: n }, (_, i) => (['one', 'two', 'three'] as const)[i % 3]!);
  return { ...s, fishTokenPool: pool, fishTokenDiscard: [] };
}

function dice(n: number): [number, number] {
  return n <= 7 ? [1, n - 1] : [6, n - 6];
}

describe('Fishing on Catan: production', () => {
  it('pays a settlement on any corner of a producing fishing ground 1 fish token, a city 2', () => {
    let s = bootless(rollPhase(fishing()));
    const fg = s.fishingGrounds![0]!;
    s = settle(s, 'p0', fg.vertices[0]!);
    s = settle(s, 'p1', fg.vertices[2]!, true);
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: dice(fg.token) });
    expect(fish(s, 'p0')).toHaveLength(1);
    expect(fish(s, 'p1')).toHaveLength(2);
    expect(s.fishTokenPool).toHaveLength(17);
  });

  it('pays the lake on each of its printed numbers, 2, 3, 11 and 12', () => {
    const base = bootless(rollPhase(fishing()));
    const lake = base.board.hexes[base.lakeHexId!]!;
    const s0 = settle(base, 'p0', lake.corners[0]!);
    for (const n of [2, 3, 11, 12]) {
      const s = applyAction(s0, { type: 'rollDice', playerId: 'p0', dice: dice(n) });
      expect(fish(s, 'p0').length).toBe(1);
    }
  });

  it('pays no resource cards for the lake', () => {
    let s = bootless(rollPhase(fishing()));
    const lake = s.board.hexes[s.lakeHexId!]!;
    s = settle(s, 'p0', lake.corners[0]!);
    const before = s.players[0]!.resources;
    // Pick a lake number no land hex next to that corner carries.
    const v = s.board.vertices[lake.corners[0]!]!;
    const n = [2, 3, 11, 12].find((x) =>
      v.hexes.every((h) => h === lake.id || s.board.hexes[h]!.numberToken !== x),
    )!;
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: dice(n) });
    expect(s.players[0]!.resources).toEqual(before);
  });

  it('lets the robber sit on the lake, blocking all four numbers', () => {
    let s = bootless(rollPhase(fishing()));
    const lake = s.board.hexes[s.lakeHexId!]!;
    s = settle(s, 'p1', lake.corners[0]!);
    s = { ...s, robberActive: true, board: { ...s.board, robberHex: lake.id } };
    for (const n of [2, 3, 11, 12]) {
      const after = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: dice(n) });
      expect(fish(after, 'p1')).toHaveLength(0);
    }
  });

  it('draws one token at a time, active player first, then clockwise', () => {
    let s = rollPhase(fishing());
    s = { ...s, currentPlayerIndex: 1, fishTokenPool: ['three', 'two', 'one'], fishTokenDiscard: [] };
    const fg = s.fishingGrounds![0]!;
    s = settle(s, 'p0', fg.vertices[0]!);
    s = settle(s, 'p1', fg.vertices[2]!);
    // A fixed-RNG draw order isn't observable, but the boot is: whoever draws
    // first from a pool of just the boot gets it.
    s = { ...s, fishTokenPool: ['oldBoot'] };
    s = applyAction(s, { type: 'rollDice', playerId: 'p1', dice: dice(fg.token) });
    expect(s.oldBootHolder).toBe('p1');
  });

  it('reveals the old boot at once and keeps it out of the fish hand', () => {
    let s = rollPhase(fishing());
    const fg = s.fishingGrounds![0]!;
    s = settle(s, 'p0', fg.vertices[1]!, true);
    s = { ...s, fishTokenPool: ['oldBoot', 'two'], fishTokenDiscard: [] };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: dice(fg.token) });
    expect(s.oldBootHolder).toBe('p0');
    expect(fish(s, 'p0')).toEqual(['two']);
  });

  it('reshuffles the discard pile when the supply runs out', () => {
    let s = rollPhase(fishing());
    const fg = s.fishingGrounds![0]!;
    s = settle(s, 'p0', fg.vertices[1]!, true);
    s = { ...s, fishTokenPool: ['one'], fishTokenDiscard: ['three', 'three'] };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: dice(fg.token) });
    expect(fish(s, 'p0').sort()).toEqual(['one', 'three']);
    expect(s.fishTokenDiscard).toEqual([]);
    expect(s.fishTokenPool).toEqual(['three']);
  });
});

describe('Fishing on Catan: the 7-token limit', () => {
  it('stops drawing at 7 tokens and offers the swap', () => {
    let s = bootless(rollPhase(fishing()));
    const fg = s.fishingGrounds![0]!;
    s = settle(s, 'p1', fg.vertices[1]!, true);
    s = setFish(s, 'p1', ['one', 'one', 'one', 'one', 'one', 'one']);
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: dice(fg.token) });
    expect(fish(s, 'p1')).toHaveLength(7);
    expect(s.phase).toBe('fishSwap');
    expect(getActingPlayerId(s)).toBe('p1');
  });

  it('swaps one token for a replacement, then play resumes', () => {
    let s = bootless(rollPhase(fishing()));
    const fg = s.fishingGrounds![0]!;
    s = settle(s, 'p1', fg.vertices[1]!);
    s = setFish(s, 'p1', ['one', 'one', 'one', 'two', 'two', 'three', 'three']);
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: dice(fg.token) });
    expect(s.phase).toBe('fishSwap');
    const pool = s.fishTokenPool!.length;
    s = applyAction(s, { type: 'swapFish', playerId: 'p1', token: 'one' });
    expect(fish(s, 'p1')).toHaveLength(7);
    expect(s.fishTokenPool).toHaveLength(pool - 1);
    expect(s.fishTokenDiscard).toEqual(['one']);
    expect(s.phase).toBe('main');
    expect(s.fishSwap).toBeUndefined();
  });

  it('may be declined', () => {
    let s = bootless(rollPhase(fishing()));
    const fg = s.fishingGrounds![0]!;
    s = settle(s, 'p1', fg.vertices[1]!);
    const hand: Array<'one' | 'two' | 'three'> = ['three', 'three', 'three', 'three', 'three', 'three', 'three'];
    s = setFish(s, 'p1', hand);
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: dice(fg.token) });
    s = applyAction(s, { type: 'swapFish', playerId: 'p1', token: null });
    expect(fish(s, 'p1')).toEqual(hand);
    expect(s.phase).toBe('main');
  });

  it('asks each capped player in turn order', () => {
    let s = bootless(rollPhase(fishing()));
    const fg = s.fishingGrounds![0]!;
    s = settle(s, 'p1', fg.vertices[0]!);
    s = settle(s, 'p2', fg.vertices[2]!);
    const seven: Array<'one' | 'two' | 'three'> = Array(7).fill('one');
    s = setFish(setFish(s, 'p1', seven), 'p2', seven);
    s = { ...s, currentPlayerIndex: 2 };
    s = applyAction(s, { type: 'rollDice', playerId: 'p2', dice: dice(fg.token) });
    expect(s.fishSwap?.queue).toEqual(['p2', 'p1']);
    expect(() => applyAction(s, { type: 'swapFish', playerId: 'p1', token: 'one' })).toThrow(/Not your/);
    s = applyAction(s, { type: 'swapFish', playerId: 'p2', token: null });
    expect(getActingPlayerId(s)).toBe('p1');
  });

  it('does not count the old boot toward the limit', () => {
    let s = bootless(rollPhase(fishing()));
    const fg = s.fishingGrounds![0]!;
    s = settle(s, 'p1', fg.vertices[1]!);
    s = setFish(s, 'p1', Array(6).fill('one'));
    s = { ...s, oldBootHolder: 'p1' };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: dice(fg.token) });
    expect(fish(s, 'p1')).toHaveLength(7);
    expect(s.phase).toBe('main');
  });
});

describe('Fishing on Catan: setup', () => {
  it('gives a fish token for a second settlement on a fishing ground', () => {
    let s = bootless(fishing());
    const fg = s.fishingGrounds![0]!;
    s = { ...s, phase: 'setupRound2', setupState: { step: 'settlement', lastPlacedSettlement: null } };
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: fg.vertices[1]! });
    expect(fish(s, 'p0')).toHaveLength(1);
  });

  it('gives a fish token for a second settlement on the lake', () => {
    let s = bootless(fishing());
    const lake = s.board.hexes[s.lakeHexId!]!;
    s = { ...s, phase: 'setupRound2', setupState: { step: 'settlement', lastPlacedSettlement: null } };
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: lake.corners[0]! });
    expect(fish(s, 'p0')).toHaveLength(1);
  });

  it('gives nothing for a first settlement there', () => {
    let s = bootless(fishing());
    const fg = s.fishingGrounds![0]!;
    s = applyAction(s, { type: 'placeInitialSettlement', playerId: 'p0', vertex: fg.vertices[1]! });
    expect(fish(s, 'p0')).toHaveLength(0);
  });
});

describe('Fishing on Catan: spending fish', () => {
  it('2: removes the robber; it returns on the next 7', () => {
    let s = mainPhase(fishing());
    s = { ...s, robberActive: true };
    s = setFish(s, 'p0', ['two']);
    s = applyAction(s, { type: 'spendFish', playerId: 'p0', tokens: ['two'], effect: { kind: 'removeRobber' } });
    expect(s.robberActive).toBe(false);
    expect(() =>
      applyAction(setFish(s, 'p0', ['two']), {
        type: 'spendFish',
        playerId: 'p0',
        tokens: ['two'],
        effect: { kind: 'removeRobber' },
      }),
    ).toThrow(/not on the board/);
  });

  it('3: steals a random resource card from the chosen player', () => {
    let s = mainPhase(fishing());
    s = giveResources(s, 'p1', { ore: 2 });
    s = setFish(s, 'p0', ['three']);
    s = applyAction(s, { type: 'spendFish', playerId: 'p0', tokens: ['three'], effect: { kind: 'steal', target: 'p1' } });
    expect(s.players[0]!.resources.ore).toBe(1);
    expect(s.players[1]!.resources.ore).toBe(1);
    expect(() =>
      applyAction(setFish(s, 'p0', ['three']), {
        type: 'spendFish',
        playerId: 'p0',
        tokens: ['three'],
        effect: { kind: 'steal', target: 'p2' },
      }),
    ).toThrow(/no resource cards/);
  });

  it('4: takes a resource card of your choice from the supply', () => {
    let s = mainPhase(fishing());
    s = setFish(s, 'p0', ['two', 'two']);
    s = applyAction(s, { type: 'spendFish', playerId: 'p0', tokens: ['two', 'two'], effect: { kind: 'takeFromBank', resource: 'wheat' } });
    expect(s.players[0]!.resources.wheat).toBe(1);
  });

  it('5: builds a road for free, under the normal placement rules', () => {
    let s = mainPhase(fishing());
    const v = s.board.hexes['0,0']!.corners[0]!;
    s = settle(s, 'p0', v);
    const edge = s.board.vertices[v]!.edges[0]!;
    s = setFish(s, 'p0', ['three', 'two']);
    s = applyAction(s, { type: 'spendFish', playerId: 'p0', tokens: ['three', 'two'], effect: { kind: 'buildRoad', edge } });
    expect(s.players[0]!.roads).toEqual([edge]);
    expect(s.players[0]!.resources.wood).toBe(0);
    const far = s.board.hexes['-2,2']!.corners[3]!;
    const farEdge = s.board.vertices[far]!.edges[0]!;
    expect(() =>
      applyAction(setFish(s, 'p0', ['three', 'two']), {
        type: 'spendFish',
        playerId: 'p0',
        tokens: ['three', 'two'],
        effect: { kind: 'buildRoad', edge: farEdge },
      }),
    ).toThrow(/Invalid road/);
  });

  it('7: takes the top development card for free (a VP card counts at once)', () => {
    let s = mainPhase(fishing());
    s = { ...s, devCardDeck: [...s.devCardDeck.slice(0, -1), 'victoryPoint'] };
    s = setFish(s, 'p0', ['three', 'three', 'one']);
    const deck = s.devCardDeck.length;
    s = applyAction(s, { type: 'spendFish', playerId: 'p0', tokens: ['three', 'three', 'one'], effect: { kind: 'buyDevCard' } });
    expect(s.devCardDeck).toHaveLength(deck - 1);
    expect(s.players[0]!.devCards.victoryPoints).toBe(1);
  });

  it('pays each action with its own tokens and loses the excess fish', () => {
    let s = mainPhase(fishing());
    s = setFish(s, 'p0', ['three', 'one']);
    // 3 fish can't pay for a 4-fish action.
    expect(() =>
      applyAction(s, { type: 'spendFish', playerId: 'p0', tokens: ['three'], effect: { kind: 'takeFromBank', resource: 'ore' } }),
    ).toThrow(/needs 4/);
    // A 3-fish token pays the 2-fish robber removal; the extra fish is lost.
    s = { ...s, robberActive: true };
    s = applyAction(s, { type: 'spendFish', playerId: 'p0', tokens: ['three'], effect: { kind: 'removeRobber' } });
    expect(fish(s, 'p0')).toEqual(['one']);
    expect(s.fishTokenDiscard).toEqual(['three']);
  });

  it('only on your own turn, in the action phase', () => {
    const s = setFish(mainPhase(fishing()), 'p1', ['three', 'one']);
    expect(() =>
      applyAction(s, { type: 'spendFish', playerId: 'p1', tokens: ['three', 'one'], effect: { kind: 'takeFromBank', resource: 'ore' } }),
    ).toThrow(/turn/);
  });

  it('keeps fish out of the hand size and away from the robber', () => {
    let s = rollPhase(fishing());
    s = setFish(s, 'p1', Array(7).fill('three'));
    s = giveResources(s, 'p1', { wood: 7 });
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] });
    expect(s.discardState).toBeUndefined();
  });
});

describe('Fishing on Catan: the old boot', () => {
  it('makes its holder need 11 VP', () => {
    let s = mainPhase(fishing());
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, settlements: ['a', 'b', 'c', 'd'], cities: ['e', 'f', 'g'] } : p,
      ),
    };
    // 4 + 6 = 10 VP.
    expect(hasPlayerWon(s, 'p0')).toBe(true);
    expect(hasPlayerWon({ ...s, oldBootHolder: 'p0' }, 'p0')).toBe(false);
  });

  it('passes only to a player with at least your public VP', () => {
    let s = mainPhase(fishing());
    s = settle(settle(s, 'p0', s.board.hexes['0,0']!.corners[0]!), 'p1', s.board.hexes['0,-2']!.corners[0]!);
    s = { ...s, oldBootHolder: 'p0' };
    expect(() => applyAction(s, { type: 'passOldBoot', playerId: 'p0', to: 'p2' })).toThrow(/at least as many/);
    s = applyAction(s, { type: 'passOldBoot', playerId: 'p0', to: 'p1' });
    expect(s.oldBootHolder).toBe('p1');
  });
});
