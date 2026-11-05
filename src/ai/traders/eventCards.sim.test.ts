import { describe, it, expect } from 'vitest';
import type { EventCardKind } from '@/game/types';
import { simulate } from './simSupport';

// All-AI games with the Catan Event Cards variant: they must finish, every
// flip must resolve (choices answered, production run), and New Year must
// rebuild the deck along the way.
describe('Catan Event Cards all-AI games', () => {
  const runs: Array<{ players: number; seed: number; settings: Parameters<typeof simulate>[2]; label: string }> = [
    { players: 3, seed: 1, label: 'base', settings: { tradersVariants: { eventCards: true } } },
    { players: 3, seed: 2, label: 'base', settings: { tradersVariants: { eventCards: true } } },
    { players: 4, seed: 3, label: 'base', settings: { tradersVariants: { eventCards: true } } },
    { players: 4, seed: 4, label: 'base + Friendly Robber + Strongest Ports', settings: { tradersVariants: { eventCards: true, friendlyRobber: true, strongestPorts: true } } },
    { players: 3, seed: 5, label: 'Seafarers', settings: { expansions: ['seafarers'], scenarioId: 'headingForNewShores', tradersVariants: { eventCards: true } } },
    { players: 4, seed: 6, label: 'Merchant Trains', settings: { expansions: ['traders'], tradersScenarioId: 'merchantTrains', tradersVariants: { eventCards: true, friendlyRobber: true } } },
  ];
  const seen = new Set<EventCardKind>();
  let newYears = 0;
  for (const run of runs) {
    it(`${run.label}, ${run.players}p seed ${run.seed} finishes`, () => {
      const { final, actions } = simulate(run.seed, run.players, run.settings);
      expect(final.phase).toBe('gameOver');
      expect(final.winner).not.toBeNull();
      expect(final.eventCards?.pending).toBeUndefined();
      // Replay the flips to see which events came up.
      const flips = actions.filter((a) => a.type === 'rollDice').length;
      expect(flips).toBeGreaterThan(10);
      expect(actions.some((a) => a.type === 'resolveEvent')).toBe(true);
    }, 120_000);
  }

  it('every event comes up over long base games, and New Year rebuilds the deck', () => {
    for (const seed of [9, 10, 11]) {
      const { final } = simulate(seed, 4, { tradersVariants: { eventCards: true } }, 8000, (_b, a, after) => {
        if (a.type !== 'rollDice') return;
        const card = after.eventCards?.current;
        if (card) seen.add(card.kind);
        if (after.eventCards?.newYear) newYears++;
      });
      expect(final.phase).toBe('gameOver');
    }
    expect(newYears).toBeGreaterThan(0);
    for (const k of ['beautifulDay', 'calmSeas', 'conflict', 'earthquake', 'epidemic', 'goodNeighbors',
      'helpfulNeighbor', 'plentifulYear', 'robberAttacks', 'robberFlees', 'tournament', 'tradeAdvantage'] as const) {
      expect(seen.has(k)).toBe(true);
    }
  }, 180_000);
});
