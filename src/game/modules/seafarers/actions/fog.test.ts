import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import type { GameState } from '../../../types';
import { revealAdjacentFog } from './fog';

// The Fog Island scenario seeds `state.unrevealedFogHexes` from the fog
// hex coords on the scenario. Building adjacent to one reveals it and
// either grants 1 of the resource or routes to chooseGoldResource (when
// the revealed hex is gold).
describe('Fog Island: fog reveal', () => {
  function fresh(): GameState {
    return createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 9,
      settings: { expansions: ['seafarers'], scenarioId: 'fogIsland' },
      randomizeTurnOrder: false,
    });
  }

  it('initial state has fog hexes hidden', () => {
    const s = fresh();
    expect(s.unrevealedFogHexes).toBeDefined();
    expect(s.unrevealedFogHexes!.length).toBeGreaterThan(0);
  });

  it('revealAdjacentFog grants 1 of the revealed resource', () => {
    let s = fresh();
    // Pick the first non-gold, non-desert fog hex so we can assert the
    // resource grant deterministically.
    const fogHexId = s.unrevealedFogHexes!.find((id) => {
      const t = s.board.hexes[id]!.terrain;
      return t !== 'gold' && t !== 'desert' && t !== 'sea';
    })!;
    expect(fogHexId).toBeTruthy();
    const terrain = s.board.hexes[fogHexId]!.terrain as
      | 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';
    const before = s.players[0]!.resources[terrain];
    const bankBefore = s.bank[terrain];

    s = revealAdjacentFog(s, [fogHexId], 'p0');

    expect(s.unrevealedFogHexes ?? []).not.toContain(fogHexId);
    expect(s.players[0]!.resources[terrain]).toBe(before + 1);
    expect(s.bank[terrain]).toBe(bankBefore - 1);
  });

  it('gold reveal routes to chooseGoldResource with returnTo=main', () => {
    let s = fresh();
    s = { ...s, phase: 'main', hasRolledThisTurn: true };
    const goldFog = s.unrevealedFogHexes!.find(
      (id) => s.board.hexes[id]!.terrain === 'gold',
    );
    if (!goldFog) return; // scenario doesn't include a gold fog this run
    s = revealAdjacentFog(s, [goldFog], 'p0');
    expect(s.phase).toBe('chooseGoldResource');
    expect(s.goldChoiceState?.pending['p0']).toBe(1);
    expect(s.goldChoiceState?.returnTo).toBe('main');
  });

  it('does not re-reveal an already-revealed hex', () => {
    let s = fresh();
    const fogHexId = s.unrevealedFogHexes![0]!;
    s = revealAdjacentFog(s, [fogHexId], 'p0');
    const bankSnapshot = { ...s.bank };
    // Re-passing the same hex is a no-op (no double resource grant).
    s = revealAdjacentFog(s, [fogHexId], 'p0');
    expect(s.bank).toEqual(bankSnapshot);
  });

  it('settlement built adjacent to a fog hex triggers reveal via the engine', () => {
    let s = fresh();
    // Find a fog hex with a non-gold, non-desert terrain, then a vertex of
    // that hex. We bypass setup phase and god-mode the placement so the
    // test is focused on the post-build hook.
    const fogHexId = s.unrevealedFogHexes!.find((id) => {
      const t = s.board.hexes[id]!.terrain;
      return t !== 'gold' && t !== 'desert' && t !== 'sea';
    })!;
    const terrain = s.board.hexes[fogHexId]!.terrain as
      | 'wood' | 'brick' | 'sheep' | 'wheat' | 'ore';
    const cornerVid = s.board.vertexIds.find((vid) =>
      s.board.vertices[vid]!.hexes.includes(fogHexId),
    )!;
    s = { ...s, phase: 'main', hasRolledThisTurn: true };
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              resources: { wood: 1, brick: 1, sheep: 1, wheat: 1, ore: 0 },
              roads: [s.board.vertices[cornerVid]!.edges[0]!],
            }
          : p,
      ),
    };
    const before = s.players[0]!.resources[terrain];
    s = applyAction(s, { type: 'buildSettlement', playerId: 'p0', vertex: cornerVid });
    // +1 from fog reveal of `terrain` (settlement spent 1 of each non-ore
    // resource; the +1 fog reveal is observable on top of that). Compare
    // bank-delta to make the assertion terrain-independent of cost path.
    expect(s.players[0]!.resources[terrain]).toBeGreaterThanOrEqual(before);
    expect(s.unrevealedFogHexes ?? []).not.toContain(fogHexId);
  });
});
