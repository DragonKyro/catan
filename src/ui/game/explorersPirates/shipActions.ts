import type { EdgeId, EpCargo, EpLocation, EpShip, GameState, HexId, PlayerId, VertexId } from '@/game/types';
import {
  battleReadyShips,
  cargoAt,
  chaseNumbers,
  foundableVertices,
  harborsAtShip,
  hasRoomFor,
  isExplorersPirates,
  legalShipSteps,
  moveCanEnd,
  removeCargo,
  shipById,
  shipEnds,
  shipMpLeft,
  shipNextToHex,
  shipsOf,
} from '@/game/modules/explorersPirates/state';
import { EP_BOOST_MP, EP_COSTS } from '@/game/modules/explorersPirates/constants';
import { canAfford } from '@/game/resources';

// What a ship can do right now in the Movement phase, read from the same
// helpers the engine validates with (src/game/modules/explorersPirates/
// state.ts), so the ActionBar buttons and the board targets only ever
// offer legal actions.

export interface EpShipOptions {
  ship: EpShip;
  mp: number;
  steps: EdgeId[];
  found: VertexId[];
  crewToLair: HexId[];
  crewFromLair: HexId[];
  crewToFarm: HexId[];
  loadSpice: HexId[];
  loadFish: HexId[];
  deliver: boolean;
  chase: boolean;
  chaseNumbers: number[];
  // Harbor settlements of yours at an end of the ship (load / unload).
  harbors: VertexId[];
  canBoost: boolean;
  boostReason: string;
}

export function epShipOptions(game: GameState, shipId: string): EpShipOptions | null {
  if (!isExplorersPirates(game)) return null;
  const ep = game.explorersPirates;
  const ship = shipById(game, shipId);
  const m = ep.movement;
  if (!ship || !m || game.phase !== 'epMovement') return null;
  const owner = ship.owner;
  const hasCrew = ship.cargo.includes('crew');
  const next = (h: HexId) => shipNextToHex(game, ship, h);
  const player = game.players.find((p) => p.id === owner);
  const finished = m.moved.includes(ship.id) && m.moving !== ship.id;
  let boostReason = `Pay 1 wool: +${EP_BOOST_MP} MP for this ship (once a turn)`;
  let canBoost = true;
  if (m.boosted.includes(ship.id)) {
    canBoost = false;
    boostReason = 'Already boosted this turn';
  } else if (finished) {
    canBoost = false;
    boostReason = 'This ship has finished moving';
  } else if (!player || !canAfford(player.resources, EP_COSTS.boost)) {
    canBoost = false;
    boostReason = 'Needs 1 wool';
  }
  const anchors = ep.councilAnchors;
  return {
    ship,
    mp: shipMpLeft(game, ship.id),
    steps: legalShipSteps(game, ship.id),
    found: foundableVertices(game, ship.id),
    crewToLair: hasCrew ? ep.lairs.filter((l) => !l.captured && next(l.hex)).map((l) => l.hex) : [],
    crewFromLair: hasRoomFor(ship.cargo, ['crew'])
      ? ep.lairs
          .filter((l) => l.captured && !ep.pendingLairs.includes(l.hex) && l.crews.includes(owner) && next(l.hex))
          .map((l) => l.hex)
      : [],
    crewToFarm: hasCrew ? ep.farms.filter((f) => !f.crews.includes(owner) && next(f.hex)).map((f) => f.hex) : [],
    loadSpice: hasRoomFor(ship.cargo, ['spice'])
      ? ep.farms.filter((f) => f.crews.includes(owner) && f.sacks.includes(owner) && next(f.hex)).map((f) => f.hex)
      : [],
    loadFish: hasRoomFor(ship.cargo, ['fish']) ? ep.shoals.filter((s) => s.haul && next(s.hex)).map((s) => s.hex) : [],
    deliver:
      ship.cargo.some((c) => c === 'fish' || c === 'spice') && shipEnds(game, ship).some((v) => anchors.includes(v)),
    chase: battleReadyShips(game, owner).some((s) => s.id === ship.id) && moveCanEnd(game),
    chaseNumbers: chaseNumbers(game, owner),
    harbors: harborsAtShip(game, ship),
    canBoost,
    boostReason,
  };
}

// The ship the Movement phase is about: the one under way, else the one the
// player picked, else their only ship.
export function epSelectedShip(game: GameState, playerId: PlayerId, picked?: string): EpShip | null {
  const ep = game.explorersPirates;
  if (!ep) return null;
  const mine = shipsOf(game, playerId);
  const moving = ep.movement?.moving;
  if (moving) {
    const s = mine.find((x) => x.id === moving);
    if (s) return s;
  }
  if (picked) {
    const s = mine.find((x) => x.id === picked);
    if (s) return s;
  }
  return mine.length === 1 ? mine[0]! : null;
}

// Ways to make room for `piece` at a full spot: each a minimal set of
// pieces to return to the supply (one occurrence each).
export function evictionChoices(game: GameState, at: EpLocation, piece: EpCargo): EpCargo[][] {
  const cargo = isExplorersPirates(game) ? cargoAt(game, at) : null;
  if (!cargo) return [];
  if (hasRoomFor(cargo, [piece])) return [[]];
  const out: EpCargo[][] = [];
  const seen = new Set<string>();
  const n = cargo.length;
  // Subsets by size, smallest first; skip supersets of a working set.
  for (let size = 1; size <= n; size++) {
    for (let mask = 1; mask < 1 << n; mask++) {
      if (bitCount(mask) !== size) continue;
      const evict = cargo.filter((_, i) => mask & (1 << i));
      const kept = removeCargo(cargo, evict)!;
      if (!hasRoomFor(kept, [piece])) continue;
      const key = [...evict].sort().join('+');
      if (seen.has(key)) continue;
      if (out.some((o) => o.every((p) => evict.includes(p)) && o.length < evict.length)) continue;
      seen.add(key);
      out.push(evict);
    }
  }
  return out;
}

function bitCount(n: number): number {
  let c = 0;
  for (let x = n; x; x >>= 1) c += x & 1;
  return c;
}
