import { describe, it, expect } from 'vitest';
import { createGame } from '../../../createGame';
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

  // Discovery by road / ship (rulebook: "When you place a ship or road
  // adjacent to an intersection with an empty hex space") is covered end to
  // end in ../rules.test.ts.
});
