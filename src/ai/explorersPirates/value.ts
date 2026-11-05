import type { EpMission, GameState, HexId, PlayerId, Resource, VertexId } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { hexPips } from '@/game/board/hexNumbers';
import {
  EP_BONUS_TILE_VP,
  EP_LAIR_CREWS,
} from '@/game/modules/explorersPirates/constants';
import {
  bonusTileHolder,
  epSupply,
  isExploredSea,
  isUnexplored,
  trackLength,
  trackPosition,
  trackVp,
} from '@/game/modules/explorersPirates/state';

// Valuations for the Explorers & Pirates AI. Units are roughly "resource
// cards": a VP is worth VP_UNITS, a gold half a card. Nothing here reads
// what lies under a face-down hex (`explorersPirates.hidden`), the disc
// stacks, the lair tokens or an uncaptured lair's number.

export const VP_UNITS = 6;
export const GOLD_UNITS = 0.5;

// Card weights for this expansion's build menu: wheat + ore for harbor
// settlements, sheep in ships / crews / settlers / boosts, wood in ships,
// settlers and roads.
export const EP_WEIGHT: Record<Resource, number> = {
  wheat: 1.25,
  ore: 1.2,
  sheep: 1.15,
  wood: 1.1,
  brick: 1.0,
};

// A captured gold field pays 2 gold per building: about one card.
const GOLD_FIELD_WEIGHT = 1.0;

const MISSING_BONUS: Record<Resource, number> = {
  wheat: 2.0,
  ore: 1.8,
  sheep: 1.4,
  wood: 1.4,
  brick: 1.0,
};

// Production per resource (pips) of a player's buildings on explored hexes.
export function epPips(state: GameState, pid: PlayerId): Record<Resource, number> {
  const out: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  const p = state.players.find((x) => x.id === pid);
  if (!p) return out;
  for (const v of p.settlements) {
    for (const h of state.board.vertices[v]?.hexes ?? []) {
      const hex = state.board.hexes[h]!;
      if (isUnexplored(state, h)) continue;
      if (!(RESOURCES as readonly string[]).includes(hex.terrain)) continue;
      out[hex.terrain as Resource] += hexPips(hex);
    }
  }
  return out;
}

// Production value of a building on `vertexId` for `pid`: pips × card
// weight (diminishing for resources we already produce), a bonus for
// filling a gap, diversity, and a coastal bonus (it can become a harbor
// settlement, a base for ships). Only face-up information is used.
export function epVertexValue(state: GameState, vertexId: VertexId, pid: PlayerId): number {
  const v = state.board.vertices[vertexId];
  if (!v) return -Infinity;
  const have = epPips(state, pid);
  let value = 0;
  const kinds = new Set<string>();
  let coastal = false;
  for (const h of v.hexes) {
    if (isUnexplored(state, h)) continue;
    const hex = state.board.hexes[h]!;
    if (isExploredSea(state, h)) {
      coastal = true;
      continue;
    }
    const pips = hexPips(hex);
    if (pips === 0) continue;
    if (hex.terrain === 'gold') {
      value += pips * GOLD_FIELD_WEIGHT;
      kinds.add('gold');
      continue;
    }
    if (!(RESOURCES as readonly string[]).includes(hex.terrain)) continue;
    const r = hex.terrain as Resource;
    value += (pips * EP_WEIGHT[r]) / (1 + have[r] * 0.12);
    if (have[r] === 0) value += MISSING_BONUS[r] * (pips / 5);
    kinds.add(r);
  }
  value += kinds.size * 0.6;
  if (coastal && epSupply(state, pid).harbors > 0) value += 1.5;
  return value;
}

// ----- Face-down hexes (public pool composition only) -----

// Each region's 16 face-down tiles (Rulebook p. 3): 6 land, 1 sea, 3 gold
// fields, 3 fish shoals, 3 spice farms. What's been turned over is public,
// so the rest of the pool is known in aggregate — never per hex.
const REGION_POOL = { land: 6, sea: 1, gold: 3, shoal: 3, spice: 3 } as const;
type PoolKind = keyof typeof REGION_POOL;

