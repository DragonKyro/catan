import { describe, it, expect } from 'vitest';
import { hexNumbers, hexPips, hexRollsOn, numberPips } from './hexNumbers';
import { materializeLayout } from './layoutMaterializer';
import type { ScenarioLayout } from './scenarioTypes';

describe('hexNumbers', () => {
  it('reads a plain disc, no disc, and extra numbers', () => {
    expect(hexNumbers({ numberToken: 8 })).toEqual([8]);
    expect(hexNumbers({ numberToken: null })).toEqual([]);
    expect(hexNumbers({ numberToken: 12, extraNumbers: [2] })).toEqual([12, 2]);
  });

  it('rolls on every number a hex carries', () => {
    const hex = { numberToken: 2, extraNumbers: [3, 11, 12] };
    for (const n of [2, 3, 11, 12]) expect(hexRollsOn(hex, n)).toBe(true);
    expect(hexRollsOn(hex, 6)).toBe(false);
    expect(hexRollsOn({ numberToken: 6 }, 6)).toBe(true);
  });

  it('sums pips over all numbers', () => {
    expect(numberPips(6)).toBe(5);
    expect(numberPips(null)).toBe(0);
    expect(hexPips({ numberToken: 2, extraNumbers: [3, 11, 12] })).toBe(6);
    expect(hexPips({ numberToken: 12, extraNumbers: [2] })).toBe(2);
  });
});

describe('materializeLayout scenario knobs', () => {
  const positions = [
    { q: 0, r: 0, kind: 'land' as const, zone: 'mid' },
    { q: 1, r: 0, kind: 'land' as const, zone: 'mid' },
    { q: 2, r: 0, kind: 'land' as const },
    { q: 3, r: 0, kind: 'land' as const },
  ];

  it('puts zone terrains inside their zone, printed numbers on their tile, stacked discs on their host', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const layout: ScenarioLayout = {
        positions,
        portAnchors: [],
        tokenConstraints: { allow6_8Adjacent: true },
        pools: {
          terrainCounts: { wood: 2, ore: 1 },
          zoneTerrains: { mid: { lake: 1 } },
          printedNumbers: { lake: [2, 3, 11, 12] },
          tokens: [12, 5, 9],
          stackedTokens: [{ token: 2, onto: 12 }],
          portTypes: [],
        },
      };
      const { hexDefs } = materializeLayout(layout, seed);
      const lake = hexDefs.find((h) => h.terrain === 'lake')!;
      expect(lake.q === 0 || lake.q === 1).toBe(true);
      expect([lake.token, ...(lake.extraTokens ?? [])]).toEqual([2, 3, 11, 12]);
      const host = hexDefs.find((h) => h.token === 12)!;
      expect(host.extraTokens).toEqual([2]);
    }
  });
});
