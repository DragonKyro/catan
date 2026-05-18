import { describe, it, expect } from 'vitest';
import type { GameState } from '../../../types';
import { buildInitialFishPool, drawFish } from './pool';

function mockState(): GameState {
  return {
    rngState: 1234,
    fishTokenPool: buildInitialFishPool(),
    fishTokenDiscard: [],
    players: [],
  } as unknown as GameState;
}

describe('fish pool', () => {
  it('builds a 30-token pool with the rulebook distribution', () => {
    const pool = buildInitialFishPool();
    expect(pool.length).toBe(30);
    const counts = { one: 0, two: 0, three: 0, oldBoot: 0 };
    for (const t of pool) counts[t]++;
    expect(counts).toEqual({ one: 11, two: 10, three: 8, oldBoot: 1 });
  });

  it('drawFish removes the drawn token from the pool', () => {
    const start = mockState();
    const { token, state: after } = drawFish(start);
    expect(token).not.toBeNull();
    expect((after.fishTokenPool ?? []).length).toBe(29);
  });

  it('drawFish reshuffles the discard pile when the pool is empty', () => {
    const start: GameState = {
      ...mockState(),
      fishTokenPool: [],
      fishTokenDiscard: ['one', 'two', 'three'],
    };
    const { token, state: after } = drawFish(start);
    expect(token).not.toBeNull();
    // After draw: 2 tokens remain in pool (3 reshuffled in, 1 drawn).
    expect((after.fishTokenPool ?? []).length).toBe(2);
    expect((after.fishTokenDiscard ?? []).length).toBe(0);
  });

  it('drawFish returns null when both pool and discard are empty', () => {
    const start: GameState = {
      ...mockState(),
      fishTokenPool: [],
      fishTokenDiscard: [],
    };
    const { token } = drawFish(start);
    expect(token).toBeNull();
  });
});
