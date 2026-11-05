import { describe, expect, it } from 'vitest';
import { simulate } from './traders/simSupport';
import { supportsNeuralAi } from './nn/observation';

// The rulebooks' beginner boards (base 3-4, 5-6 with paired turns and, at 5,
// an inactive color): all-heuristic-AI games from the pre-placed start to a
// winner at the normal 10 VP, without a rejected action.
describe('beginner board, all-AI', () => {
  for (const players of [3, 4, 5, 6]) {
    it(`${players} players finish`, () => {
      const r = simulate(11 + players, players, { baseScenarioId: 'beginner', expansions: [] }, 15000);
      expect(r.actions[0]!.type).toBe('rollDice');
      expect(r.actions.some((a) => a.type === 'placeInitialSettlement')).toBe(false);
      expect(r.final.phase).toBe('gameOver');
      expect(r.final.winner).toBeTruthy();
      if (players === 5) expect(r.final.inactiveSettlements).toHaveLength(2);
    }, 120_000);
  }

  it('keeps the heuristic: the trained networks need empty starting hands', () => {
    // KnowledgeSession / initialKnowledge refuse a game whose hands aren't
    // empty at creation, and the networks only know the random board.
    expect(supportsNeuralAi({ expansions: [], baseScenarioId: 'beginner' })).toBe(false);
  });
});
