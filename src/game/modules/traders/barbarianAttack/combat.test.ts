import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { advanceBarbarians } from './advance';
import { resolveCombat } from './combat';
import type { GameState, EdgeId } from '../../../types';

function newGame(seed = 1) {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed,
    settings: {
      expansions: ['traders'],
      tradersScenarioId: 'barbarianAttack',
    },
    randomizeTurnOrder: false,
  });
}

// Helper: walk barbarians to the castle (3 advances after position 0).
function marchToCastle(s: GameState): GameState {
  let next = s;
  for (let i = 0; i < 3; i++) next = advanceBarbarians(next);
  return next;
}

// Helper: place enough defender knights for a winning defense on the
// FIRST castle in state.castles. Knights belong to playerId.
function arrangeDefenders(
  s: GameState,
  playerId: string,
  count: number,
): GameState {
  const castle = s.castles![0]!;
  const hex = s.board.hexes[castle.hexId]!;
  // Find `count` distinct edges that bound the castle hex.
  const edges: EdgeId[] = [];
  for (const e of Object.values(s.board.edges)) {
    if (e.hexes.includes(castle.hexId)) edges.push(e.id);
    if (edges.length === count) break;
  }
  expect(edges.length).toBe(count);
  return {
    ...s,
    players: s.players.map((p) =>
      p.id === playerId ? { ...p, defenderKnights: edges } : p,
    ),
    barbarianKnightSupply: (s.barbarianKnightSupply ?? 0) - count,
    // Avoid TS-unused-var warning while keeping hex for context.
    ...(hex ? {} : {}),
  };
}

describe('resolveCombat', () => {
  it('is a no-op when barbarians have not yet arrived', () => {
    const s = newGame();
    expect(resolveCombat(s).castles![0]!.barbarianPosition).toBe(0);
  });

  it('wins defense, awards 1 VP per knight, half the knights die', () => {
    let s = newGame();
    s = arrangeDefenders(s, 'p0', 4); // 4 knights matches strength 4
    s = marchToCastle(s);
    const next = resolveCombat(s);
    const castle = next.castles![0]!;
    expect(castle.defenderVp['p0']).toBe(4);
    // 4 knights × ceil(50%) = 2 dead, 2 alive.
    const p0 = next.players.find((p) => p.id === 'p0')!;
    expect(p0.defenderKnights).toHaveLength(2);
    // Supply gets the 2 dead knights back.
    expect(next.barbarianKnightSupply).toBe(
      (s.barbarianKnightSupply ?? 0) + 2,
    );
    // Barbarian resets.
    expect(castle.barbarianPosition).toBe(0);
  });

  it('loses defense, all defending knights die, supply refunded', () => {
    let s = newGame();
    s = arrangeDefenders(s, 'p0', 2); // 2 < strength 4
    // Give p0 a settlement on a castle corner so they lose a building.
    const castle = s.castles![0]!;
    const corner = s.board.hexes[castle.hexId]!.corners[0]!;
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p0' ? { ...p, settlements: [corner] } : p,
      ),
    };
    s = marchToCastle(s);
    const next = resolveCombat(s);
    const c = next.castles![0]!;
    expect(c.defenderVp['p0']).toBeUndefined();
    // All knights die.
    const p0 = next.players.find((p) => p.id === 'p0')!;
    expect(p0.defenderKnights).toEqual([]);
    // Settlement got destroyed.
    expect(p0.settlements).toEqual([]);
    // Supply gained back 2.
    expect(next.barbarianKnightSupply).toBe(
      (s.barbarianKnightSupply ?? 0) + 2,
    );
    expect(c.barbarianPosition).toBe(0);
  });

  it('rout with city downgrades to a settlement (Volcano pattern)', () => {
    let s = newGame();
    const castle = s.castles![0]!;
    const corner = s.board.hexes[castle.hexId]!.corners[0]!;
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1' ? { ...p, cities: [corner] } : p,
      ),
    };
    s = marchToCastle(s);
    const next = resolveCombat(s);
    const p1 = next.players.find((p) => p.id === 'p1')!;
    expect(p1.cities).toEqual([]);
    expect(p1.settlements).toEqual([corner]);
  });

  it('rout with no defenders picks a player with a building on the castle', () => {
    let s = newGame();
    const castle = s.castles![0]!;
    const corner = s.board.hexes[castle.hexId]!.corners[0]!;
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p2' ? { ...p, settlements: [corner] } : p,
      ),
    };
    s = marchToCastle(s);
    const next = resolveCombat(s);
    const p2 = next.players.find((p) => p.id === 'p2')!;
    expect(p2.settlements).toEqual([]);
  });

  it('rout with no defenders and no buildings is a silent no-op', () => {
    let s = newGame();
    s = marchToCastle(s);
    expect(() => resolveCombat(s)).not.toThrow();
    // Barbarian still resets even without a victim.
    expect(resolveCombat(s).castles![0]!.barbarianPosition).toBe(0);
  });
});