export function remainingPool(state: GameState, hexId: HexId): Record<PoolKind, number> {
  const ep = state.explorersPirates!;
  const region = ep.regionOf[hexId];
  const left: Record<PoolKind, number> = { ...REGION_POOL };
  if (!region) return left;
  for (const [h, reg] of Object.entries(ep.regionOf)) {
    if (reg !== region || isUnexplored(state, h)) continue;
    const t = state.board.hexes[h]!.terrain;
    let kind: PoolKind;
    if (t === 'gold') kind = 'gold';
    else if (t === 'spice') kind = 'spice';
    else if (t === 'sea') kind = ep.shoals.some((s) => s.hex === h) ? 'shoal' : 'sea';
    else kind = 'land';
    left[kind] = Math.max(0, left[kind] - 1);
  }
  return left;
}

// Expected worth of turning `hexId` over: the explorer's reward (1 card on
// land, else 2 gold) plus what it opens up (land to settle, lairs, farms,
// shoals).
export function exploreValue(state: GameState, hexId: HexId): number {
  const left = remainingPool(state, hexId);
  const total = left.land + left.sea + left.gold + left.shoal + left.spice;
  if (total === 0) return 1;
  const pLand = left.land / total;
  const reward = pLand * 1.1 + (1 - pLand) * 2 * GOLD_UNITS;
  const info =
    (left.land * 3.0 + left.gold * 3.5 + left.spice * 4.0 + left.shoal * 2.5 + left.sea * 1.0) / total;
  return reward + info;
}

// ----- Missions -----

// VP change for `pid` if their marker on `mission` moved `steps` spaces
// (the track's VP and its bonus tile; a later arrival on a tie doesn't take
// the tile).
export function trackGainVp(state: GameState, pid: PlayerId, mission: EpMission, steps: number): number {
  const from = trackPosition(state, mission, pid);
  const to = Math.min(trackLength(mission), from + steps);
  if (to === from) return 0;
  let gain = trackVp(mission, to) - trackVp(mission, from);
  const holder = bonusTileHolder(state, mission);
  if (holder !== pid) {
    const best = Math.max(0, ...state.playerOrder.filter((p) => p !== pid).map((p) => trackPosition(state, mission, p)));
    if (to > best) gain += EP_BONUS_TILE_VP;
  }
  return gain;
}

// Worth of one more space on a mission track: the VP it brings now plus a
// share for setting up the next VP step.
export function trackStepValue(state: GameState, pid: PlayerId, mission: EpMission, steps = 1): number {
  const pos = trackPosition(state, mission, pid);
  const room = trackLength(mission) - pos;
  if (room <= 0) return 0;
  const n = Math.min(steps, room);
  const now = trackGainVp(state, pid, mission, n);
  // A space that scores nothing yet still sets up the next VP step: count
  // the track's average VP per remaining space.
  const avg = (trackVp(mission, trackLength(mission)) - trackVp(mission, pos)) / room;
  return VP_UNITS * Math.max(now, 0.5 * now + avg * n) + 1.2 * n;
}

// Uncaptured lairs on the board (face up) and how many crews each still
// needs to be captured.
export function openLairs(state: GameState): Array<{ hex: HexId; needed: number }> {
  const ep = state.explorersPirates;
  if (!ep) return [];
  return ep.lairs.filter((l) => !l.captured).map((l) => ({ hex: l.hex, needed: EP_LAIR_CREWS - l.crews.length }));
}

// Spice farms on the board without our crew.
export function farmsWithoutCrew(state: GameState, pid: PlayerId): HexId[] {
  return state.explorersPirates?.farms.filter((f) => !f.crews.includes(pid)).map((f) => f.hex) ?? [];
}

// Value of a spice farm's advantage for us.
export function farmAbilityValue(state: GameState, hexId: HexId): number {
  const farm = state.explorersPirates?.farms.find((f) => f.hex === hexId);
  if (!farm) return 0;
  if (farm.ability === 'swiftVoyage') return 3.0;
  if (farm.ability === 'fastGold') return 2.0;
  return 1.6;
}

// Crews worth having on ships / harbors right now: one per farm without our
// crew, and enough to finish (or join) the open lairs.
export function crewDemand(state: GameState, pid: PlayerId): number {
  let n = farmsWithoutCrew(state, pid).length;
  for (const l of openLairs(state)) n += Math.min(2, l.needed);
  return n;
}
