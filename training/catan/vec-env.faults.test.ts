import { describe, it, expect, vi } from 'vitest';
import { nextRng } from '@/game/rng';
import type { Action, GameState, PlayerId } from '@/game/types';

// Every 7th heuristic move is one the engine must reject.
vi.mock('@/ai/index', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/ai/index')>();
  let calls = 0;
  return {
    ...real,
    chooseAction: (s: GameState, id: PlayerId): Action | null => {
      calls++;
      if (calls % 7 === 0) return { type: 'buildCity', playerId: id, vertex: 'nowhere' };
      return real.chooseAction(s, id);
    },
  };
});

const { CatanVecEnv } = await import('./vec-env');

function randomLegal(mask: Uint8Array, slots: number, i: number, u: number): number {
  const legal: number[] = [];
  for (let k = 0; k < slots; k++) if (mask[i * slots + k]) legal.push(k);
  return legal[Math.floor(u * legal.length)] ?? 0;
}

describe('CatanVecEnv fault tolerance', () => {
  it('replaces a rejected heuristic move with a random legal one and plays on', () => {
    const env = new CatanVecEnv({ numEnvs: 4, seed: 5, seats: ['learner', 'heuristic', 'heuristic', 'heuristic'] });
    const slots = env.shape.slots;
    let rng = 3;
    let batch = env.reset();
    const done = [];
    while (done.length < 4) {
      const actions = Array.from({ length: 4 }, (_, i) => {
        const [u, next] = nextRng(rng);
        rng = next;
        return randomLegal(batch.mask, slots, i, u);
      });
      batch = env.step(actions);
      done.push(...batch.episodes);
    }
    expect(done.every((e) => !e.aborted)).toBe(true);
    expect(done.reduce((n, e) => n + e.fallbacks, 0)).toBeGreaterThan(0);
  }, 120_000);

  it('abandons only the match that hit an error, then carries on', () => {
    const env = new CatanVecEnv({ numEnvs: 3, seed: 6, seats: ['learner', 'learner', 'learner', 'learner'] });
    const slots = env.shape.slots;
    let batch = env.reset();
    const illegal = Array.from({ length: slots }, (_, k) => k).find((k) => !batch.mask[k])!;
    batch = env.step([illegal, randomLegal(batch.mask, slots, 1, 0.5), randomLegal(batch.mask, slots, 2, 0.5)]);
    expect(batch.episodes).toHaveLength(1);
    expect(batch.episodes[0]).toMatchObject({ env: 0, aborted: true, reward: [0, 0, 0, 0] });
    expect(batch.done[0]).toBe(1);
    expect(batch.done[1]).toBe(0);
    // The fresh match in env 0 is playable.
    expect(batch.mask.subarray(0, slots).some((x) => x === 1)).toBe(true);
    expect(() => env.step([0, 1, 2].map((i) => randomLegal(batch.mask, slots, i, 0.3)))).not.toThrow();
  }, 120_000);
});
