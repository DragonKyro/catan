import { describe, expect, it } from 'vitest';
import { createGame } from '../../../createGame';
import { applyAction } from '../../../engine';
import type { BoardState, GameState, Terrain, VertexId } from '../../../types';
import type { ScenarioLayout } from '../../../board/scenarioTypes';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '../../citiesAndKnights/constants';
import { baseScenarioAllowed, getBaseScenario } from './index';
import { generateBaseScenarioBoard } from './generator';

// The 5-6 player layouts of the Fun Maps that used to be 3-4 only: Black
// Forest, Diamond, Gear, Lakes, Twirl, Volcano. Pools must add up, tokens
// must be symmetric around 7, every harbor must sit on a real coast, red
// numbers must never touch (except on Black Forest), each shape keeps its
// symmetry, and Volcano keeps its whole mechanic on the bigger island.

type Coord = { q: number; r: number };
type Transform = (c: Coord) => Coord;

interface Expect56 {
  land: number;
  terrain: Partial<Record<Terrain, number>>;
  ports: number;
  allowAdjacentReds?: boolean;
  // Maps the land (and, with `portsSymmetric`, the harbors) onto itself.
  symmetry: Transform;
  portsSymmetric?: boolean;
}

// Point reflection through the 30-hex board's centre (the edge between
// (-1, 0) and (0, 0)).
const flip30: Transform = ({ q, r }) => ({ q: -1 - q, r: -r });
// Point reflection through (0, 0).
const flip0: Transform = ({ q, r }) => ({ q: -q, r: -r });
// 120° turn about (0, 0): (q, r, s) → (s, q, r).
const turn120: Transform = ({ q, r }) => ({ q: -q - r, r: q });

const MAPS: Record<string, Expect56> = {
  blackForest: {
    land: 30,
    terrain: { wood: 8, brick: 5, sheep: 5, wheat: 5, ore: 5, desert: 2 },
    ports: 11,
    allowAdjacentReds: true,
    symmetry: flip30,
  },
  diamond: {
    land: 25,
    terrain: { wood: 5, brick: 5, sheep: 4, wheat: 5, ore: 5, desert: 1 },
    ports: 10,
    symmetry: flip0,
    portsSymmetric: true,
  },
  gear: {
    land: 28,
    terrain: { wood: 5, brick: 5, sheep: 5, wheat: 6, ore: 5, desert: 2 },
    ports: 9,
    symmetry: turn120,
    portsSymmetric: true,
  },
  lakes: {
    land: 26,
    terrain: { wood: 5, brick: 5, sheep: 4, wheat: 5, ore: 5, desert: 2 },
    ports: 11,
    symmetry: flip30,
  },
  twirl: {
    land: 34,
    terrain: { wood: 7, brick: 6, sheep: 6, wheat: 7, ore: 6, desert: 2 },
    ports: 12,
    symmetry: flip30,
    portsSymmetric: true,
  },
  volcano: {
    land: 31,
    // The volcano is the one desert.
    terrain: { wood: 6, brick: 6, sheep: 6, wheat: 6, ore: 6, desert: 1 },
    ports: 11,
    symmetry: flip0,
  },
};

const SEEDS = Array.from({ length: 40 }, (_, i) => i * 7919 + 1);
const key = (c: Coord) => `${c.q},${c.r}`;
const NEIGHBOURS: Array<[number, number]> = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

function layout56(id: string): ScenarioLayout {
  const layout = getBaseScenario(id).layout5_6p;
  if (!layout) throw new Error(`${id} has no 5-6 layout`);
  return layout;
}

function landHexIds(board: BoardState): string[] {
  return board.hexIds.filter((h) => board.hexes[h]!.terrain !== 'sea');
}

function terrainCounts(board: BoardState): Partial<Record<Terrain, number>> {
  const out: Partial<Record<Terrain, number>> = {};
  for (const h of landHexIds(board)) {
    const t = board.hexes[h]!.terrain;
    out[t] = (out[t] ?? 0) + 1;
  }
  return out;
}

