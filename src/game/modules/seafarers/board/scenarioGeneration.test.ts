import { describe, expect, it } from 'vitest';
import { createGame } from '../../../createGame';
import { SCENARIOS } from './scenarios';

// Every Seafarers scenario must generate at every supported player count,
// and its mechanic markers must resolve onto the board.
function game(scenarioId: string, n: number, seed = 7) {
  return createGame({
    playerNames: Array.from({ length: n }, (_, i) => `P${i}`),
    seed,
    settings: { expansions: ['seafarers'], scenarioId },
    randomizeTurnOrder: false,
  });
}

describe('Seafarers scenario generation', () => {
  for (const sc of Object.values(SCENARIOS)) {
    for (let n = sc.minPlayers; n <= sc.maxPlayers; n++) {
      it(`${sc.id} at ${n}p`, () => {
        const g = game(sc.id, n);
        expect(g.board.hexIds.length).toBeGreaterThan(0);
        expect(g.settings.victoryPointsToWin).toBe(
          n >= 5 && sc.defaultVpToWin5_6 != null ? sc.defaultVpToWin5_6 : sc.defaultVpToWin,
        );
      });
    }
  }

  it('Pirate Islands seats one fortress, beachhead, settlement and ship per player', () => {
    for (const n of [3, 4, 5, 6]) {
      const g = game('pirateIslands', n);
      expect(g.pirateIslands!.fortresses).toHaveLength(n);
      for (const p of g.players) {
        expect(p.settlements).toHaveLength(1);
        expect(p.ships).toHaveLength(1);
      }
      expect(g.robberActive).toBe(false);
      expect(g.noLongestRoad && g.noLargestArmy).toBe(true);
      expect(g.board.pirateHex).toBe(g.pirateIslands!.path[g.pirateIslands!.fleetIndex]);
      expect(g.devCardDeck.includes('victoryPoint')).toBe(false);
    }
  });

  it('Forgotten Tribe puts its tokens on edges and starts with no ports', () => {
    const g = game('forgottenTribe', 4);
    const t = g.tribeTokens!;
    expect(t.filter((x) => x.type === 'victoryPoint')).toHaveLength(8);
    expect(t.filter((x) => x.type === 'devCard' && x.devCard)).toHaveLength(4);
    expect(t.filter((x) => x.type === 'port')).toHaveLength(6);
    expect(g.board.ports).toHaveLength(0);
    expect(g.devCardDeck).toHaveLength(25 - 4);
    const g6 = game('forgottenTribe', 6);
    expect(g6.tribeTokens!.filter((x) => x.type === 'victoryPoint')).toHaveLength(10);
  });

  it('Cloth for Catan has 8 / 12 villages with 5 cloth each and three setup rounds', () => {
    const g = game('clothForCatan', 4);
    expect(g.clothVillages).toHaveLength(8);
    expect(g.clothVillages!.every((v) => v.supply === 5)).toBe(true);
    expect(g.clothSupply).toBe(10);
    expect(g.settings.setupRounds).toBe(3);
    expect(g.startingIslands).toHaveLength(2);
    expect(game('clothForCatan', 6).clothVillages).toHaveLength(12);
  });

  it('Wonders of Catan has its markers, no pirate, and 5 / 7 wonders', () => {
    const g = game('wondersOfCatan', 4);
    expect(g.wonderSites!.greatWall).toHaveLength(5);
    expect(g.wonderSites!.greatBridge).toHaveLength(2);
    expect(g.setupBlockedVertices).toHaveLength(11);
    expect(g.board.pirateHex).toBeUndefined();
    expect(g.wonders).toHaveLength(5);
    expect(g.islandChips!.every((c) => c.vp === 1)).toBe(true);
    expect(game('wondersOfCatan', 5).wonders).toHaveLength(7);
  });
});
