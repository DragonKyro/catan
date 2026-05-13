import { describe, it, expect } from 'vitest';
import { nextRng, shuffle, rollDice, rngInt } from './rng';

describe('rng', () => {
  it('is deterministic for the same seed', () => {
    const [a1] = nextRng(42);
    const [a2] = nextRng(42);
    expect(a1).toBe(a2);
  });

  it('produces values in [0, 1)', () => {
    let s = 12345;
    for (let i = 0; i < 1000; i++) {
      const [v, ns] = nextRng(s);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      s = ns;
    }
  });

  it('rngInt returns integers in [0, max)', () => {
    let s = 99;
    for (let i = 0; i < 200; i++) {
      const [v, ns] = rngInt(s, 6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      s = ns;
    }
  });

  it('shuffle preserves elements and is deterministic', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const [shuffled1] = shuffle(7, arr);
    const [shuffled2] = shuffle(7, arr);
    expect(shuffled1).toEqual(shuffled2);
    expect(shuffled1.slice().sort((a, b) => a - b)).toEqual(arr);
  });

  it('shuffle does not mutate the input', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = arr.slice();
    shuffle(123, arr);
    expect(arr).toEqual(copy);
  });

  it('rollDice returns two values in [1, 6]', () => {
    let s = 1;
    for (let i = 0; i < 100; i++) {
      const [[d1, d2], ns] = rollDice(s);
      expect(d1).toBeGreaterThanOrEqual(1);
      expect(d1).toBeLessThanOrEqual(6);
      expect(d2).toBeGreaterThanOrEqual(1);
      expect(d2).toBeLessThanOrEqual(6);
      s = ns;
    }
  });
});