function isRed(n: number | null): boolean {
  return n === 6 || n === 8;
}

describe('Fun Maps at 5-6 players', () => {
  for (const [id, want] of Object.entries(MAPS)) {
    describe(id, () => {
      const scenario = getBaseScenario(id);
      const layout = layout56(id);

      it('is offered for 3-6 players', () => {
        expect(scenario.minPlayers).toBe(3);
        expect(scenario.maxPlayers).toBe(6);
        expect(scenario.layout3p).toBeDefined();
      });

      it('has pools that add up', () => {
        const land = layout.positions.filter((p) => p.kind !== 'sea');
        expect(land).toHaveLength(want.land);
        // No coordinate listed twice (land over sea or vice versa).
        const coords = layout.positions.map(key);
        expect(new Set(coords).size).toBe(coords.length);

        const drawn = layout.positions.filter((p) => p.kind === 'land' && !p.fixedTerrain);
        const poolSize = Object.values(layout.pools.terrainCounts).reduce((a, b) => a + (b ?? 0), 0);
        expect(poolSize).toBe(drawn.length);

        // Numbered land = every land hex that isn't a desert drawn from the
        // pool or a printed desert, plus a desert that forces a token; the
        // pinned tokens (the volcano's 6) are on top of the pool.
        const deserts = (layout.pools.terrainCounts.desert ?? 0) +
          layout.positions.filter((p) => p.kind === 'desert' && !p.forceToken).length;
        const pinned = layout.positions.filter((p) => p.fixedToken != null).length;
        const numbered = land.length - deserts;
        expect(layout.pools.tokens).toHaveLength(numbered - pinned);

        expect(layout.pools.portTypes).toHaveLength(layout.portAnchors.length);
        expect(layout.portAnchors).toHaveLength(want.ports);
      });

      it('has number tokens symmetric around 7', () => {
        const count = (n: number) => layout.pools.tokens.filter((t) => t === n).length;
        for (const t of layout.pools.tokens) {
          expect(t).toBeGreaterThanOrEqual(2);
          expect(t).toBeLessThanOrEqual(12);
          expect(t).not.toBe(7);
        }
        for (let n = 2; n <= 6; n++) expect(count(n), `${n} vs ${14 - n}`).toBe(count(14 - n));
      });

      it('keeps its shape symmetric', () => {
        const land = new Set(layout.positions.filter((p) => p.kind !== 'sea').map(key));
        for (const c of land) {
          const [q, r] = c.split(',').map(Number) as [number, number];
          expect(land.has(key(want.symmetry({ q, r }))), `image of ${c}`).toBe(true);
        }
        // Lakes / notches inside the frame map onto lakes / notches too.
        const sea = layout.positions.filter((p) => p.kind === 'sea');
        const inner = sea.filter((p) =>
          NEIGHBOURS.filter(([dq, dr]) => land.has(key({ q: p.q + dq, r: p.r + dr }))).length >= 3,
        );
        const seaSet = new Set(sea.map(key));
        for (const p of inner) expect(seaSet.has(key(want.symmetry(p))), `image of sea ${key(p)}`).toBe(true);
      });

      if (want.portsSymmetric) {
        it('spreads its harbors symmetrically', () => {
          const board = generateBaseScenarioBoard(id, 1, 6).board;
          const portHexes = new Set(
            board.ports.map((p) => {
              const land = board.edges[p.edge]!.hexes.find((h) => board.hexes[h]!.terrain !== 'sea')!;
              return land;
            }),
          );
          for (const h of portHexes) {
            const [q, r] = h.split(',').map(Number) as [number, number];
            expect(portHexes.has(key(want.symmetry({ q, r }))), `harbor hex ${h}`).toBe(true);
          }
        });
      }

      for (const players of [5, 6]) {
        it(`builds consistent ${players}-player boards`, () => {
          for (const seed of SEEDS) {
            const { board } = generateBaseScenarioBoard(id, seed, players);
            const land = landHexIds(board);
            expect(land).toHaveLength(want.land);
            expect(terrainCounts(board)).toEqual(want.terrain);

            // Every producing hex has a number; deserts don't (the volcano
            // is the exception, with its pinned 6).
            for (const h of land) {
              const hex = board.hexes[h]!;
              if (hex.terrain === 'desert' && h !== board.volcanoHex) expect(hex.numberToken).toBeNull();
              else expect(hex.numberToken, `token on ${h}`).not.toBeNull();
            }

            // Every anchor resolved to a harbor, each on a coastal edge
            // (land on one side, sea on the other), no two sharing a corner.
            expect(board.ports).toHaveLength(want.ports);
            const used = new Set<VertexId>();
            for (const port of board.ports) {
              const edge = board.edges[port.edge]!;
              const terrains = edge.hexes.map((h) => board.hexes[h]!.terrain);
              expect(terrains, `harbor ${port.edge}`).toHaveLength(2);
              expect(terrains.filter((t) => t === 'sea'), `harbor ${port.edge}`).toHaveLength(1);
              for (const v of edge.vertices) {
                expect(used.has(v), `harbors share corner ${v}`).toBe(false);
                used.add(v);
              }
            }

            // No 6 / 8 next to another 6 / 8 (the volcano's 6 included).
            if (!want.allowAdjacentReds) {
              for (const h of land) {
                const hex = board.hexes[h]!;
                if (!isRed(hex.numberToken)) continue;
                for (const [dq, dr] of NEIGHBOURS) {
                  const n = board.hexes[key({ q: hex.coord.q + dq, r: hex.coord.r + dr })];
                  if (n && n.terrain !== 'sea') {
                    expect(isRed(n.numberToken), `seed ${seed}: reds on ${h} and ${n.id}`).toBe(false);
                  }
                }
              }
            }
          }
        });

        it(`createGame deals a ${players}-player game on the 5-6 board`, () => {
          const game = createGame({
            playerNames: Array.from({ length: players }, (_, i) => `P${i + 1}`),
            seed: 42,
            settings: { baseScenarioId: id, expansions: [] },
            randomizeTurnOrder: false,
          });
          expect(landHexIds(game.board)).toHaveLength(want.land);
          expect(game.boardVariant).toBe('5-6');
        });
      }

      if (baseScenarioAllowed(scenario, [CITIES_AND_KNIGHTS_EXPANSION_ID])) {
        it('also deals a 5-6 player Cities & Knights game', () => {
          for (const players of [5, 6]) {
            const game = createGame({
              playerNames: Array.from({ length: players }, (_, i) => `P${i + 1}`),
              seed: 7,
              settings: { baseScenarioId: id, expansions: [CITIES_AND_KNIGHTS_EXPANSION_ID] },
              randomizeTurnOrder: false,
            });
            expect(landHexIds(game.board)).toHaveLength(want.land);
          }
        });
      }
    });
  }

  it('Black Forest pins its 8-hex forest', () => {
    const { board } = generateBaseScenarioBoard('blackForest', 5, 6);
    for (const h of ['-1,-1', '0,-1', '1,-1', '-1,0', '0,0', '-2,1', '-1,1', '0,1']) {
      expect(board.hexes[h]!.terrain).toBe('wood');
    }
    expect(getBaseScenario('blackForest').layout5_6p!.tokenConstraints?.allow6_8Adjacent).toBe(true);
  });

  it('Lakes puts its four lake hexes inside the island', () => {
    const { board } = generateBaseScenarioBoard('lakes', 5, 6);
    for (const h of ['1,-1', '0,0', '-1,0', '-2,1']) {
      const hex = board.hexes[h]!;
      expect(hex.terrain).toBe('sea');
      const [q, r] = h.split(',').map(Number) as [number, number];
      const around = NEIGHBOURS.map(([dq, dr]) => board.hexes[key({ q: q + dq, r: r + dr })]!.terrain);
      // Each lake touches land and at most the other lake hexes.
      expect(around.filter((t) => t !== 'sea').length).toBeGreaterThanOrEqual(4);
    }
  });

  it('Gear has nine teeth: every ring-3 hex alternates land and sea', () => {
    const { board } = generateBaseScenarioBoard('gear', 5, 6);
    // Walk ring 3 in order.
    const ring: Coord[] = [];
    let c: Coord = { q: 0, r: -3 };
    const walk: Array<[number, number]> = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]];
    for (const [dq, dr] of walk) {
      for (let i = 0; i < 3; i++) {
        ring.push(c);
        c = { q: c.q + dq, r: c.r + dr };
      }
    }
    const isLand = ring.map((h) => board.hexes[key(h)]!.terrain !== 'sea');
    expect(isLand.filter(Boolean)).toHaveLength(9);
    for (let i = 0; i < ring.length; i++) expect(isLand[i]).not.toBe(isLand[(i + 1) % ring.length]);
  });
});

