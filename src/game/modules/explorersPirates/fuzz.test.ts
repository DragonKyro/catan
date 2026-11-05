import { describe, expect, it } from 'vitest';
import { applyAction } from '../../engine';
import { getActingPlayerId } from '../../helpers';
import { canConnectRoad, canPlaceInitialRoad, canPlaceInitialSettlement, canPlaceSettlement } from '../../placement';
import { nextRng, rngInt } from '../../rng';
import { calculateVictoryPoints } from '../../scoring/points';
import type { Action, EpCargo, GameState, Resource } from '../../types';
import { RESOURCES } from '../../types';
import { EP_PIECES, EP_SHIPS_PER_EDGE } from './constants';
import { epSetupShipEdges } from './setup';
import {
  buildableShipEdges,
  cargoUnits,
  crewsOnBoard,
  epSupply,
  foundableVertices,
  harborUpgradeSpots,
  harborsAtShip,
  harborsOf,
  isExploredSea,
  isShipEdge,
  legalShipSteps,
  pieceSpots,
  pirateHexOptions,
  pirateVictims,
  plainSettlementsOf,
  settlersOnBoard,
  shipNextToHex,
  shipsOf,
  trackLength,
  type EpGame,
} from './state';
import { epGame } from './testSupport';

// Random-play fuzzing: from a fresh game, keep picking a random candidate
// action (most of them legal, some not), apply the ones the reducer accepts,
// and check the invariants after every accepted action. Strategy-free, so it
// reaches corners a sensible player (or the AI) never would.

function pick<T>(rng: number, arr: readonly T[]): [T | undefined, number] {
  if (arr.length === 0) return [undefined, rng];
  const [i, r] = rngInt(rng, arr.length);
  return [arr[i], r];
}

