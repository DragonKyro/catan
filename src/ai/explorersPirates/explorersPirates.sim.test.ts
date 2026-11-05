import { describe, expect, it } from 'vitest';
import type { Action, EpHiddenTile, GameState, HexId } from '@/game/types';
import { EP_DEFAULT_VP } from '@/game/modules/explorersPirates/constants';
import { legalShipSteps, shipMpLeft, shipsOf } from '@/game/modules/explorersPirates/state';
import { getActingPlayerId } from '@/game/helpers';
import { chooseAction } from '@/ai';
import { simulateEp, type EpSimStats } from './simSupport';
import { shipReach } from './planner';

// All-heuristic Explorers & Pirates games at 3 and 4 players: the games
// finish at 17 VP and every mechanic of the expansion gets used. Along the
// way two oracles run on sampled states: the route planner's one-step moves
// match the engine's `legalShipSteps`, and the AI decides the same thing
// when everything face down is scrambled (it never peeks).

const SEEDS = [1, 2, 3, 4];
const totals: Record<number, EpSimStats[]> = { 3: [], 4: [] };

// Rewrite every hidden fact: what lies under each face-down hex (rotated
// within its region), the disc stacks, the lair tokens and the numbers of
// lairs not yet captured.
function scrambleHidden(s: GameState): GameState {
  const ep = s.explorersPirates!;
  const byRegion = new Map<string, HexId[]>();
  for (const [h, t] of Object.entries(ep.hidden)) byRegion.set(t.region, [...(byRegion.get(t.region) ?? []), h]);
  const hidden: Record<HexId, EpHiddenTile> = {};
  for (const hexes of byRegion.values()) {
    hexes.forEach((h, i) => {
      hidden[h] = ep.hidden[hexes[(i + 1) % hexes.length]!]!;
    });
  }
  return {
    ...s,
    explorersPirates: {
      ...ep,
      hidden,
      discs: { parrot: [...ep.discs.parrot].reverse(), goose: [...ep.discs.goose].reverse() },
      lairTokens: [...ep.lairTokens].reverse(),
      lairs: ep.lairs.map((l) => (l.captured ? l : { ...l, number: l.number === 3 ? 11 : 3 })),
    },
  };
}

function withoutDice(a: Action | null): unknown {
  if (a && a.type === 'rollDice') return { ...a, dice: null };
  return a;
}

describe('Explorers & Pirates, all-AI', () => {
  for (const players of [3, 4]) {
    for (const seed of SEEDS) {
      it(`${players}p seed ${seed} finishes at ${EP_DEFAULT_VP} VP`, () => {
        let sampled = 0;
        let plannerChecks = 0;
        const r = simulateEp(seed, players, 9000, (before) => {
          sampled++;
          if (sampled % 7 !== 0 || before.pendingTrade) return;
          const pid = getActingPlayerId(before);
          // Planner oracle: one-step reach == the engine's legal steps.
          if (before.phase === 'epMovement') {
            for (const ship of shipsOf(before, pid)) {
              const mp = shipMpLeft(before, ship.id);
              const m = before.explorersPirates!.movement!;
              const reach = shipReach(before, ship, {
                mp,
                gold: before.players.find((p) => p.id === pid)!.gold ?? 0,
                tributePaid: m.paidTribute.includes(ship.id),
              });
              const planned = [...reach.values()].filter((n) => n.steps === 1).map((n) => n.edge).sort();
              expect(planned).toEqual([...legalShipSteps(before, ship.id)].sort());
              plannerChecks++;
            }
          }
          // No peeking: scrambling what's face down changes nothing.
          if (sampled % 21 === 0) {
            expect(withoutDice(chooseAction(scrambleHidden(before), pid))).toEqual(withoutDice(chooseAction(before, pid)));
          }
        });
        totals[players]!.push(r.stats);
        // eslint-disable-next-line no-console
        console.log(`E&P ${players}p seed ${seed}: winner ${r.final.winner}`, JSON.stringify(r.vp), JSON.stringify(r.stats));
        expect(r.final.phase).toBe('gameOver');
        expect(r.final.winner).toBeTruthy();
        expect(r.vp[r.final.winner!]).toBeGreaterThanOrEqual(EP_DEFAULT_VP);
        expect(plannerChecks).toBeGreaterThan(0);
        // AI proposals stay within the per-turn cap.
        expect(r.stats.maxProposalsPerTurn).toBeLessThanOrEqual(2);
        expect(r.stats.explored).toBeGreaterThan(0);
        expect(r.stats.harbors).toBeGreaterThan(0);
      });
    }
  }

  it('used every mechanic across the runs', () => {
    for (const players of [3, 4]) {
      const runs = totals[players]!;
      expect(runs).toHaveLength(SEEDS.length);
      const sum = (k: keyof EpSimStats) => runs.reduce((n, t) => n + t[k], 0);
      expect(sum('explored')).toBeGreaterThan(10 * SEEDS.length);
      expect(sum('harbors')).toBeGreaterThan(0);
      expect(sum('founded')).toBeGreaterThan(0);
      expect(sum('settlers')).toBeGreaterThan(0);
      expect(sum('lairsCaptured')).toBeGreaterThan(0);
      expect(sum('crewsToFarms')).toBeGreaterThan(0);
      expect(sum('fishDelivered')).toBeGreaterThan(0);
      expect(sum('spiceDelivered')).toBeGreaterThan(0);
      expect(sum('chases')).toBeGreaterThan(0);
      expect(sum('piratePlacements')).toBeGreaterThan(0);
      expect(sum('goldSpent')).toBeGreaterThan(0);
      expect(sum('fishRolls')).toBeGreaterThan(0);
    }
  });
});
