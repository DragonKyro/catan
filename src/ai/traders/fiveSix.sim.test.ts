import { describe, expect, it } from 'vitest';
import type { Action, GameState } from '@/game/types';
import { isPairedPlayer2 } from '@/game/helpers';
import { lakeHexes } from '@/game/modules/traders/fishing/lakes';
import { simulate } from './simSupport';

// Traders & Barbarians 5-6 (Phase 11): all-heuristic-AI games of every
// scenario at 5 and 6 players, played to the end with seeded dice. Every
// action must be legal (applyAction throws otherwise), every game must
// finish, and across the seeds the scenario mechanics — including Player 2's
// own Action and End of Turn phases — must actually get used.

interface Counted {
  final: GameState;
  steps: number;
  counts: Record<string, number>;
}

function play(scenario: string, players: number, seed: number): Counted {
  const counts: Record<string, number> = {};
  const bump = (k: string) => (counts[k] = (counts[k] ?? 0) + 1);
  const r = simulate(seed, players, { expansions: ['traders'], tradersScenarioId: scenario }, 12000, (
    before: GameState,
    action: Action,
    after: GameState,
  ) => {
    bump(action.type);
    const p2 = isPairedPlayer2(before) && action.playerId === before.playerOrder[before.currentPlayerIndex];
    if (p2) bump(`p2:${action.type}`);
    if (after.phase === 'wagonVoting' && before.phase !== 'wagonVoting' && isPairedPlayer2(after)) {
      bump('p2:votingRound');
    }
    if (after.phase === 'barbarianKnightMoves' && before.phase !== 'barbarianKnightMoves' && isPairedPlayer2(after)) {
      bump('p2:knightStep');
    }
    const ev = after.barbarianAttack?.lastEvents;
    if (ev && ev.seq !== before.barbarianAttack?.lastEvents?.seq) {
      for (const e of ev.events) {
        if (e.kind === 'landing' && e.rolls.length > new Set(e.rolls.map((x) => x.dice.join())).size) {
          bump('ba:doubleLanding');
        }
        if (e.kind === 'expel' && isPairedPlayer2(before)) bump('p2:expel');
      }
    }
    // Fish from the 5-6 lake (printed 4 / 10).
    if (action.type === 'rollDice' && after.fishTokenPool) {
      const n = action.dice![0] + action.dice![1];
      const lake = lakeHexes(after).find((h) => after.board.hexes[h]!.extraNumbers?.includes(10));
      if (lake && (n === 4 || n === 10)) {
        const corners = new Set(after.board.hexes[lake]!.corners);
        if (after.players.some((p) => [...p.settlements, ...p.cities].some((v) => corners.has(v)))) {
          bump('fish:lake4_10');
        }
      }
    }
  });
  return { final: r.final, steps: r.steps, counts };
}

const total = (rs: Counted[], key: string) => rs.reduce((n, r) => n + (r.counts[key] ?? 0), 0);
const SEEDS = [1, 2, 3];

function games(scenario: string): Counted[] {
  return [5, 6].flatMap((n) => SEEDS.map((seed) => play(scenario, n, seed)));
}

function expectFinished(rs: Counted[]) {
  for (const r of rs) {
    expect(r.final.phase, `stuck after ${r.steps} steps`).toBe('gameOver');
    expect(r.final.winner).toBeTruthy();
  }
}

describe('All-AI T&B 5-6', () => {
  it('Rivers of Catan: games finish; bridges and coins get used, by Player 2 too', () => {
    const rs = games('riversOfCatan');
    expectFinished(rs);
    expect(total(rs, 'buildBridge')).toBeGreaterThan(5);
    expect(total(rs, 'spendGold')).toBeGreaterThan(5);
    expect(total(rs, 'p2:spendGold')).toBeGreaterThan(5);
    expect(total(rs, 'p2:buyGold')).toBeGreaterThan(0);
    expect(total(rs, 'p2:buildBridge')).toBeGreaterThan(0);
    expect(total(rs, 'p2:proposeTrade')).toBe(0);
  });

  it('Fishing on Catan: games finish; both lakes fish, fish get spent, by Player 2 too', () => {
    const rs = games('fishingOnCatan');
    expectFinished(rs);
    for (const r of rs) expect(lakeHexes(r.final)).toHaveLength(2);
    expect(total(rs, 'spendFish')).toBeGreaterThan(5);
    expect(total(rs, 'p2:spendFish')).toBeGreaterThan(5);
    expect(total(rs, 'p2:passOldBoot')).toBeGreaterThan(0);
    expect(total(rs, 'fish:lake4_10')).toBeGreaterThan(5);
  }, 120000);

  it('Merchant Trains: games finish; wagons placed, Player 2 holds voting rounds', () => {
    const rs = games('merchantTrains');
    expectFinished(rs);
    expect(total(rs, 'placeWagon') + total(rs, 'submitWagonVote')).toBeGreaterThan(10);
    expect(total(rs, 'p2:votingRound')).toBeGreaterThan(5);
    // Trains leave from both watering holes.
    const used = new Set<string>();
    for (const r of rs) {
      for (const t of r.final.merchantTrains ?? []) {
        const hole = r.final.wateringHoleHexIds!.find((h) => r.final.board.hexes[h]!.corners.includes(t.start));
        if (hole) used.add(hole);
      }
    }
    expect([...used].sort()).toEqual(['-1,-1', '0,1']);
  }, 120000);

  it('Barbarian Attack: games finish; Player 2 moves knights and expels; 5s / 9s land twice', () => {
    const rs = games('barbarianAttack');
    expectFinished(rs);
    expect(total(rs, 'moveBarbarianKnight')).toBeGreaterThan(10);
    expect(total(rs, 'p2:moveBarbarianKnight')).toBeGreaterThan(5);
    expect(total(rs, 'p2:knightStep')).toBeGreaterThan(5);
    expect(total(rs, 'p2:expel')).toBeGreaterThan(3);
    expect(total(rs, 'ba:doubleLanding')).toBeGreaterThan(5);
  }, 120000);
});
