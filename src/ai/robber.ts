import type { GameState, PlayerId, HexId, Resource } from '@/game/types';
import { probabilityDots } from './value';
import { totalResources } from '@/game/resources';
import { assessThreats, isRival, type PlayerThreat } from './threats';

export interface RobberChoice {
  hex: HexId;
  stealFrom: PlayerId | null;
}

// Multipliers stacked onto a hex's score when it produces for a
// threatening opponent. Higher = more aggressive blocking.
const THREAT_HEX_MULT = 3.0; // base bump when hex feeds any threat
const WIN_THREAT_BONUS = 4.0; // additional bump if a win-threat is on this hex
const LEADER_BONUS = 2.0; // additional bump if a runaway leader is on this hex
const RACE_MATCH_BONUS = 2.5; // hex's resource matches the bonus they're racing for
// Bonus applied to total hex score when it hits 2+ opponents. Multi-target
// hexes are strictly better than single-target ones at equal damage —
// every opponent we slow makes our path cheaper.
const MULTI_PLAYER_BONUS_PER_EXTRA = 1.4;
// Bonus when the hex produces the *only* (or near-only) source of a
// particular resource for an opponent — choking off a resource hurts
// more than tapping a redundant feed.
const SCARCITY_HEX_BONUS = 1.6;
// Pip threshold below which a hex counts as "high-number" (8/6 = 5 pips,
// 9/5 = 4 pips). Used as a tiebreaker bump so the AI prefers to park on
// 6/8 over 4/10 when both feed similar threats.
const HIGH_NUMBER_PIPS = 4;
const HIGH_NUMBER_BONUS = 2.0;

export function chooseRobberMove(state: GameState, playerId: PlayerId): RobberChoice {
  const threats = assessThreats(state);
  // Pre-compute every player's pip totals by resource so we can spot
  // hexes that are an opponent's only source of a given resource.
  const pipsByResourceByPlayer = computePipsByResourceByPlayer(state);
  let bestHex: HexId | null = null;
  let bestScore = -Infinity;
  let bestStealTarget: PlayerId | null = null;
  for (const hexId of state.board.hexIds) {
    if (hexId === state.board.robberHex) continue;
    const hex = state.board.hexes[hexId]!;
    if (hex.terrain === 'desert') {
      // Robber on desert produces nothing; only useful if forced
    }
    const pips = probabilityDots(hex.numberToken);
    const hexResource = hex.terrain as Resource;
    let score = 0;
    let touchesOwn = false;
    // Per-player damage scoring on this hex. We also track the best
    // single-player threat-target so we know who to steal from.
    const playersOnHex = new Set<PlayerId>();
    for (const v of Object.values(state.board.vertices)) {
      if (!v.hexes.includes(hexId)) continue;
      for (const p of state.players) {
        if (p.settlements.includes(v.id) || p.cities.includes(v.id)) {
          if (p.id === playerId) {
            touchesOwn = true;
          } else {
            playersOnHex.add(p.id);
            const mult = p.cities.includes(v.id) ? 2 : 1;
            const baseDamage = mult * pips * (1 + totalResources(p.resources) * 0.1);
            const threat = threats[p.id];
            const threatMult = threatMultiplierFor(threat, hexResource);
            // Scarcity: if this hex is one of the player's only sources
            // of `hexResource`, blocking it pinches their economy harder.
            const totalPipsForRes =
              pipsByResourceByPlayer[p.id]?.[hexResource] ?? 0;
            const hexPipsHere = mult * pips;
            const scarcityFactor =
              totalPipsForRes > 0 && hexPipsHere / totalPipsForRes >= 0.5
                ? SCARCITY_HEX_BONUS
                : 1.0;
            score += baseDamage * threatMult * scarcityFactor;
          }
        }
      }
    }
    if (touchesOwn) score -= 50; // strongly prefer not to hurt ourselves
    // Multi-player bonus: hitting 2+ opponents at once is strictly better
    // than hitting 1, especially in 4-6p games where 7s come around less
    // often per-player.
    if (playersOnHex.size > 1) {
      score += (playersOnHex.size - 1) * MULTI_PLAYER_BONUS_PER_EXTRA *
        Math.max(1, pips);
    }
    // High-number tiebreaker: a 6 or 8 produces 1.5x as often as a 5 or 9,
    // so a 6/8 robber-block costs the opponent more expected resources.
    if (pips >= HIGH_NUMBER_PIPS && playersOnHex.size > 0) {
      score += HIGH_NUMBER_BONUS;
    }
    if (score > bestScore) {
      bestScore = score;
      bestHex = hexId;
      // Pre-compute the threat-weighted steal target while we're here:
      // prefer the largest threat on this hex, falling back to largest hand.
      bestStealTarget = pickStealTarget(state, playerId, hexId, threats);
    }
  }
  if (!bestHex) {
    // Pick the first non-current hex as fallback
    bestHex = state.board.hexIds.find((h) => h !== state.board.robberHex)!;
    bestStealTarget = pickStealTarget(state, playerId, bestHex, threats);
  }
  return { hex: bestHex, stealFrom: bestStealTarget };
}

