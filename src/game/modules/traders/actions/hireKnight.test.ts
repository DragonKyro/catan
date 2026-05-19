import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import type { GameState, EdgeId } from '../../../types';

function newGame() {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 1,
    settings: {
      expansions: ['traders'],
      tradersScenarioId: 'barbarianAttack',
    },
    randomizeTurnOrder: false,
  });
}

// Setup helper: jump past placement, give p0 wheat+ore for one knight,
// and put us in main phase.
function readyForHire(): { state: GameState; castleEdges: EdgeId[] } {
  const s = newGame();
  const castle = s.castles![0]!;
  const castleEdges: EdgeId[] = [];
  for (const e of Object.values(s.board.edges)) {
    if (e.hexes.includes(castle.hexId)) castleEdges.push(e.id);
  }
  const ready: GameState = {
    ...s,
    phase: 'main',
    hasRolledThisTurn: true,
    players: s.players.map((p) =>
      p.id === 'p0'
        ? {
            ...p,
            resources: { ...p.resources, wheat: 2, ore: 2 },
          }
        : p,
    ),
  };
  return { state: ready, castleEdges };
}

describe('handleHireKnight', () => {
  it('places a knight, deducts cost, decrements supply', () => {
    const { state, castleEdges } = readyForHire();
    const edge = castleEdges[0]!;
    const next = applyAction(state, {
      type: 'hireKnight',
      playerId: 'p0',
      edge,
    });
    const p0 = next.players.find((p) => p.id === 'p0')!;
    expect(p0.defenderKnights).toEqual([edge]);
    expect(p0.resources.wheat).toBe(1);
    expect(p0.resources.ore).toBe(1);
    expect(next.barbarianKnightSupply).toBe(17);
  });

  it('rejects placement on a non-castle edge', () => {
    const { state } = readyForHire();
    // Pick any edge NOT bounding a castle.
    const castleHexes = new Set(state.castles!.map((c) => c.hexId));
    const offEdge = Object.values(state.board.edges).find(
      (e) => !e.hexes.some((h) => castleHexes.has(h)),
    )!;
    expect(() =>
      applyAction(state, {
        type: 'hireKnight',
        playerId: 'p0',
        edge: offEdge.id,
      }),
    ).toThrow(/Invalid knight placement/);
  });

  it('rejects placement when player cannot afford', () => {
    const { state, castleEdges } = readyForHire();
    const broke: GameState = {
      ...state,
      players: state.players.map((p) =>
        p.id === 'p0'
          ? { ...p, resources: { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 } }
          : p,
      ),
    };
    expect(() =>
      applyAction(broke, {
        type: 'hireKnight',
        playerId: 'p0',
        edge: castleEdges[0]!,
      }),
    ).toThrow(/Cannot afford/);
  });

  it('rejects when the supply is empty', () => {
    const { state, castleEdges } = readyForHire();
    const empty: GameState = { ...state, barbarianKnightSupply: 0 };
    expect(() =>
      applyAction(empty, {
        type: 'hireKnight',
        playerId: 'p0',
        edge: castleEdges[0]!,
      }),
    ).toThrow(/No defender knights/);
  });

  it('rejects when the edge is already occupied by a defender knight', () => {
    const { state, castleEdges } = readyForHire();
    const edge = castleEdges[0]!;
    // First hire fills the edge.
    const after = applyAction(state, {
      type: 'hireKnight',
      playerId: 'p0',
      edge,
    });
    // Give p0 more resources to try again on the same edge.
    const retry: GameState = {
      ...after,
      players: after.players.map((p) =>
        p.id === 'p0' ? { ...p, resources: { ...p.resources, wheat: 2, ore: 2 } } : p,
      ),
    };
    expect(() =>
      applyAction(retry, { type: 'hireKnight', playerId: 'p0', edge }),
    ).toThrow(/Invalid knight placement/);
  });
});
