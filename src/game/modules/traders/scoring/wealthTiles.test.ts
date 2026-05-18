import { describe, it, expect } from 'vitest';
import { recalcWealthTiles } from './wealthTiles';

function players(...golds: Array<{ id: string; gold: number }>) {
  return { players: golds };
}

describe('recalcWealthTiles', () => {
  it('returns null/empty when everyone is at 0 gold', () => {
    expect(
      recalcWealthTiles(
        players({ id: 'p0', gold: 0 }, { id: 'p1', gold: 0 }),
      ),
    ).toEqual({ wealthiest: null, poor: [] });
  });

  it('returns null/empty when everyone is tied above 0', () => {
    expect(
      recalcWealthTiles(
        players({ id: 'p0', gold: 3 }, { id: 'p1', gold: 3 }),
      ),
    ).toEqual({ wealthiest: null, poor: [] });
  });

  it('awards Wealthiest to the unique max-gold player and Poor to the unique min', () => {
    expect(
      recalcWealthTiles(
        players(
          { id: 'p0', gold: 5 },
          { id: 'p1', gold: 2 },
          { id: 'p2', gold: 0 },
        ),
      ),
    ).toEqual({ wealthiest: 'p0', poor: ['p2'] });
  });

  it('leaves Wealthiest unowned on a tie for the max', () => {
    expect(
      recalcWealthTiles(
        players(
          { id: 'p0', gold: 5 },
          { id: 'p1', gold: 5 },
          { id: 'p2', gold: 1 },
        ),
      ),
    ).toEqual({ wealthiest: null, poor: ['p2'] });
  });

  it('lists multiple Poor holders when several are tied at the min', () => {
    expect(
      recalcWealthTiles(
        players(
          { id: 'p0', gold: 5 },
          { id: 'p1', gold: 0 },
          { id: 'p2', gold: 0 },
        ),
      ),
    ).toEqual({ wealthiest: 'p0', poor: ['p1', 'p2'] });
  });
});