// Per-player resource production map (in pips). Mirrors pipsByResource
// from value.ts but over all players in one pass — used to spot hexes
// that are a major / sole source of a given resource for an opponent.
function computePipsByResourceByPlayer(
  state: GameState,
): Record<PlayerId, Partial<Record<Resource, number>>> {
  const out: Record<PlayerId, Partial<Record<Resource, number>>> = {};
  for (const p of state.players) out[p.id] = {};
  for (const hexId of state.board.hexIds) {
    const hex = state.board.hexes[hexId]!;
    if (hex.numberToken === undefined) continue;
    const pips = probabilityDots(hex.numberToken);
    if (pips === 0) continue;
    const res = hex.terrain;
    if (res === 'desert' || res === 'sea') continue;
    for (const v of Object.values(state.board.vertices)) {
      if (!v.hexes.includes(hexId)) continue;
      for (const p of state.players) {
        const mult = p.cities.includes(v.id)
          ? 2
          : p.settlements.includes(v.id)
            ? 1
            : 0;
        if (mult === 0) continue;
        const cur = out[p.id]![res as Resource] ?? 0;
        out[p.id]![res as Resource] = cur + pips * mult;
      }
    }
  }
  return out;
}

// Multiplier applied to a hex's damage score based on the producing player's
// threat profile. Returns 1.0 (no bump) for non-threats; higher for threats.
function threatMultiplierFor(
  threat: PlayerThreat | undefined,
  hexResource: Resource,
): number {
  if (!threat) return 1.0;
  let mult = 1.0;
  if (
    threat.closeToWin ||
    threat.closeToLargestArmy ||
    threat.closeToLongestRoad ||
    threat.isLeader
  ) {
    mult *= THREAT_HEX_MULT;
  }
  if (threat.closeToWin) mult += WIN_THREAT_BONUS;
  // Runaway leader (not yet on the brink): smaller bump than win-threats
  // but still meaningfully more than a non-leader.
  if (threat.isLeader && !threat.closeToWin) mult += LEADER_BONUS;
  // Resource-specific: if this hex produces a resource directly relevant to
  // the bonus they're racing for, bump again.
  if (threat.dangerousResources.has(hexResource)) {
    mult += RACE_MATCH_BONUS;
  }
  return mult;
}

function pickStealTarget(
  state: GameState,
  playerId: PlayerId,
  hexId: HexId,
  threats: Record<PlayerId, PlayerThreat>,
): PlayerId | null {
  const candidates: PlayerId[] = [];
  for (const v of Object.values(state.board.vertices)) {
    if (!v.hexes.includes(hexId)) continue;
    for (const p of state.players) {
      if (p.id === playerId) continue;
      if (totalResources(p.resources) === 0) continue;
      if (p.settlements.includes(v.id) || p.cities.includes(v.id)) {
        if (!candidates.includes(p.id)) candidates.push(p.id);
      }
    }
  }
  if (candidates.length === 0) return null;
  // Score: closeToWin >> direct rival of ours >> closeToLA/LR >> largest hand.
  // Direct rival = head-to-head with us in the LA or LR race. Stealing
  // from a rival both slows them down AND blunts the resource we'd most
  // hate them spending.
  let bestTarget = candidates[0]!;
  let bestScore = -Infinity;
  for (const pid of candidates) {
    const p = state.players.find((x) => x.id === pid)!;
    const t = threats[pid];
    const hand = totalResources(p.resources);
    let s = hand;
    if (t?.closeToWin) s += 100;
    else if (isRival(state, playerId, pid)) s += 50;
    else if (t?.closeToLargestArmy || t?.closeToLongestRoad) s += 30;
    if (s > bestScore) {
      bestScore = s;
      bestTarget = pid;
    }
  }
  return bestTarget;
}
