import { describe, it, expect } from 'vitest';
import { simulate } from './simSupport';

// All-AI Merchant Trains games: they must finish, and the scenario's
// mechanics must actually be used (wagons placed, real bids cast).
describe('Merchant Trains all-AI games', () => {
  const runs: Array<[number, number]> = [
    [3, 1],
    [3, 2],
    [3, 3],
    [4, 4],
    [4, 5],
    [4, 6],
  ];
  let totalBids = 0;
  let totalAssigns = 0;
  for (const [players, seed] of runs) {
    it(`${players}p seed ${seed} finishes with trains on the board`, () => {
      const { final, actions } = simulate(seed, players, {
        expansions: ['traders'],
        tradersScenarioId: 'merchantTrains',
      });
      expect(final.phase).toBe('gameOver');
      expect(final.winner).not.toBeNull();
      expect(final.wagons!.length).toBeGreaterThan(3);
      expect(final.merchantTrains!.length).toBeGreaterThan(0);
      const bids = actions.filter(
        (a) =>
          a.type === 'submitWagonVote' &&
          (a.cards.sheep ?? 0) + (a.cards.wheat ?? 0) > 0,
      );
      totalBids += bids.length;
      totalAssigns += actions.filter((a) => a.type === 'assignWagonVotes').length;
      // Every wagon sits on its own edge, faces an end of it, and the
      // supply accounts for every wagon.
      const edges = new Set(final.wagons!.map((w) => w.edge));
      expect(edges.size).toBe(final.wagons!.length);
      for (const w of final.wagons!) {
        expect(final.board.edges[w.edge]!.vertices).toContain(w.front);
      }
      expect(final.wagonSupply! + final.wagons!.length).toBe(22);
    }, 60_000);
  }
  it('the AIs cast real bids across the runs', () => {
    expect(totalBids).toBeGreaterThan(3);
    void totalAssigns;
  });
});