function candidates(s: EpGame, rng: number): [Action[], number] {
  const pid = getActingPlayerId(s);
  const ep = s.explorersPirates;
  const out: Action[] = [];
  let r = rng;
  const p = s.players.find((x) => x.id === pid)!;
  switch (s.phase) {
    case 'setupRound1':
    case 'setupRound2':
    case 'setupRound3': {
      const step = s.setupState!.step;
      if (step === 'settlement') {
        for (const v of s.board.vertexIds) if (canPlaceInitialSettlement(s, v)) out.push({ type: 'placeInitialSettlement', playerId: pid, vertex: v });
      } else if (step === 'road') {
        const a = s.setupState!.lastPlacedSettlement!;
        for (const e of s.board.vertices[a]!.edges) if (canPlaceInitialRoad(s, a, e)) out.push({ type: 'placeInitialRoad', playerId: pid, edge: e });
      } else {
        for (const e of epSetupShipEdges(s, pid)) out.push({ type: 'placeInitialShip', playerId: pid, edge: e });
      }
      return [out, r];
    }
    case 'rollOrPlayKnight': {
      let a: number;
      let b: number;
      [a, r] = rngInt(r, 6);
      [b, r] = rngInt(r, 6);
      return [[{ type: 'rollDice', playerId: pid, dice: [a + 1, b + 1] }], r];
    }
    case 'discard': {
      const need = s.discardState!.required[pid]!;
      const cards: Resource[] = [];
      for (const res of RESOURCES) for (let i = 0; i < p.resources[res]; i++) cards.push(res);
      const resources: Partial<Record<Resource, number>> = {};
      for (let i = 0; i < need; i++) {
        let j: number;
        [j, r] = rngInt(r, cards.length);
        const c = cards.splice(j, 1)[0]!;
        resources[c] = (resources[c] ?? 0) + 1;
      }
      return [[{ type: 'discard', playerId: pid, resources }], r];
    }
    case 'epPlacePirate': {
      for (const hex of pirateHexOptions(s)) {
        const victims = pirateVictims(s, pid, hex);
        if (victims.length === 0) out.push({ type: 'epPlacePirate', playerId: pid, hex, stealFrom: null });
        for (const v of victims) out.push({ type: 'epPlacePirate', playerId: pid, hex, stealFrom: v });
      }
      return [out, r];
    }
    case 'main': {
      for (const v of s.board.vertexIds) if (canPlaceSettlement(s, pid, v)) out.push({ type: 'buildSettlement', playerId: pid, vertex: v });
      for (const e of s.board.edgeIds) if (canConnectRoad(s, pid, e)) out.push({ type: 'buildRoad', playerId: pid, edge: e });
      for (const v of harborUpgradeSpots(s, pid)) out.push({ type: 'epBuildHarbor', playerId: pid, vertex: v });
      const ships = shipsOf(s, pid);
      for (const e of buildableShipEdges(s, pid)) {
        out.push({ type: 'epBuildShip', playerId: pid, edge: e });
        if (ships[0]) out.push({ type: 'epBuildShip', playerId: pid, edge: e, recycle: ships[0].id });
      }
      for (const piece of ['settler', 'crew'] as const) {
        for (const at of pieceSpots(s, pid, piece, false)) {
          const type = piece === 'settler' ? 'epBuildSettler' : 'epBuildCrew';
          out.push({ type, playerId: pid, at } as Action);
          const held = 'harbor' in at ? ep.harbors[at.harbor]! : ships.find((x) => x.id === at.ship)!.cargo;
          if (held.length > 0) out.push({ type, playerId: pid, at, evict: [...held] } as Action);
        }
      }
      for (const give of RESOURCES) {
        out.push({ type: 'epFastGold', playerId: pid, give });
        out.push({ type: 'buyGold', playerId: pid, give });
        for (const receive of RESOURCES) if (receive !== give) out.push({ type: 'bankTrade', playerId: pid, give, receive });
        out.push({ type: 'spendGold', playerId: pid, resource: give });
      }
      out.push({ type: 'endTurn', playerId: pid });
      return [out, r];
    }
    case 'epMovement': {
      const ships = shipsOf(s, pid);
      for (const ship of ships) {
        for (const to of legalShipSteps(s, ship.id)) {
          // Moves are the point of the phase: weight them up.
          for (let k = 0; k < 4; k++) out.push({ type: 'epMoveShip', playerId: pid, ship: ship.id, to });
        }
        out.push({ type: 'epBoostShip', playerId: pid, ship: ship.id });
        for (const v of foundableVertices(s, ship.id)) out.push({ type: 'epFoundSettlement', playerId: pid, ship: ship.id, vertex: v });
        for (const h of harborsAtShip(s, ship)) {
          const pieces: EpCargo[] = ['settler', 'crew', 'fish', 'spice'];
          for (const c of pieces) {
            out.push({ type: 'epTransfer', playerId: pid, ship: ship.id, harbor: h, load: [c], unload: [] });
            out.push({ type: 'epTransfer', playerId: pid, ship: ship.id, harbor: h, load: [], unload: [c] });
          }
          out.push({ type: 'epTransfer', playerId: pid, ship: ship.id, harbor: h, load: [...ep.harbors[h]!], unload: [...ship.cargo] });
        }
        for (const l of ep.lairs) {
          if (!shipNextToHex(s, ship, l.hex)) continue;
          out.push({ type: 'epCrewToLair', playerId: pid, ship: ship.id, hex: l.hex });
          out.push({ type: 'epCrewFromLair', playerId: pid, ship: ship.id, hex: l.hex });
        }
        for (const f of ep.farms) {
          if (!shipNextToHex(s, ship, f.hex)) continue;
          out.push({ type: 'epCrewToFarm', playerId: pid, ship: ship.id, hex: f.hex });
          out.push({ type: 'epLoadSpice', playerId: pid, ship: ship.id, hex: f.hex });
        }
        for (const sh of ep.shoals) {
          if (shipNextToHex(s, ship, sh.hex)) out.push({ type: 'epLoadFish', playerId: pid, ship: ship.id, hex: sh.hex });
        }
        out.push({ type: 'epDeliver', playerId: pid, ship: ship.id });
        out.push({ type: 'epChasePirate', playerId: pid, ship: ship.id });
      }
      out.push({ type: 'epFishRoll', playerId: pid });
      out.push({ type: 'endTurn', playerId: pid });
      return [out, r];
    }
    default:
      throw new Error(`fuzz: unexpected phase ${s.phase}`);
  }
}

