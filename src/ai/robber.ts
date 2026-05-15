import type { GameState, PlayerId, HexId, Resource } from '@/game/types';
import { probabilityDots } from './value';
import { totalResources } from '@/game/resources';
import { assessThreats, type PlayerThreat } from './threats';

export interface RobberChoice {
  hex: HexId;
  stealFrom: PlayerId | null;
}

// Multipliers stacked onto a hex's score when it produces for a
// threatening opponent. Higher = more aggressive blocking.
const THREAT_HEX_MULT = 3.0; // base bump when hex feeds any threat
const WIN_THREAT_BONUS = 4.0; // additional bump if a win-threat is on this hex
const RACE_MATCH_BONUS = 2.5; // hex's resource matches the bonus they're racing for

export function chooseRobberMove(state: GameState, playerId: PlayerId): RobberChoice {
  const threats = assessThreats(state);
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
            score += baseDamage * threatMult;
          }
        }
      }
    }
    if (touchesOwn) score -= 50; // strongly prefer not to hurt ourselves
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
    threat.closeToLongestRoad
  ) {
    mult *= THREAT_HEX_MULT;
  }
  if (threat.closeToWin) mult += WIN_THREAT_BONUS;
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
  // Score: closeToWin >> closeToLA/LR >> largest hand.
  let bestTarget = candidates[0]!;
  let bestScore = -Infinity;
  for (const pid of candidates) {
    const p = state.players.find((x) => x.id === pid)!;
    const t = threats[pid];
    const hand = totalResources(p.resources);
    let s = hand;
    if (t?.closeToWin) s += 100;
    else if (t?.closeToLargestArmy || t?.closeToLongestRoad) s += 30;
    if (s > bestScore) {
      bestScore = s;
      bestTarget = pid;
    }
  }
  return bestTarget;
}
