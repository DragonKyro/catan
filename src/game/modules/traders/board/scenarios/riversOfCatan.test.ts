import { describe, it, expect } from 'vitest';
import { createGame } from '../../../../createGame';
import { hexNumbers } from '../../../../board/hexNumbers';
import type { GameState } from '../../../../types';

function newRiversGame(seed = 1, players = 3): GameState {
  return createGame({
    playerNames: ['A', 'B', 'C', 'D'].slice(0, players),
    seed,
    settings: {
      expansions: ['traders'],
      tradersScenarioId: 'riversOfCatan',
    },
    randomizeTurnOrder: false,
  });
}

const RIVER_TILES: Array<[string, string]> = [
  ['-1,-1', 'ore'],
  ['-1,0', 'brick'],
  ['-1,1', 'sheep'],
  ['-1,2', 'swamp'],
  ['1,-1', 'ore'],
  ['1,0', 'brick'],
  ['1,1', 'swamp'],
];

// The hexes on either side of an edge (one is off the island for a mouth).
function edgeHexes(s: GameState, eid: string): string[] {
  return [...s.board.edges[eid]!.hexes].sort();
}

describe('Rivers of Catan board (rulebook p. 11)', () => {
  it('pins the two river tiles at their printed places', () => {
    for (const seed of [1, 2, 3, 4]) {
      const s = newRiversGame(seed);
      for (const [id, terrain] of RIVER_TILES) {
        expect(s.board.hexes[id]!.terrain).toBe(terrain);
      }
    }
  });

  it('uses the base set minus 2 hills, 2 pastures, 2 mountains and the desert', () => {
    const s = newRiversGame(5);
    const count: Record<string, number> = {};
    for (const h of Object.values(s.board.hexes)) {
      if (h.terrain === 'sea') continue;
      count[h.terrain] = (count[h.terrain] ?? 0) + 1;
    }
    expect(count).toEqual({ wood: 4, sheep: 3, wheat: 4, brick: 3, ore: 3, swamp: 2 });
  });

  it('puts the 2 on the 12 hex: one hex produces on 2 and 12, swamps have none', () => {
    for (const seed of [1, 7, 11, 23]) {
      const s = newRiversGame(seed);
      const numbered = Object.values(s.board.hexes).filter((h) => hexNumbers(h).length > 0);
      expect(numbered).toHaveLength(17);
      const all = numbered.flatMap((h) => hexNumbers(h)).sort((a, b) => a - b);
      expect(all).toEqual([2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12]);
      const doubled = numbered.filter((h) => hexNumbers(h).length === 2);
      expect(doubled).toHaveLength(1);
      expect(hexNumbers(doubled[0]!)).toEqual([12, 2]);
      for (const h of Object.values(s.board.hexes)) {
        if (h.terrain === 'swamp') expect(hexNumbers(h)).toEqual([]);
      }
    }
  });

  it('has exactly the seven bridge sites where the rivers cross or meet an edge', () => {
    const s = newRiversGame();
    const sites = (s.riverEdges ?? []).map((e) => edgeHexes(s, e).join('|')).sort();
    expect(sites).toEqual(
      [
        ['-1,-1', '-1,0'],
        ['-1,0', '-1,1'],
        ['-1,1', '-1,2'],
        ['-1,2', '-2,3'], // River A's mouth: the swamp's SW edge
        ['1,-1', '1,0'],
        ['1,0', '1,1'],
        ['1,1', '2,1'], // River B's mouth: the swamp's E edge
      ]
        .map((p) => p.sort().join('|'))
        .sort(),
    );
    expect(s.rivers?.map((r) => r.hexes)).toEqual([
      ['-1,-1', '-1,0', '-1,1', '-1,2'],
      ['1,-1', '1,0', '1,1'],
    ]);
  });

  it('starts the robber on a swamp and draws no pirate', () => {
    const s = newRiversGame();
    expect(s.board.robberHex).toBe('1,1');
    expect(s.robberActive).toBeUndefined();
    expect(s.board.pirateHex).toBeUndefined();
  });

  it('uses the nine printed T&B frame harbors', () => {
    const s = newRiversGame();
    const types = s.board.ports.map((p) => p.type).sort();
    expect(types).toEqual(
      ['brick', 'generic', 'generic', 'generic', 'generic', 'ore', 'sheep', 'wheat', 'wood'],
    );
  });

  it('puts coins in play and hands every player a Poor Catanian tile at the start', () => {
    const s = newRiversGame();
    expect(s.coinsInPlay).toBe(true);
    expect(s.wealthTiles).toEqual({ wealthiest: null, poor: ['p0', 'p1', 'p2'] });
    for (const p of s.players) expect(p.gold).toBe(0);
  });

  it('sets victory points to 10 (Rivers default)', () => {
    const s = newRiversGame();
    expect(s.settings.victoryPointsToWin).toBe(10);
  });

  it('bumps target VP by 1 with the Strongest Ports variant', () => {
    const s = createGame({
      playerNames: ['A', 'B', 'C'],
      seed: 1,
      settings: {
        expansions: ['traders'],
        tradersScenarioId: 'riversOfCatan',
        tradersVariants: { strongestPorts: true },
      },
      randomizeTurnOrder: false,
    });
    expect(s.settings.victoryPointsToWin).toBe(11);
    expect(s.strongestPorts).toEqual({ holder: null });
  });

  it('rejects 7+ player Rivers games (no 7-8 board)', () => {
    expect(() =>
      createGame({
        playerNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        seed: 1,
        settings: {
          expansions: ['traders'],
          tradersScenarioId: 'riversOfCatan',
        },
        randomizeTurnOrder: false,
      }),
    ).toThrow(/at most 6 players/);
  });
});