function checkInvariants(s: EpGame, step: number): void {
  const ep = s.explorersPirates;
  const ctx = `step ${step}, phase ${s.phase}`;
  // Resources are conserved between the bank and the hands (19 each).
  for (const res of RESOURCES) {
    const total = s.bank[res] + s.players.reduce((n, p) => n + p.resources[res], 0);
    expect(total, `${ctx}: ${res}`).toBe(19);
  }
  // Fish hauls: supply + shoals + carried / stored = 6.
  const carried = (c: EpCargo[]) => c.filter((x) => x === 'fish').length;
  const fish =
    ep.fishSupply +
    ep.shoals.filter((x) => x.haul).length +
    ep.ships.reduce((n, sh) => n + carried(sh.cargo), 0) +
    Object.values(ep.harbors).reduce((n, c) => n + carried(c), 0);
  expect(fish, `${ctx}: fish hauls`).toBe(6);
  const perEdge = new Map<string, number>();
  for (const sh of ep.ships) {
    expect(cargoUnits(sh.cargo), `${ctx}: cargo of ${sh.id}`).toBeLessThanOrEqual(2);
    expect(isShipEdge(s, sh.edge), `${ctx}: ${sh.id} on a sea edge`).toBe(true);
    perEdge.set(sh.edge, (perEdge.get(sh.edge) ?? 0) + 1);
  }
  const moving = ep.movement?.moving ? ep.ships.find((x) => x.id === ep.movement!.moving) : undefined;
  for (const [edge, n] of perEdge) {
    const limit = moving?.edge === edge ? EP_SHIPS_PER_EDGE + 1 : EP_SHIPS_PER_EDGE;
    expect(n, `${ctx}: ships on ${edge}`).toBeLessThanOrEqual(limit);
  }
  for (const c of Object.values(ep.harbors)) expect(cargoUnits(c), `${ctx}: harbor cargo`).toBeLessThanOrEqual(2);
  for (const p of s.players) {
    expect(shipsOf(s, p.id).length, `${ctx}: ${p.id} ships`).toBeLessThanOrEqual(EP_PIECES.ships);
    expect(settlersOnBoard(s, p.id), `${ctx}: ${p.id} settlers`).toBeLessThanOrEqual(EP_PIECES.settlers);
    expect(crewsOnBoard(s, p.id), `${ctx}: ${p.id} crews`).toBeLessThanOrEqual(EP_PIECES.crews);
    expect(harborsOf(s, p.id).length, `${ctx}: ${p.id} harbors`).toBeLessThanOrEqual(EP_PIECES.harbors);
    expect(plainSettlementsOf(s, p.id).length, `${ctx}: ${p.id} settlements`).toBeLessThanOrEqual(EP_PIECES.settlements);
    expect(p.roads.length, `${ctx}: ${p.id} roads`).toBeLessThanOrEqual(EP_PIECES.roads);
    expect(p.gold ?? 0, `${ctx}: ${p.id} gold`).toBeGreaterThanOrEqual(0);
    expect(p.cities, `${ctx}: no cities`).toEqual([]);
    const sup = epSupply(s, p.id);
    for (const v of Object.values(sup)) expect(v).toBeGreaterThanOrEqual(0);
  }
  // Every harbor is somebody's settlement.
  const all = new Set(s.players.flatMap((p) => p.settlements));
  for (const v of Object.keys(ep.harbors)) expect(all.has(v), `${ctx}: harbor ${v}`).toBe(true);
  // No two buildings closer than the distance rule allows.
  for (const v of all) {
    for (const n of s.board.vertices[v]!.neighborVertices) expect(all.has(n), `${ctx}: distance rule at ${v}`).toBe(false);
  }
  for (const l of ep.lairs) expect(l.crews.length, `${ctx}: lair crews`).toBeLessThanOrEqual(3);
  for (const [hex] of Object.entries(ep.hidden)) {
    expect(s.board.hexes[hex]!.terrain, `${ctx}: hidden ${hex} shows sea`).toBe('sea');
    expect(s.board.hexes[hex]!.numberToken).toBeNull();
  }
  if (ep.pirate) {
    expect(isExploredSea(s, ep.pirate.hex), `${ctx}: pirate on explored sea`).toBe(true);
    expect(ep.frameHexes).not.toContain(ep.pirate.hex);
  }
  for (const m of ['pirateLairs', 'fish', 'spice'] as const) {
    for (const pos of Object.values(ep.tracks[m])) expect(pos).toBeLessThanOrEqual(trackLength(m));
  }
  // Buildings are only ever on explored land.
  for (const v of all) {
    for (const h of s.board.vertices[v]!.hexes) expect(ep.hidden[h], `${ctx}: building next to hidden ${h}`).toBeUndefined();
  }
}

