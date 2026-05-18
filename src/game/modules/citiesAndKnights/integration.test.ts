import { describe, it, expect } from 'vitest';
import { createGame } from '../../createGame';
import { applyAction } from '../../engine';
import { runSetupPhase, giveResources } from '../../__testHelpers';
import { CITIES_AND_KNIGHTS_EXPANSION_ID, BARBARIAN_TRACK_LENGTH } from './constants';
import { advanceBarbarianShip, resolveBarbarianAttack } from './barbarian';

function setupCK(numPlayers = 3) {
  const names = Array.from({ length: numPlayers }, (_, i) => `P${i}`);
  return runSetupPhase(
    createGame({
      playerNames: names,
      seed: 42,
      randomizeTurnOrder: false,
      settings: { expansions: [CITIES_AND_KNIGHTS_EXPANSION_ID] },
    }),
  );
}

describe('Cities & Knights — createGame', () => {
  it('refuses simultaneous Seafarers + C&K', () => {
    expect(() =>
      createGame({
        playerNames: ['A', 'B', 'C'],
        seed: 1,
        settings: { expansions: ['seafarers', CITIES_AND_KNIGHTS_EXPANSION_ID] },
      }),
    ).toThrow(/cannot be combined/i);
  });

  it('defaults VP target to 13 under C&K', () => {
    const s = setupCK();
    expect(s.settings.victoryPointsToWin).toBe(13);
  });

  it('seeds commodity bank + barbarian state + inactive robber', () => {
    const s = setupCK();
    expect(s.commodityBank).toEqual({ paper: 12, cloth: 12, coin: 12 });
    expect(s.barbarian).toEqual({ position: 0, attacksResolved: 0 });
    expect(s.robberActive).toBe(false);
    for (const p of s.players) {
      expect(p.commodities).toEqual({ paper: 0, cloth: 0, coin: 0 });
      expect(p.cityWalls).toBe(0);
    }
  });

  it('leaves the dev card deck empty (replaced by progress cards)', () => {
    const s = setupCK();
    expect(s.devCardDeck).toEqual([]);
  });
});

describe('Cities & Knights — dev cards refused', () => {
  it('buyDevCard throws under C&K', () => {
    const s = setupCK();
    // Resources arbitrary — handler refuses before checking cost.
    const ready = giveResources(s, 'p0', { sheep: 1, wheat: 1, ore: 1 });
    expect(() =>
      applyAction(ready, { type: 'buyDevCard', playerId: 'p0' }),
    ).toThrow(/progress cards/i);
  });
});

describe('Cities & Knights — barbarian helpers', () => {
  it('advances the ship and reports when it reaches the end', () => {
    let s = setupCK();
    for (let i = 0; i < BARBARIAN_TRACK_LENGTH - 1; i++) {
      const r = advanceBarbarianShip(s);
      s = r.state;
      expect(r.attacked).toBe(false);
    }
    const last = advanceBarbarianShip(s);
    expect(last.attacked).toBe(true);
    expect(last.state.barbarian?.position).toBe(BARBARIAN_TRACK_LENGTH);
  });

  it('first attack activates the robber and pillages every cited player', () => {
    let s = setupCK();
    // Upgrade everyone's starting settlement to a city, give them brick to
    // see the wall path too.
    s = {
      ...s,
      players: s.players.map((p) => ({
        ...p,
        cities: [...p.settlements],
        settlements: [],
      })),
    };
    // Bring barbarian to attack point.
    s = { ...s, barbarian: { position: BARBARIAN_TRACK_LENGTH, attacksResolved: 0 } };
    const after = resolveBarbarianAttack(s);
    expect(after.robberActive).toBe(true);
    // Every player who had a city loses one.
    for (let i = 0; i < s.players.length; i++) {
      expect(after.players[i]!.cities.length).toBeLessThan(
        s.players[i]!.cities.length,
      );
    }
    expect(after.barbarian?.position).toBe(0);
    expect(after.barbarian?.attacksResolved).toBe(1);
  });
});

// Roll to main, deterministically, by trying non-7 dice combinations. The
// helper assumes p0 is the current player (set via randomizeTurnOrder: false).
function rollToMain(s: ReturnType<typeof setupCK>): ReturnType<typeof setupCK> {
  for (const total of [3, 4, 5, 6, 8, 9, 10, 11, 12, 2]) {
    const d1 = Math.max(1, total - 6);
    const d2 = total - d1;
    try {
      const next = applyAction(s, {
        type: 'rollDice',
        playerId: 'p0',
        dice: [d1, d2] as [number, number],
      });
      if (next.phase === 'main') return next;
    } catch {
      // ignore — try next total
    }
  }
  throw new Error('Could not roll to main');
}

