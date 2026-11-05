import { describe, expect, it } from 'vitest';
import { simulate } from './simSupport';
import { getTradersScenario } from '@/game/modules/traders/board/scenarios';

// Every Traders & Barbarians scenario with every variant setting (the
// variants are built to stack on any game), all-heuristic-AI at 3 to 6
// players (5-6 = the T&B 5-6 boards with paired turns): each game must
// reach gameOver without a rejected action. Each scenario runs at the
// player counts it supports (the Traders & Barbarians scenario is 3-4 only).
// Scenario agents tested their own rules; this catches the interplay.
const SCENARIOS = ['riversOfCatan', 'fishingOnCatan', 'merchantTrains', 'barbarianAttack', 'tradersAndBarbarians'];
const VARIANTS: Record<string, { friendlyRobber?: boolean; strongestPorts?: boolean; eventCards?: boolean }> = {
  none: {},
  friendlyRobber: { friendlyRobber: true },
  strongestPorts: { strongestPorts: true },
  eventCards: { eventCards: true },
  all: { friendlyRobber: true, strongestPorts: true, eventCards: true },
};

describe('T&B scenarios × variants, all-AI', () => {
  for (const scenario of SCENARIOS) {
    for (const [name, tradersVariants] of Object.entries(VARIANTS)) {
      const { minPlayers, maxPlayers } = getTradersScenario(scenario);
      for (const players of [3, 4, 5, 6].filter((n) => n >= minPlayers && n <= maxPlayers)) {
        it(`${scenario} + ${name} at ${players}p finishes`, () => {
          const r = simulate(11 + players, players, {
            expansions: ['traders'],
            tradersScenarioId: scenario,
            tradersVariants,
          }, players >= 5 ? 12000 : 9000);
          expect(r.final.phase).toBe('gameOver');
          expect(r.final.winner).toBeTruthy();
        });
      }
    }
  }
});
