// Pure functional seeded PRNG (mulberry32).
// All randomness flows through these helpers; engine actions that consume
// randomness thread a new rng state through GameState.

export function nextRng(state: number): [number, number] {
  const s = (state + 0x6d2b79f5) >>> 0;
  let t = s;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return [((t ^ (t >>> 14)) >>> 0) / 4294967296, s];
}

export function rngInt(state: number, maxExclusive: number): [number, number] {
  const [v, s] = nextRng(state);
  return [Math.floor(v * maxExclusive), s];
}

export function shuffle<T>(state: number, arr: readonly T[]): [T[], number] {
  const result = arr.slice();
  let s = state;
  for (let i = result.length - 1; i > 0; i--) {
    const [v, newS] = nextRng(s);
    s = newS;
    const j = Math.floor(v * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
  }
  return [result, s];
}

export function rollDie(state: number): [number, number] {
  const [v, s] = nextRng(state);
  return [Math.floor(v * 6) + 1, s];
}

export function rollDice(state: number): [[number, number], number] {
  const [d1, s1] = rollDie(state);
  const [d2, s2] = rollDie(s1);
  return [[d1, d2], s2];
}

export function pickOne<T>(state: number, arr: readonly T[]): [T, number] {
  if (arr.length === 0) throw new Error('pickOne: empty array');
  const [idx, s] = rngInt(state, arr.length);
  return [arr[idx]!, s];
}
