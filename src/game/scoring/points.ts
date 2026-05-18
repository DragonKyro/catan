import type { GameState, PlayerId } from '../types';
import { calculateWealthTilesVp } from '../modules/traders/scoring/wealthTiles';
import { calculateStrongestPortsVp } from '../modules/traders/scoring/strongestPorts';
import { calculateMerchantTrainsVp } from '../modules/traders/scoring/merchantTrains';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '../modules/citiesAndKnights/constants';

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

// Seafarers chip VP earned by a player (sum of every outer-island chip they
// were the first to settle). Returns 0 when no chips exist (base game).
export function calculateIslandChipVp(state: GameState, playerId: PlayerId): number {
  if (!state.islandChips) return 0;
  let sum = 0;
  for (const chip of state.islandChips) {
    if (chip.firstSettler === playerId) sum += chip.vp;
  }
  return sum;
}

// Forgotten Tribe: one VP per claimed VP-type tribe token. Visible bonus
// (not hidden like a VP dev card) — the chip is on the board for all to
// see, same as a Longest Road bonus.
export function calculateTribeTokenVp(state: GameState, playerId: PlayerId): number {
  if (!state.tribeTokens) return 0;
  let sum = 0;
  for (const token of state.tribeTokens) {
    if (token.claimedBy === playerId && token.type === 'victoryPoint') sum += 1;
  }
  return sum;
}

// Wonders of Catan: one VP per built level of any wonder this player is
// building. Visible. Completion (level === maxLevel) ALSO triggers an
// instant-win check in the buildWonder handler — this function just
// accounts for partial progress.
export function calculateWonderVp(state: GameState, playerId: PlayerId): number {
  if (!state.wonders) return 0;
  let sum = 0;
  for (const w of state.wonders) {
    if (w.builtBy === playerId) sum += w.level;
  }
  return sum;
}

// Pirate Islands: +2 VP for the player who landed the killing blow on the
// pirate fleet. Visible bonus (like Longest Road / Largest Army).
export function calculatePirateFleetVp(state: GameState, playerId: PlayerId): number {
  if (!state.pirateFleet) return 0;
  return state.pirateFleet.defeatedBy === playerId ? 2 : 0;
}

// Cloth for Catan: 1 VP per 2 cloth tokens (Math.floor). Visible — cloth
// tokens are public information.
export function calculateClothVp(state: GameState, playerId: PlayerId): number {
  const player = state.players.find((p) => p.id === playerId);
  if (!player || !player.cloth) return 0;
  return Math.floor(player.cloth / 2);
}

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
  // Seafarers: bonus VP from outer-island settlement chips.
  vp += calculateIslandChipVp(state, playerId);
  // Seafarers / Forgotten Tribe: visible VP tokens from settled tribe hexes.
  vp += calculateTribeTokenVp(state, playerId);
  // Seafarers / Wonders of Catan: 1 VP per built wonder level.
  vp += calculateWonderVp(state, playerId);
  // Seafarers / Pirate Islands: +2 for the player who defeated the fleet.
  vp += calculatePirateFleetVp(state, playerId);
  // Seafarers / Cloth for Catan: 1 VP per 2 cloth tokens.
  vp += calculateClothVp(state, playerId);
  // Traders & Barbarians / Rivers of Catan: Wealthiest (+1) and Poor (-2).
  vp += calculateWealthTilesVp(state, playerId);
  // Traders & Barbarians / Strongest Ports variant: +2 for the tile holder.
  vp += calculateStrongestPortsVp(state, playerId);
  // Traders & Barbarians / Merchant Trains: +1 per building between 2 wagons.
  vp += calculateMerchantTrainsVp(state, playerId);
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
