import type {
  Commodity,
  GameState,
  ImprovementTrack,
  PlayerId,
} from '../../../types';
import { TRACK_COMMODITY } from '../../../types';
import { LEVEL3_ABILITY_THRESHOLD } from '../constants';

// Improvement cost: rulebook p.8 — to move TO level N, pay N commodities of
// the matching type. So levels 1..5 cost 1,2,3,4,5 commodity each. The
// Crane card subtracts 1 (to a floor of 0).
export function improvementCost(
  _track: ImprovementTrack,
  levelTo: number,
  craneActive = false,
): { commodity: Commodity; amount: number } {
  const commodity = TRACK_COMMODITY[_track];
  const amount = Math.max(0, levelTo - (craneActive ? 1 : 0));
  return { commodity, amount };
}

// Has this player unlocked the level-3 ability for the given track?
export function hasLevel3Ability(
  state: GameState,
  playerId: PlayerId,
  track: ImprovementTrack,
): boolean {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return false;
  return (p.improvements?.[track] ?? 0) >= LEVEL3_ABILITY_THRESHOLD;
}

// True if this player has science >= 3 — they're entitled to the Aqueduct
// free-resource pick whenever production gives them nothing.
export function aqueductActive(state: GameState, playerId: PlayerId): boolean {
  return hasLevel3Ability(state, playerId, 'science');
}

// True if this player has trade >= 3 — they trade commodities 2:1 with the
// bank.
export function merchantGuildActive(
  state: GameState,
  playerId: PlayerId,
): boolean {
  return hasLevel3Ability(state, playerId, 'trade');
}

// Returns the metropolis-track this player currently owns (if any).
export function metropolisesOwnedBy(
  state: GameState,
  playerId: PlayerId,
): ImprovementTrack[] {
  const out: ImprovementTrack[] = [];
  for (const track of ['science', 'trade', 'politics'] as ImprovementTrack[]) {
    if (state.metropolises?.[track]?.playerId === playerId) out.push(track);
  }
  return out;
}

// Count of metropolises (any owner) currently on the board. Drives barbarian
// strength alongside cities.
export function metropolisCount(state: GameState): number {
  let n = 0;
  for (const track of ['science', 'trade', 'politics'] as ImprovementTrack[]) {
    if (state.metropolises?.[track]) n++;
  }
  return n;
}

// True if `vertex` hosts a metropolis (any track). Pillaging is forbidden
// on metropolis cities.
export function vertexHasMetropolis(
  state: GameState,
  vertex: string,
): boolean {
  for (const track of ['science', 'trade', 'politics'] as ImprovementTrack[]) {
    if (state.metropolises?.[track]?.vertex === vertex) return true;
  }
  return false;
}
