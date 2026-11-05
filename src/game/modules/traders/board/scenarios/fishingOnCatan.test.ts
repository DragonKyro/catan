import { describe, it, expect } from 'vitest';
import { createGame } from '../../../../createGame';
import { hexNumbers } from '../../../../board/hexNumbers';
import type { GameState } from '../../../../types';

function newFishingGame(seed = 1): GameState {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed,
    settings: {
      expansions: ['traders'],
      tradersScenarioId: 'fishingOnCatan',
    },
    randomizeTurnOrder: false,
  });
}

const INNER = ['0,0', '1,-1', '1,0', '0,1', '-1,1', '-1,0', '0,-1'];

// Fishing grounds by their two coastal edges (named by the two hexes on
// either side of each edge), per TB-MAP-SPEC.
const GROUNDS: string[][][] = [
  [['0,-2', '1,-3'], ['1,-2', '1,-3']], // top
  [['0,-2', '-1,-2'], ['-1,-1', '-1,-2']], // upper left
  [['2,-1', '3,-1'], ['2,0', '3,-1']], // upper right
  [['2,0', '2,1'], ['1,1', '2,1']], // lower right
  [['-2,2', '-2,3'], ['-1,2', '-2,3']], // bottom
  [['-2,1', '-3,2'], ['-2,2', '-3,2']], // lower left
];

describe('Fishing on Catan board (rulebook p. 9)', () => {
  it('puts the lake somewhere in the inner area, at a random spot', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const s = newFishingGame(seed);
      const lakes = Object.values(s.board.hexes).filter((h) => h.terrain === 'lake');
      expect(lakes).toHaveLength(1);
      expect(INNER).toContain(lakes[0]!.id);
      expect(s.lakeHexId).toBe(lakes[0]!.id);
      seen.add(lakes[0]!.id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(5);
  });

  it('uses the 18 base land hexes and all 18 base number discs', () => {
    const s = newFishingGame(3);
    const count: Record<string, number> = {};
    for (const h of Object.values(s.board.hexes)) {
      if (h.terrain === 'sea') continue;
      count[h.terrain] = (count[h.terrain] ?? 0) + 1;
    }
    expect(count).toEqual({ wood: 4, sheep: 4, wheat: 4, brick: 3, ore: 3, lake: 1 });
    const discs = Object.values(s.board.hexes)
      .filter((h) => h.terrain !== 'sea' && h.terrain !== 'lake')
      .map((h) => {
        expect(h.extraNumbers).toBeUndefined();
        return h.numberToken!;
      })
      .sort((a, b) => a - b);
    expect(discs).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
  });

  it('prints 2, 3, 11 and 12 on the lake', () => {
    const s = newFishingGame();
    expect(hexNumbers(s.board.hexes[s.lakeHexId!]!).sort((a, b) => a - b)).toEqual([2, 3, 11, 12]);
  });

  it('fills the six coastal notches with fishing grounds numbered 4, 5, 6, 8, 9, 10', () => {
    for (const seed of [1, 2, 9]) {
      const s = newFishingGame(seed);
      const fgs = s.fishingGrounds ?? [];
      expect(fgs).toHaveLength(6);
      expect(fgs.map((f) => f.token).sort((a, b) => a - b)).toEqual([4, 5, 6, 8, 9, 10]);
      const named = fgs.map((fg) =>
        fg.edges.map((e) => [...s.board.edges[e]!.hexes].sort().join('|')).sort(),
      );
      expect(named.map((n) => n.join(' ')).sort()).toEqual(
        GROUNDS.map((g) => g.map((e) => [...e].sort().join('|')).sort().join(' ')).sort(),
      );
      for (const fg of fgs) {
        // Three corners: both edges' endpoints, the middle one shared.
        expect(new Set(fg.vertices).size).toBe(3);
        for (const e of fg.edges) {
          for (const v of s.board.edges[e]!.vertices) expect(fg.vertices).toContain(v);
        }
      }
      // No fishing ground lies on a harbor edge.
      const harborEdges = new Set(s.board.ports.map((p) => p.edge));
      for (const fg of fgs) for (const e of fg.edges) expect(harborEdges.has(e)).toBe(false);
    }
  });

  it('deals the fishing-ground numbers at random', () => {
    const orders = new Set<string>();
    for (let seed = 1; seed <= 10; seed++) {
      orders.add(newFishingGame(seed).fishingGrounds!.map((f) => f.token).join(','));
    }
    expect(orders.size).toBeGreaterThan(3);
  });

  it('seeds the 30-token fish pool plus the boot', () => {
    const s = newFishingGame();
    expect((s.fishTokenPool ?? []).length).toBe(30);
    const counts = { one: 0, two: 0, three: 0, oldBoot: 0 };
    for (const t of s.fishTokenPool ?? []) counts[t]++;
    expect(counts).toEqual({ one: 11, two: 10, three: 8, oldBoot: 1 });
    expect(s.fishTokenDiscard).toEqual([]);
    expect(s.oldBootHolder).toBeNull();
  });

  it('starts the robber beside the board, with no pirate and no coins', () => {
    const s = newFishingGame();
    expect(s.robberActive).toBe(false);
    expect(s.board.pirateHex).toBeUndefined();
    expect(s.coinsInPlay).toBeUndefined();
    expect(s.wealthTiles).toBeUndefined();
  });

  it('seeds players with an empty fish hand', () => {
    const s = newFishingGame();
    for (const p of s.players) expect(p.fishTokens).toEqual([]);
  });

  it('sets victory points to 10 (Fishing default)', () => {
    expect(newFishingGame().settings.victoryPointsToWin).toBe(10);
  });
});