describe('Volcano at 5-6 players', () => {
  function volcanoGame(players: number): GameState {
    return createGame({
      playerNames: Array.from({ length: players }, (_, i) => `P${i + 1}`),
      seed: 42,
      settings: { baseScenarioId: 'volcano', expansions: [] },
      randomizeTurnOrder: false,
    });
  }

  function rolling(game: GameState, edit: (g: GameState) => GameState): GameState {
    return {
      ...edit(game),
      phase: 'rollOrPlayKnight',
      hasRolledThisTurn: false,
      hasPlayedDevCardThisTurn: false,
    };
  }

  for (const players of [5, 6]) {
    it(`${players}p: the volcano sits in the middle of the island with a 6`, () => {
      const game = volcanoGame(players);
      expect(game.board.volcanoHex).toBe('0,0');
      const v = game.board.hexes['0,0']!;
      expect(v.terrain).toBe('desert');
      expect(v.numberToken).toBe(6);
      expect(game.board.robberHex).toBe('0,0');
      // Three full rings of land around it (minus the six cut corners).
      for (const [dq, dr] of NEIGHBOURS) {
        for (let k = 1; k <= 2; k++) {
          expect(game.board.hexes[key({ q: dq * k, r: dr * k })]!.terrain).not.toBe('sea');
        }
      }
    });

    it(`${players}p: no starting settlement on a volcano corner`, () => {
      const game = volcanoGame(players);
      for (const corner of game.board.hexes['0,0']!.corners) {
        expect(() =>
          applyAction(game, { type: 'placeInitialSettlement', playerId: 'p0', vertex: corner }),
        ).toThrow(/volcano/i);
      }
      // A corner one ring out is fine.
      const ok = game.board.hexes['2,-1']!.corners.find(
        (vid) => !game.board.vertices[vid]!.hexes.includes('0,0'),
      )!;
      expect(() =>
        applyAction(game, { type: 'placeInitialSettlement', playerId: 'p0', vertex: ok }),
      ).not.toThrow();
    });

    it(`${players}p: rolling a 6 erupts — a settlement goes, a city drops to a settlement`, () => {
      const game = volcanoGame(players);
      const [a, , b] = game.board.hexes['0,0']!.corners as VertexId[];
      const settled = rolling(game, (g) => ({
        ...g,
        players: g.players.map((p, i) => (i === 0 ? { ...p, settlements: [...p.settlements, a!] } : p)),
      }));
      const after = applyAction(settled, { type: 'rollDice', playerId: 'p0', dice: [3, 3] });
      expect(after.players[0]!.settlements).not.toContain(a);

      const city = rolling(game, (g) => ({
        ...g,
        players: g.players.map((p, i) => (i === 1 ? { ...p, cities: [...p.cities, b!] } : p)),
      }));
      const afterCity = applyAction(city, { type: 'rollDice', playerId: 'p0', dice: [2, 4] });
      expect(afterCity.players[1]!.cities).not.toContain(b);
      expect(afterCity.players[1]!.settlements).toContain(b);

      // Any other number leaves the slopes alone.
      const calm = applyAction(settled, { type: 'rollDice', playerId: 'p0', dice: [4, 4] });
      expect(calm.players[0]!.settlements).toContain(a);
    });
  }
});
