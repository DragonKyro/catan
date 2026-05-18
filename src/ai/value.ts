import type {
  GameState,
  PlayerId,
  Resource,
  Terrain,
  VertexId,
  ResourceBank,
  Player,
} from '@/game/types';
import { RESOURCES } from '@/game/types';
import { getPortAtVertex } from '@/game/board/adjacency';

// Resource weights tuned for typical Catan economy. Ore/wheat slightly
// scarce; sheep slightly abundant.
export const RESOURCE_WEIGHT: Record<Resource, number> = {
  ore: 1.3,
  wheat: 1.3,
  brick: 1.1,
  wood: 1.1,
  sheep: 0.9,
};

export function probabilityDots(token: number | null): number {
  if (token === null) return 0;
  return 6 - Math.abs(7 - token);
}

export function terrainWeight(t: Terrain): number {
  if (t === 'desert' || t === 'sea') return 0;
  // Gold hexes pay any resource on roll — the player chooses, so they
  // function as a "best available" resource each tick. Weight above the
  // strongest single-resource value (ore/wheat at 1.3) to reflect that
  // choice, not the average (averaging undervalues optionality).
  if (t === 'gold') return 1.6;
  return RESOURCE_WEIGHT[t];
}

// Total value of a hand based on resource weights.
export function handValue(player: Player): number {
  let v = 0;
  for (const r of RESOURCES) v += player.resources[r] * RESOURCE_WEIGHT[r];
  return v;
}

export function partialValue(bank: Partial<ResourceBank>): number {
  let v = 0;
  for (const r of RESOURCES) v += (bank[r] ?? 0) * RESOURCE_WEIGHT[r];
  return v;
}

// Pips-per-resource production for a player, considering their settlements
// (×1) and cities (×2). Useful for "what am I starving for?".
export function pipsByResource(state: GameState, playerId: PlayerId): Record<Resource, number> {
  const out: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return out;
  const owned = new Map<VertexId, number>();
  for (const v of player.settlements) owned.set(v, 1);
  for (const v of player.cities) owned.set(v, 2);
  for (const [vid, mult] of owned) {
    const vertex = state.board.vertices[vid];
    if (!vertex) continue;
    for (const hexId of vertex.hexes) {
      const hex = state.board.hexes[hexId]!;
      if (hex.terrain === 'desert') continue;
      const pips = probabilityDots(hex.numberToken);
      out[hex.terrain as Resource] += pips * mult;
    }
  }
  return out;
}

// Per-resource bonus when this vertex would give us a resource we
// currently produce ZERO of. Encodes the standard setup heuristics:
//   - "No wheat = defeat" — without wheat you can't build settlements
//     or cities. Massive bonus.
//   - "No ore = 7-VP ceiling" — without ore you can't build cities
//     (capped at 5 settles + LR = 7 VP). Big bonus.
//   - Wood and brick are equally needed (1 each for road and settle),
//     so missing either hurts expansion equally.
//   - Sheep is the most replaceable (used in settles and dev cards but
//     never load-bearing), so the smallest bonus.
const MISSING_RESOURCE_BONUS: Record<Resource, number> = {
  wheat: 3.5,
  ore: 2.8,
  wood: 1.8,
  brick: 1.8,
  sheep: 1.0,
};