function fuzz(seed: number, players: number, steps: number) {
  let s: GameState = epGame(seed, players);
  let rng = seed * 7919 + 13;
  const seen = new Set<string>();
  let accepted = 0;
  for (let step = 0; step < steps && s.phase !== 'gameOver'; step++) {
    // God mode: a trickle of resources and gold keeps the builds coming.
    if (s.phase === 'main' && step % 3 === 0) {
      const pid = getActingPlayerId(s);
      let res: Resource | undefined;
      [res, rng] = pick(rng, RESOURCES);
      if (res && s.bank[res] > 0) {
        s = {
          ...s,
          bank: { ...s.bank, [res]: s.bank[res] - 1 },
          players: s.players.map((p) =>
            p.id === pid ? { ...p, resources: { ...p.resources, [res!]: p.resources[res!] + 1 }, gold: (p.gold ?? 0) + 1 } : p,
          ),
        };
      }
    }
    let list: Action[];
    [list, rng] = candidates(s as EpGame, rng);
    let next: GameState | null = null;
    for (let tries = 0; tries < 40 && list.length > 0 && !next; tries++) {
      let i: number;
      [i, rng] = rngInt(rng, list.length);
      const a = list.splice(i, 1)[0]!;
      try {
        next = applyAction(s, a);
        seen.add(a.type);
      } catch {
        /* illegal candidate — try another */
      }
    }
    if (!next) {
      // Nothing worked (rare): the acting player ends the phase.
      next = applyAction(s, { type: 'endTurn', playerId: getActingPlayerId(s) });
    }
    s = next;
    accepted++;
    [, rng] = nextRng(rng);
    if (s.phase !== 'gameOver') checkInvariants(s as EpGame, step);
  }
  return { s: s as EpGame, seen, accepted };
}

describe('Explorers & Pirates fuzzing', () => {
  it.each([
    [1, 3],
    [2, 4],
    [3, 3],
    [4, 4],
  ])('seed %i, %i players: thousands of random actions keep every invariant', (seed, players) => {
    const { s, seen, accepted } = fuzz(seed, players, 2500);
    if (process.env.EP_FUZZ_LOG) {
      const ep = s.explorersPirates;
      console.log(seed, players, [...seen].sort().join(' '), '| lairs captured', ep.lairs.filter((l) => l.captured).length, '| tracks', JSON.stringify(ep.tracks));
    }
    expect(accepted).toBeGreaterThan(1000);
    // The random walk reaches the expansion's actions.
    for (const t of ['placeInitialShip', 'epMoveShip', 'epBuildShip', 'epBuildCrew', 'epBuildHarbor', 'endTurn']) {
      expect(seen.has(t), `reached ${t}`).toBe(true);
    }
    expect(Object.keys(s.explorersPirates.hidden).length).toBeLessThan(32);
    for (const p of s.players) expect(calculateVictoryPoints(s, p.id, true)).toBeGreaterThanOrEqual(2);
  }, 60000);
});
