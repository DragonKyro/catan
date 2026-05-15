import { describe, it, expect } from 'vitest';
import { createGame } from './createGame';

describe('createGame', () => {
  it('rejects fewer than 2 players', () => {
    expect(() => createGame({ playerNames: ['Alice'], seed: 1 })).toThrow();
  });

  it('rejects more than 6 players', () => {
    expect(() =>
      createGame({ playerNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], seed: 1 }),
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
});