// Score a vertex as a candidate placement spot for the given player.
// Higher is better. Considers pips per resource, diversity, ports, and
// avoids redundancy with the player's existing production.
export function vertexScore(
  state: GameState,
  vertexId: VertexId,
  playerId: PlayerId,
): number {
  const vertex = state.board.vertices[vertexId];
  if (!vertex) return -Infinity;

  const existing = pipsByResource(state, playerId);
  let totalPips = 0;
  let resources = new Set<Resource>();
  let shoreline = 0;
  let missingBonus = 0;

  for (const hexId of vertex.hexes) {
    const hex = state.board.hexes[hexId]!;
    if (hex.terrain === 'desert') {
      shoreline += 0.5;
      continue;
    }
    if (hex.terrain === 'sea') {
      shoreline += 1;
      continue;
    }
    const pips = probabilityDots(hex.numberToken);
    // Gold pays the player's choice on roll. Bump it further with a small
    // flat bonus on top of pips*weight because the optionality also smooths
    // out cards-stuck-without-the-right-resource scenarios.
    if (hex.terrain === 'gold') {
      totalPips += pips * terrainWeight('gold') + 1.0;
      continue;
    }
    const weight = RESOURCE_WEIGHT[hex.terrain as Resource];
    // Diminishing returns: pips count less if we already have this resource.
    const existingPips = existing[hex.terrain as Resource];
    const diminish = 1 / (1 + existingPips * 0.15);
    totalPips += pips * weight * diminish;
    resources.add(hex.terrain as Resource);
    // Plug-the-gap bonus: if we currently produce 0 of this resource AND
    // this hex actually pays out (token isn't null / desert), reward
    // picking it up. Scaled by the per-resource importance and tempered
    // by pips so a 2/12 plug counts less than a 6/8 plug.
    if (existingPips === 0 && hex.numberToken !== null) {
      const r = hex.terrain as Resource;
      missingBonus += MISSING_RESOURCE_BONUS[r] * (pips / 5);
    }
  }
  // Coastal penalty (fewer adjacent hexes than 3)
  shoreline += Math.max(0, 3 - vertex.hexes.length) * 1.5;

  // Diversity bonus
  const diversityBonus = resources.size * 0.8;

  // Port bonus — ports are quite valuable (2:1 = halves the cost of trading
  // for that resource; 3:1 = 25% better than the default 4:1). Previous
  // weights undervalued them; bumped here based on play feedback.
  // - generic 3:1: useful for everyone, broadly applicable.
  // - specific 2:1, this vertex produces the resource: immediately useful,
  //   you'll have surplus to trade away here.
  // - specific 2:1, you produce it elsewhere: still strong, connects your
  //   surplus to a cheap conversion.
  // - specific 2:1, you don't produce it at all: latent value (future
  //   expansion / monopoly soak / opportunistic acceptance).
  const port = getPortAtVertex(state.board, vertexId);
  let portBonus = 0;
  if (port === 'generic') {
    portBonus = 1.5;
  } else if (port) {
    if (resources.has(port)) portBonus = 3.5;
    else if (existing[port] > 0) portBonus = 2.5;
    else portBonus = 1.2;
  }

  // Seafarers: bonus for settling on an outer island whose chip is still
  // unclaimed. Worth `chip.vp` VP at game end; scale by ~3 so it competes
  // with strong missing-resource bonuses. Already-claimed chips don't apply
  // (and our own claimed chips don't double-count — we already have that VP).
  let chipBonus = 0;
  if (state.islandChips && state.board.islandOfHex) {
    const islandIds = new Set<string>();
    for (const hexId of vertex.hexes) {
      const id = state.board.islandOfHex[hexId];
      if (id) islandIds.add(id);
    }
    for (const chip of state.islandChips) {
      if (chip.firstSettler !== null) continue;
      if (islandIds.has(chip.islandId)) chipBonus += chip.vp * 3;
    }
  }

  // Forgotten Tribe: bonus per unclaimed adjacent tribe token. Scaled by
  // type — VP tokens use the same chip multiplier (× 3), commercial harbor
  // is a long-term 2:1 trade rate worth a strong port, dev card is a single
  // ~0.3 VP grant.
  let tribeBonus = 0;
  if (state.tribeTokens) {
    const hexSet = new Set(vertex.hexes);
    for (const t of state.tribeTokens) {
      if (t.claimedBy !== null) continue;
      if (!hexSet.has(t.hexId)) continue;
      if (t.type === 'victoryPoint') tribeBonus += 3.0;
      else if (t.type === 'commercialHarbor') tribeBonus += 2.5;
      else tribeBonus += 1.5; // devCard
    }
  }

  // Fog Island: small bonus per adjacent unrevealed fog hex. Reveal grants
  // +1 of the underlying resource (or a gold pick / nothing for desert), so
  // this is a one-shot ~1 weight. We don't know the terrain underneath yet —
  // the rulebook keeps it hidden — so use the average resource weight as a
  // proxy. Don't double-add the underlying terrain's production bonus; that
  // path is already counted by the hex loop above.
  let fogBonus = 0;
  if (state.unrevealedFogHexes && state.unrevealedFogHexes.length > 0) {
    const fog = new Set(state.unrevealedFogHexes);
    for (const hexId of vertex.hexes) {
      if (fog.has(hexId)) fogBonus += 1.0;
    }
  }

  // Cloth for Catan: cloth-producing hexes pay 1 cloth per settle / 2 per
  // city on roll, and 2 cloth = 1 VP. Treat as a direct VP source: pips ×
  // 0.5 (VP per cloth) × ~1.4 settle-multiplier ≈ 0.7 × pips. Already-
  // counted production from the underlying terrain is REPLACED by cloth,
  // so subtract the resource contribution we added in the hex loop above
  // to avoid double-paying.
  let clothBonus = 0;
  if (state.clothHexes && state.clothHexes.length > 0) {
    const cloth = new Set(state.clothHexes);
    for (const hexId of vertex.hexes) {
      if (!cloth.has(hexId)) continue;
      const hex = state.board.hexes[hexId]!;
      const pips = probabilityDots(hex.numberToken);
      // Strip the resource-production value the loop already added.
      if (hex.terrain !== 'desert' && hex.terrain !== 'sea') {
        const w = hex.terrain === 'gold' ? terrainWeight('gold') : RESOURCE_WEIGHT[hex.terrain as Resource];
        clothBonus -= pips * w;
      }
      // Cloth payoff: pips × ~0.7 (see above). Add a flat +1.5 because cloth
      // VP doesn't compete for board placement like settlements/cities do
      // and stacks across cities, mirroring the chip-VP bias.
      clothBonus += pips * 0.7 + 1.5;
    }
  }

  // Volcano scenario: heavy penalty for touching the volcano hex. The
  // engine already forbids it in setup, but the AI still scores main-game
  // placements (e.g. roads toward an open vertex); a strong negative keeps
  // it from racing into the eruption zone.
  let volcanoPenalty = 0;
  if (state.board.volcanoHex && vertex.hexes.includes(state.board.volcanoHex)) {
    volcanoPenalty = 3.5;
  }

  return (
    totalPips +
    diversityBonus +
    portBonus +
    missingBonus +
    chipBonus +
    tribeBonus +
    fogBonus +
    clothBonus -
    shoreline -
    volcanoPenalty
  );
}

