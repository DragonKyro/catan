import type { GameState, PlayerId } from '../types';
import { calculateWealthTilesVp } from '../modules/traders/scoring/wealthTiles';
import { calculateStrongestPortsVp } from '../modules/traders/scoring/strongestPorts';
import { calculateMerchantTrainsVp } from '../modules/traders/scoring/merchantTrains';
import { calculateBarbarianAttackVp } from '../modules/traders/barbarianAttack/scoring';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '../modules/citiesAndKnights/constants';
import { calculateIslandBonusVp } from '../modules/seafarers/islandBonus';
import { calculateTribeVp } from '../modules/seafarers/tribe';
import { calculateClothVp } from '../modules/seafarers/cloth';

// Cities & Knights — 2 VP per metropolis the player owns (1 each at level 4
// temporary, locked at level 5 permanent — either way it's still 2 VP).
export function calculateMetropolisVp(state: GameState, playerId: PlayerId): number {
  if (!state.metropolises) return 0;
  let sum = 0;
  for (const track of ['science', 'trade', 'politics'] as const) {
    if (state.metropolises[track]?.playerId === playerId) sum += 2;
  }
  return sum;
}

// 1 VP per Printing or Constitution card in the player's hand (auto-flipped
// face-up on draw).
export function calculateProgressCardVp(
  state: GameState,
  playerId: PlayerId,
): number {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p?.progressCards) return 0;
  let sum = 0;
  if (p.progressCards.science.includes('printing')) sum += 1;
  if (p.progressCards.politics.includes('constitution')) sum += 1;
  return sum;
  // Note: a player can only ever hold one of each VP card; the deck has
  // exactly one Printing and one Constitution.
  void state;
}

// 1 VP for the player who currently holds the merchant piece.
export function calculateMerchantVp(state: GameState, playerId: PlayerId): number {
  return state.merchant?.ownerId === playerId ? 1 : 0;
}

// 1 VP per Defender of Catan token (rulebook p.11).
export function calculateDefenderTokenVp(
  state: GameState,
  playerId: PlayerId,
): number {
  const p = state.players.find((pl) => pl.id === playerId);
  if (!p) return 0;
  void state;
  return p.defenderTokens ?? 0;
}

const LONGEST_ROAD_MIN_LENGTH = 5;

// Seafarers scenario VP (see the module files for the rules):
//   - island bonus: each player's first settlement on each island that
//     isn't one of their home islands (calculateIslandBonusVp);
//   - Forgotten Tribe VP tokens picked up by ships (calculateTribeVp);
//   - Cloth for Catan: 1 VP per pair of cloth tokens (calculateClothVp).
// Wonders of Catan levels and Pirate Islands fortresses carry no VP of their
// own — they're win conditions (a recaptured fortress simply becomes one of
// your settlements).
export { calculateIslandBonusVp } from '../modules/seafarers/islandBonus';
export { calculateTribeVp } from '../modules/seafarers/tribe';
export { calculateClothVp } from '../modules/seafarers/cloth';

// Total victory points for a player.
// `includeHidden` controls whether held VP dev cards are counted (true at
// win-check time and for the player themselves; false when displaying to
// opponents in the UI).
export function calculateVictoryPoints(
  state: GameState,
  playerId: PlayerId,
  includeHidden: boolean,
): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return 0;
  const ckActive = state.settings.expansions.includes(
    CITIES_AND_KNIGHTS_EXPANSION_ID,
  );
  let vp = 0;
  vp += player.settlements.length;
  vp += player.cities.length * 2;
  if (player.hasLongestRoad) vp += 2;
  // Largest Army is removed under C&K (rulebook p.3 "Return the development
  // cards and the Largest Army tile to the CATAN box").
  if (player.hasLargestArmy && !ckActive) vp += 2;
  if (includeHidden) vp += player.devCards.victoryPoints;
  if (ckActive) {
    vp += calculateMetropolisVp(state, playerId);
    vp += calculateProgressCardVp(state, playerId);
    vp += calculateMerchantVp(state, playerId);
    vp += calculateDefenderTokenVp(state, playerId);
  }
  // Seafarers: island bonuses, Forgotten Tribe VP tokens, cloth pairs.
  vp += calculateIslandBonusVp(state, playerId);
  vp += calculateTribeVp(state, playerId);
  vp += calculateClothVp(state, playerId);
  // Traders & Barbarians / Rivers of Catan: Wealthiest (+1) and Poor (-2).
  vp += calculateWealthTilesVp(state, playerId);
  // Traders & Barbarians / Strongest Ports variant: +2 for the tile holder.
  vp += calculateStrongestPortsVp(state, playerId);
  // Traders & Barbarians / Merchant Trains: +1 per building between 2 wagons.
  vp += calculateMerchantTrainsVp(state, playerId);
  // Traders & Barbarians / Barbarian Attack: 1 VP per 2 prisoners; conquered
  // buildings are worth nothing.
  vp += calculateBarbarianAttackVp(state, playerId);
  return vp;
}

// Determines the Longest Road holder: the player with the longest road of
// length >= 5. Ties: current holder keeps. If no one qualifies, no holder.
export function calculateLongestRoadHolder(
  state: GameState,
  lengths: Map<PlayerId, number>,
): { holder: PlayerId; length: number } | null {
  const current = state.longestRoad;
  let bestHolder: PlayerId | null = current?.holder ?? null;
  let bestLength = current?.length ?? LONGEST_ROAD_MIN_LENGTH - 1;

  // The current holder's length may have shrunk; recompute their entry.
  if (current) {
    const currentLen = lengths.get(current.holder) ?? 0;
    if (currentLen < LONGEST_ROAD_MIN_LENGTH) {
      bestHolder = null;
      bestLength = LONGEST_ROAD_MIN_LENGTH - 1;
    } else {
      bestLength = currentLen;
    }
  }

  for (const [pid, len] of lengths) {
    if (len < LONGEST_ROAD_MIN_LENGTH) continue;
    if (len > bestLength) {
      bestLength = len;
      bestHolder = pid;
    }
  }

  return bestHolder ? { holder: bestHolder, length: bestLength } : null;
}