describe('Cities & Knights — city walls', () => {
  it('builds for 2 brick and bumps discard threshold', () => {
    let s = setupCK();
    // Pretend the first player's starting settlement is a city.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, cities: [...p.settlements], settlements: [] }
          : p,
      ),
    };
    s = rollToMain(s);
    const cityVid = s.players[0]!.cities[0]!;
    s = giveResources(s, 'p0', { brick: 2 });
    const brickBefore = s.bank.brick;
    const playerBrickBefore = s.players[0]!.resources.brick;
    s = applyAction(s, { type: 'buildCityWall', playerId: 'p0', vertex: cityVid });
    expect(s.players[0]!.cityWalls).toBe(1);
    expect(s.players[0]!.resources.brick).toBe(playerBrickBefore - 2);
    expect(s.bank.brick).toBe(brickBefore + 2);
    expect(s.cityWalls?.[cityVid]).toBe('p0');
  });

  it('refuses 4th wall', () => {
    let s = setupCK();
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0 ? { ...p, cityWalls: 3 } : p,
      ),
    };
    // Give p0 a city to target.
    const cityVid = s.players[0]!.settlements[0]!;
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, cities: [cityVid], settlements: p.settlements.filter((v) => v !== cityVid) }
          : p,
      ),
    };
    s = rollToMain(s);
    s = giveResources(s, 'p0', { brick: 2 });
    expect(() =>
      applyAction(s, { type: 'buildCityWall', playerId: 'p0', vertex: cityVid }),
    ).toThrow(/max city walls/i);
  });

  it('discard threshold = 7 + 2*walls (counts commodities)', () => {
    let s = setupCK();
    // p1 holds 9 cards (5 resources + 4 commodities) and has 1 wall → threshold 9.
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1'
          ? {
              ...p,
              resources: { wood: 2, brick: 1, sheep: 1, wheat: 1, ore: 0 },
              commodities: { paper: 2, cloth: 1, coin: 1 },
              cityWalls: 1,
            }
          : p,
      ),
    };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] }); // 7
    // 9 cards, threshold 9 (7 + 2*1) — should NOT need to discard.
    expect(s.discardState?.required['p1']).toBeUndefined();
  });

  it('forces discard when hand exceeds threshold (counts commodities)', () => {
    let s = setupCK();
    s = {
      ...s,
      players: s.players.map((p) =>
        p.id === 'p1'
          ? {
              ...p,
              resources: { wood: 3, brick: 2, sheep: 1, wheat: 0, ore: 0 },
              commodities: { paper: 2, cloth: 0, coin: 0 },
              cityWalls: 0,
            }
          : p,
      ),
    };
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] }); // 7
    // 8 cards, threshold 7 → discard ceil(8/2)=4.
    expect(s.discardState?.required['p1']).toBe(4);
  });
});

describe('Cities & Knights — 7-roll with inactive robber', () => {
  it('skips moveRobber when no barbarian attack has resolved', () => {
    let s = setupCK();
    s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice: [3, 4] }); // 7
    // No one has > 7 cards, so the discard pass is empty; with robber inactive
    // we should land directly in main.
    expect(s.phase).toBe('main');
  });
});

describe('Cities & Knights — commodity production', () => {
  it('cities adjacent to wood/sheep/ore produce 1 resource + 1 commodity', () => {
    let s = setupCK();
    // Place a city on each of the first player's starting settlements to
    // guarantee at least one is adjacent to a wood/sheep/ore hex.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? { ...p, cities: [...p.settlements], settlements: [] }
          : p,
      ),
    };
    // Roll every possible non-7 total and check that at least one combination
    // yields a commodity to player 0.
    const totals = [2, 3, 4, 5, 6, 8, 9, 10, 11, 12];
    let yieldedCommodity = false;
    for (const total of totals) {
      const d1 = Math.max(1, total - 6);
      const d2 = total - d1;
      const before = s;
      const after = applyAction(before, {
        type: 'rollDice',
        playerId: 'p0',
        dice: [d1, d2] as [number, number],
      });
      const beforeCom =
        (before.players[0]!.commodities?.paper ?? 0) +
        (before.players[0]!.commodities?.cloth ?? 0) +
        (before.players[0]!.commodities?.coin ?? 0);
      const afterCom =
        (after.players[0]!.commodities?.paper ?? 0) +
        (after.players[0]!.commodities?.cloth ?? 0) +
        (after.players[0]!.commodities?.coin ?? 0);
      if (afterCom > beforeCom) {
        yieldedCommodity = true;
        break;
      }
    }
    expect(yieldedCommodity).toBe(true);
  });
});