// "What does this player need most?" — returns weighted shortfall to the
// nearest viable build target. Used to drive trades and dev-card priorities.
export interface NeedReport {
  // 1 = severe shortfall, 0 = none.
  byResource: Record<Resource, number>;
  // Suggested goal: 'city' | 'settlement' | 'road' | 'devCard' | 'none'
  goal: 'city' | 'settlement' | 'road' | 'devCard' | 'none';
}

export function reportNeeds(state: GameState, playerId: PlayerId): NeedReport {
  const player = state.players.find((p) => p.id === playerId)!;
  const r = player.resources;
  const byResource: Record<Resource, number> = {
    wood: 0,
    brick: 0,
    sheep: 0,
    wheat: 0,
    ore: 0,
  };

  // Pick the goal we're closest to / would benefit from most
  let goal: NeedReport['goal'] = 'none';

  // City: 2W 3O — high priority if we have settlements
  if (player.settlements.length > 0) {
    const wheatShort = Math.max(0, 2 - r.wheat);
    const oreShort = Math.max(0, 3 - r.ore);
    if (wheatShort + oreShort <= 3) {
      goal = 'city';
      byResource.wheat = Math.max(byResource.wheat, wheatShort);
      byResource.ore = Math.max(byResource.ore, oreShort);
    }
  }

  // Settlement: 1W 1B 1Sh 1Wh
  if (goal === 'none') {
    const woodShort = Math.max(0, 1 - r.wood);
    const brickShort = Math.max(0, 1 - r.brick);
    const sheepShort = Math.max(0, 1 - r.sheep);
    const wheatShort = Math.max(0, 1 - r.wheat);
    const total = woodShort + brickShort + sheepShort + wheatShort;
    if (total <= 2) {
      goal = 'settlement';
      byResource.wood = Math.max(byResource.wood, woodShort);
      byResource.brick = Math.max(byResource.brick, brickShort);
      byResource.sheep = Math.max(byResource.sheep, sheepShort);
      byResource.wheat = Math.max(byResource.wheat, wheatShort);
    }
  }

  if (goal === 'none') {
    // Dev card: 1Sh 1Wh 1O
    const sheepShort = Math.max(0, 1 - r.sheep);
    const wheatShort = Math.max(0, 1 - r.wheat);
    const oreShort = Math.max(0, 1 - r.ore);
    if (sheepShort + wheatShort + oreShort <= 1) {
      goal = 'devCard';
      byResource.sheep = Math.max(byResource.sheep, sheepShort);
      byResource.wheat = Math.max(byResource.wheat, wheatShort);
      byResource.ore = Math.max(byResource.ore, oreShort);
    }
  }

  if (goal === 'none') {
    // Road: 1W 1B
    const woodShort = Math.max(0, 1 - r.wood);
    const brickShort = Math.max(0, 1 - r.brick);
    if (woodShort + brickShort <= 1) {
      goal = 'road';
      byResource.wood = Math.max(byResource.wood, woodShort);
      byResource.brick = Math.max(byResource.brick, brickShort);
    }
  }

  return { byResource, goal };
}
