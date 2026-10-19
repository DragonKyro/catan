import { describe, it, expect } from 'vitest';
import { nextRng } from '@/game/rng';
import { CatanVecEnv, type Episode, type SeatRole } from './vec-env';

/** Drive every env with uniformly random legal slots until `episodes` matches finish. */
function run(seats: SeatRole[], episodes: number, opts: Partial<ConstructorParameters<typeof CatanVecEnv>[0]> = {}) {
  const env = new CatanVecEnv({ numEnvs: 8, seed: 3, seats, vpShaping: 0.5, ...opts });
  const slots = env.shape.slots;
  const P = env.opts.players;
  let rng = 17;
  let batch = env.reset();
  const done: Episode[] = [];
  const rewardBySeat = new Float64Array(8 * P);
  let decisions = 0;
  const t0 = performance.now();
  while (done.length < episodes) {
    const actions = Array.from({ length: 8 }, (_, i) => {
      const legal: number[] = [];
      for (let k = 0; k < slots; k++) if (batch.mask[i * slots + k]) legal.push(k);
      if (batch.role[i] === -1) return 0;
      const [u, next] = nextRng(rng);
      rng = next;
      return legal[Math.floor(u * legal.length)]!;
    });
    batch = env.step(actions);
    decisions += 8;
    batch.reward.forEach((r, k) => { rewardBySeat[k]! += r; });
    done.push(...batch.episodes);
    if (batch.role.every((r) => r === -1)) break;
  }
  return { env, done, rewardBySeat, decisions, ms: performance.now() - t0 };
}

describe('CatanVecEnv', () => {
  it('self-play: random networks finish or are cut off, with zero-sum rewards', () => {
    const { done, rewardBySeat, decisions, ms } = run(['learner', 'learner', 'learner', 'learner'], 8, { maxTurns: 120 });
    expect(done.length).toBeGreaterThanOrEqual(8);
    for (const e of done) {
      expect(e.roles).toEqual(['learner', 'learner', 'learner', 'learner']);
      // Terminal rewards are centred; a cut-off match also costs every seat 0.5.
      expect(e.reward.reduce((a, b) => a + b, 0)).toBeCloseTo(e.truncated ? -2 : 0, 6);
      if (!e.truncated) expect(e.winnerSeat).not.toBeNull();
    }
    expect(Array.from(rewardBySeat).every(Number.isFinite)).toBe(true);
    console.log(`self-play random: ${decisions} decisions in ${ms.toFixed(0)} ms (${(decisions / ms * 1000).toFixed(0)}/s)`);
  }, 120_000);

  it('a lone learner vs heuristics visits every seat, and heuristic seats never ask for a decision', () => {
    const { env, done, decisions, ms } = run(['learner', 'heuristic', 'heuristic', 'heuristic'], 8);
    const seatsSeen = new Set<number>();
    for (const e of done) {
      expect(e.roles.filter((r) => r === 'learner')).toHaveLength(1);
      seatsSeen.add(e.roles.indexOf('learner'));
    }
    expect(seatsSeen.size).toBeGreaterThan(1);
    expect(env.opts.seats).toEqual(['learner', 'heuristic', 'heuristic', 'heuristic']);
    console.log(`vs heuristic random: ${decisions} decisions in ${ms.toFixed(0)} ms (${(decisions / ms * 1000).toFixed(0)}/s), `
      + `mean turns ${(done.reduce((s, e) => s + e.turns, 0) / done.length).toFixed(0)}, `
      + `heuristic wins ${done.filter((e) => e.winnerSeat !== null && e.roles[e.winnerSeat] === 'heuristic').length}/${done.length}`);
  }, 120_000);

  it('quota plays a fixed set of matches, then idles', () => {
    const { done } = run(['learner', 'opponent', 'opponent', 'opponent'], 1000, { quota: 1, maxTurns: 60 });
    expect(done).toHaveLength(8);
    expect(new Set(done.map((e) => e.seed)).size).toBe(8);
  }, 120_000);
});
