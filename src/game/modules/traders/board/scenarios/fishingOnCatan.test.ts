import { describe, it, expect } from 'vitest';
import { createGame } from '../../../../createGame';

function newFishingGame() {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 1,
    settings: {
      expansions: ['traders'],
      tradersScenarioId: 'fishingOnCatan',
    },
    randomizeTurnOrder: false,
  });
}

describe('Fishing on Catan scenario', () => {
  it('places a single lake hex at the centre', () => {
    const s = newFishingGame();
    const lakes = Object.values(s.board.hexes).filter(
      (h) => h.terrain === 'lake',
    );
    expect(lakes.length).toBe(1);
    expect(lakes[0]!.coord).toEqual({ q: 0, r: 0 });
  });

  it('records the lake hex id on state', () => {
    const s = newFishingGame();
    expect(s.lakeHexId).toBeDefined();
    expect(s.board.hexes[s.lakeHexId!]?.terrain).toBe('lake');
  });

  it('gives the lake a numeric token', () => {
    const s = newFishingGame();
    const lake = s.board.hexes[s.lakeHexId!]!;
    expect(typeof lake.numberToken).toBe('number');
  });

  it('resolves 6 fishing grounds to distinct vertices', () => {
    const s = newFishingGame();
    expect(s.fishingGrounds).toBeDefined();
    expect((s.fishingGrounds ?? []).length).toBe(6);
    const seenVerts = new Set((s.fishingGrounds ?? []).map((f) => f.vertex));
    expect(seenVerts.size).toBe(6);
    for (const fg of s.fishingGrounds ?? []) {
      expect(s.board.vertices[fg.vertex]).toBeDefined();
      expect(typeof fg.token).toBe('number');
    }
  });

  it('seeds the 30-token fish pool plus the boot', () => {
    const s = newFishingGame();
    expect(s.fishTokenPool).toBeDefined();
    expect((s.fishTokenPool ?? []).length).toBe(30);
    // Pool contains exactly 11 ones, 10 twos, 8 threes, 1 oldBoot.
    const counts = { one: 0, two: 0, three: 0, oldBoot: 0 };
    for (const t of s.fishTokenPool ?? []) counts[t]++;
    expect(counts).toEqual({ one: 11, two: 10, three: 8, oldBoot: 1 });
    expect(s.fishTokenDiscard).toEqual([]);
    expect(s.oldBootHolder).toBeNull();
  });

  it('starts the robber off-board (robberActive=false)', () => {
    const s = newFishingGame();
    expect(s.robberActive).toBe(false);
  });

  it('seeds players with an empty fish hand', () => {
    const s = newFishingGame();
    for (const p of s.players) {
      expect(p.fishTokens).toEqual([]);
    }
  });

  it('sets victory points to 10 (Fishing default)', () => {
    const s = newFishingGame();
    expect(s.settings.victoryPointsToWin).toBe(10);
  });
});
