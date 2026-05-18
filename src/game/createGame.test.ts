import { describe, it, expect } from 'vitest';
import { createGame } from './createGame';

describe('createGame', () => {
  it('rejects fewer than 2 players', () => {
    expect(() => createGame({ playerNames: ['Alice'], seed: 1 })).toThrow();
  });

  it('rejects more than 8 players', () => {
    expect(() =>
      createGame({
        playerNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
        seed: 1,
      }),
    ).toThrow();
  });

  it('creates a 5-player game', () => {
    const state = createGame({
      playerNames: ['A', 'B', 'C', 'D', 'E'],
      seed: 1,
    });
    expect(state.players).toHaveLength(5);
    const uniqueColors = new Set(state.players.map((p) => p.color));
    expect(uniqueColors.size).toBe(5);
  });

  it('creates a 6-player game', () => {
    const state = createGame({
      playerNames: ['A', 'B', 'C', 'D', 'E', 'F'],
      seed: 1,
    });
    expect(state.players).toHaveLength(6);
    const uniqueColors = new Set(state.players.map((p) => p.color));
    expect(uniqueColors.size).toBe(6);
  });

  it('creates a game with valid initial state', () => {
    const state = createGame({ playerNames: ['Alice', 'Bob', 'Carol'], seed: 42 });
    expect(state.players).toHaveLength(3);
    expect(state.players[0]!.color).toBe('red');
    expect(state.players[1]!.color).toBe('blue');
    expect(state.players[2]!.color).toBe('orange');
    expect(state.phase).toBe('setupRound1');
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.winner).toBeNull();
    expect(state.bank).toEqual({ wood: 19, brick: 19, sheep: 19, wheat: 19, ore: 19 });
  });

  it('shuffles a 25-card dev deck', () => {
    const state = createGame({ playerNames: ['A', 'B'], seed: 1 });
    expect(state.devCardDeck).toHaveLength(25);
    const counts: Record<string, number> = {};
    for (const c of state.devCardDeck) counts[c] = (counts[c] ?? 0) + 1;
    expect(counts).toEqual({
      knight: 14,
      roadBuilding: 2,
      yearOfPlenty: 2,
      monopoly: 2,
      victoryPoint: 5,
    });
  });

  it('is deterministic for the same seed', () => {
    const a = createGame({ playerNames: ['A', 'B', 'C'], seed: 42 });
    const b = createGame({ playerNames: ['A', 'B', 'C'], seed: 42 });
    expect(a.devCardDeck).toEqual(b.devCardDeck);
    expect(a.board.robberHex).toBe(b.board.robberHex);
  });

  it('uses default 10 victory points to win', () => {
    const state = createGame({ playerNames: ['A', 'B'], seed: 1 });
    expect(state.settings.victoryPointsToWin).toBe(10);
  });

  it('respects a custom victoryPointsToWin', () => {
    const state = createGame({
      playerNames: ['A', 'B'],
      seed: 1,
      settings: { victoryPointsToWin: 5 },
    });
    expect(state.settings.victoryPointsToWin).toBe(5);
  });

  describe('7-8 player extension', () => {
    const names8 = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

    it('creates a 7-player game on the 7-8 board variant', () => {
      const state = createGame({ playerNames: names8.slice(0, 7), seed: 1 });
      expect(state.players).toHaveLength(7);
      expect(state.boardVariant).toBe('7-8');
      expect(Object.keys(state.board.hexes)).toHaveLength(37);
      const uniqueColors = new Set(state.players.map((p) => p.color));
      expect(uniqueColors.size).toBe(7);
    });

    it('creates an 8-player game on the 7-8 board variant', () => {
      const state = createGame({ playerNames: names8, seed: 1 });
      expect(state.players).toHaveLength(8);
      expect(state.boardVariant).toBe('7-8');
      const uniqueColors = new Set(state.players.map((p) => p.color));
      expect(uniqueColors.size).toBe(8);
    });

    it('defaults VP target to 10 for 7-8 players (same as base game)', () => {
      const seven = createGame({ playerNames: names8.slice(0, 7), seed: 1 });
      const eight = createGame({ playerNames: names8, seed: 1 });
      expect(seven.settings.victoryPointsToWin).toBe(10);
      expect(eight.settings.victoryPointsToWin).toBe(10);
    });

    it('still respects an explicit victoryPointsToWin override', () => {
      const state = createGame({
        playerNames: names8,
        seed: 1,
        settings: { victoryPointsToWin: 13 },
      });
      expect(state.settings.victoryPointsToWin).toBe(13);
    });

    it('scales the resource bank to 24 per resource', () => {
      const state = createGame({ playerNames: names8, seed: 1 });
      expect(state.bank).toEqual({
        wood: 24,
        brick: 24,
        sheep: 24,
        wheat: 24,
        ore: 24,
      });
    });

    it('shuffles a 35-card dev deck', () => {
      const state = createGame({ playerNames: names8, seed: 1 });
      expect(state.devCardDeck).toHaveLength(35);
      const counts: Record<string, number> = {};
      for (const c of state.devCardDeck) counts[c] = (counts[c] ?? 0) + 1;
      expect(counts).toEqual({
        knight: 20,
        roadBuilding: 3,
        yearOfPlenty: 3,
        monopoly: 3,
        victoryPoint: 6,
      });
    });

    it('rejects Seafarers + 7-8 players (no official 7-8p Seafarers extension exists)', () => {
      expect(() =>
        createGame({
          playerNames: names8.slice(0, 7),
          seed: 1,
          settings: { expansions: ['seafarers'] },
        }),
      ).toThrow(/Seafarers supports at most 6/);
      expect(() =>
        createGame({
          playerNames: names8,
          seed: 1,
          settings: { expansions: ['seafarers'] },
        }),
      ).toThrow(/Seafarers supports at most 6/);
    });
  });
});
