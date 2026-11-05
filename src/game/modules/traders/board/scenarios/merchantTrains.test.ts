import { describe, it, expect } from 'vitest';
import { createGame } from '../../../../createGame';
import { TB_FRAME_PORTS_3_4 } from '../frame';

function newMerchantGame() {
  return createGame({
    playerNames: ['A', 'B', 'C'],
    seed: 1,
    settings: {
      expansions: ['traders'],
      tradersScenarioId: 'merchantTrains',
    },
    randomizeTurnOrder: false,
  });
}

describe('Merchant Trains scenario', () => {
  it('places a single watering hole at the centre', () => {
    const s = newMerchantGame();
    const wh = Object.values(s.board.hexes).filter(
      (h) => h.terrain === 'wateringHole',
    );
    expect(wh.length).toBe(1);
    expect(wh[0]!.coord).toEqual({ q: 0, r: 0 });
  });

  it('records the watering hole hex id on state', () => {
    const s = newMerchantGame();
    expect(s.wateringHoleHexId).toBeDefined();
    expect(s.board.hexes[s.wateringHoleHexId!]?.terrain).toBe('wateringHole');
  });

  it('watering hole has no number token', () => {
    const s = newMerchantGame();
    const hex = s.board.hexes[s.wateringHoleHexId!]!;
    expect(hex.numberToken).toBeNull();
  });

  it('starts with 22 wagons in supply, none placed', () => {
    const s = newMerchantGame();
    expect(s.wagonSupply).toBe(22);
    expect(s.wagons).toEqual([]);
  });

  it('robber starts off-board', () => {
    const s = newMerchantGame();
    expect(s.robberActive).toBe(false);
  });

  it('sets the victory-point target to 12', () => {
    const s = newMerchantGame();
    expect(s.settings.victoryPointsToWin).toBe(12);
  });

  it('all other hexes are producing terrain (no desert)', () => {
    const s = newMerchantGame();
    const deserts = Object.values(s.board.hexes).filter(
      (h) => h.terrain === 'desert',
    );
    expect(deserts.length).toBe(0);
  });

  it('uses the T&B frame harbors with their printed types', () => {
    for (const seed of [1, 2, 3]) {
      const s = createGame({
        playerNames: ['A', 'B', 'C', 'D'],
        seed,
        settings: { expansions: ['traders'], tradersScenarioId: 'merchantTrains' },
      });
      expect(s.board.ports).toHaveLength(9);
      // Each harbor sits on an edge of its frame anchor's land hex, with that type.
      for (const a of TB_FRAME_PORTS_3_4) {
        const hexId = `${a.q},${a.r}`;
        const port = s.board.ports.find((p) => s.board.edges[p.edge]!.hexes.includes(hexId) && p.type === a.fixedType);
        expect(port, `${hexId} ${a.fixedType}`).toBeDefined();
      }
    }
  });

  it('rejects 7+ player merchant trains games', () => {
    expect(() =>
      createGame({
        playerNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        seed: 1,
        settings: {
          expansions: ['traders'],
          tradersScenarioId: 'merchantTrains',
        },
        randomizeTurnOrder: false,
      }),
    ).toThrow(/at most 6 players/);
  });
});
