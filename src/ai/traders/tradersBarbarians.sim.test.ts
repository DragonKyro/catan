import { describe, expect, it } from 'vitest';
import type { GameState } from '@/game/types';
import { simulate } from './simSupport';

// All-heuristic "Traders & Barbarians" scenario games at 3 and 4 players:
// every game must finish, and the scenario's mechanics must get used.

interface Stats {
  steps: number;
  turns: number;
  deliveries: number;
  pickups: number;
  upgrades: number;
  driveOffTries: number;
  driveOffWins: number;
  knights: number;
  sevens: number;
  steals: number;
  boosts: number;
  swiftJourneys: number;
  swiftJourneysDrawn: number;
  tolls: number;
  rerolls: number;
  pathRoads: number;
}

function play(seed: number, players: number): { final: GameState; stats: Stats } {
  const stats: Stats = {
    steps: 0,
    turns: 0,
    deliveries: 0,
    pickups: 0,
    upgrades: 0,
    driveOffTries: 0,
    driveOffWins: 0,
    knights: 0,
    sevens: 0,
    steals: 0,
    boosts: 0,
    swiftJourneys: 0,
    swiftJourneysDrawn: 0,
    tolls: 0,
    rerolls: 0,
    pathRoads: 0,
  };
  let lastSeq = 0;
  const r = simulate(seed, players, { expansions: ['traders'], tradersScenarioId: 'tradersAndBarbarians' }, 9000, (before, action, after) => {
    if (action.type === 'endTurn' && after.currentPlayerIndex !== before.currentPlayerIndex) stats.turns++;
    if (action.type === 'buyDevCard') {
      const b = before.tradersBarbarians!.deck;
      if (b[b.length - 1] === 'swiftJourney') stats.swiftJourneysDrawn++;
    }
    if (action.type === 'buildRoad') {
      const paths = new Set(after.tradersBarbarians!.locations.flatMap((l) => l.paths));
      if (paths.has(action.edge)) stats.pathRoads++;
    }
    const last = after.tradersBarbarians?.lastEvents;
    if (!last || last.seq === lastSeq) return;
    lastSeq = last.seq;
    for (const ev of last.events) {
      if (ev.kind === 'deliver') stats.deliveries++;
      if (ev.kind === 'pickUp') stats.pickups++;
      if (ev.kind === 'upgrade') stats.upgrades++;
      if (ev.kind === 'driveOff') {
        stats.driveOffTries++;
        if (ev.success) stats.driveOffWins++;
      }
      if (ev.kind === 'barbarianMoved') {
        if (ev.reason === 'knight') stats.knights++;
        if (ev.reason === 'seven') stats.sevens++;
        if (ev.stole) stats.steals++;
      }
      if (ev.kind === 'boost') stats.boosts++;
      if (ev.kind === 'swiftJourney') stats.swiftJourneys++;
      if (ev.kind === 'toll') stats.tolls++;
      if (ev.kind === 'reroll') stats.rerolls++;
    }
  });
  stats.steps = r.steps;
  return { final: r.final, stats };
}

describe('Traders & Barbarians scenario, all-AI', () => {
  const totals: Stats[] = [];
  for (const players of [3, 4]) {
    for (const seed of [1, 2, 3, 4]) {
      it(`${players}p seed ${seed} finishes with the scenario in use`, () => {
        const { final, stats } = play(seed, players);
        totals.push(stats);
        // eslint-disable-next-line no-console
        console.log(`TBS ${players}p seed ${seed}: winner ${final.winner}`, JSON.stringify(stats));
        expect(final.phase).toBe('gameOver');
        expect(final.winner).toBeTruthy();
        expect(stats.deliveries).toBeGreaterThan(0);
        expect(stats.pickups).toBeGreaterThan(0);
      });
    }
  }
  it('used every mechanic across the runs', () => {
    const sum = (k: keyof Stats) => totals.reduce((s, t) => s + t[k], 0);
    expect(totals).toHaveLength(8);
    expect(sum('upgrades')).toBeGreaterThan(0);
    expect(sum('driveOffTries')).toBeGreaterThan(0);
    expect(sum('driveOffWins')).toBeGreaterThan(0);
    expect(sum('knights')).toBeGreaterThan(0);
    expect(sum('sevens')).toBeGreaterThan(0);
    expect(sum('steals')).toBeGreaterThan(0);
    expect(sum('boosts')).toBeGreaterThan(0);
    expect(sum('rerolls')).toBeGreaterThan(0);
    if (sum('swiftJourneysDrawn') > 0) expect(sum('swiftJourneys')).toBeGreaterThan(0);
  });
});
