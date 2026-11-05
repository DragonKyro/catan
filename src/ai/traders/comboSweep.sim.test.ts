import { describe, expect, it } from 'vitest';
import { simulate } from './simSupport';

// Every Traders & Barbarians scenario with every variant setting (the
// variants are built to stack on any game), all-heuristic-AI at 3 and 4
// players: each game must reach gameOver without a rejected action.
// Scenario agents tested their own rules; this catches the interplay.
const SCENARIOS = ['riversOfCatan', 'fishingOnCatan', 'merchantTrains', 'barbarianAttack'];
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
      for (const players of [3, 4]) {
        it(`${scenario} + ${name} at ${players}p finishes`, () => {
          const r = simulate(11 + players, players, {
            expansions: ['traders'],
            tradersScenarioId: scenario,
            tradersVariants,
          }, 9000);
          expect(r.final.phase).toBe('gameOver');
          expect(r.final.winner).toBeTruthy();
        });
      }
    }
  }
});
