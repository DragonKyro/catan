import type { GameState, PlayerId, Player } from '../../../types';
import {
  POOR_CATANIAN_VP,
  WEALTHIEST_CATANIAN_VP,
} from '../constants';

// Recalculate Wealthiest / Poor Catanian holders from the current per-player
// gold totals. Wealthiest = unique max-gold player with ≥ 1 gold (ties leave
// it null — rulebook: "If there is a tie, the Wealthiest Catanian tile
// remains next to the supply"). Poor = every player tied at the min gold
// count. Multiple Poor holders are explicitly allowed by the rulebook.
//
// Structural input — only reads `players` — so the createGame seed path
// can call this before the full GameState is assembled.
export function recalcWealthTiles(input: {
  players: Pick<Player, 'id' | 'gold'>[];
}): {
  wealthiest: PlayerId | null;
  poor: PlayerId[];
} {
  if (input.players.length === 0) return { wealthiest: null, poor: [] };

  const golds = input.players.map((p) => ({ id: p.id, gold: p.gold ?? 0 }));
  let maxGold = -Infinity;
  let minGold = Infinity;
  for (const g of golds) {
    if (g.gold > maxGold) maxGold = g.gold;
    if (g.gold < minGold) minGold = g.gold;
  }

  // Wealthiest only awards when someone has positive gold AND they are
  // strictly above everyone else.
  let wealthiest: PlayerId | null = null;
  if (maxGold > 0) {
    const tied = golds.filter((g) => g.gold === maxGold);
    if (tied.length === 1) wealthiest = tied[0]!.id;
  }

  // Poor: everyone tied at the lowest gold count. When max === min (all
  // players equal), the rulebook gives Poor to nobody (there is no "least"
  // — they're all even). Encoding that as "max > min" gates the case.
  const poor: PlayerId[] = maxGold > minGold
    ? golds.filter((g) => g.gold === minGold).map((g) => g.id)
    : [];

  return { wealthiest, poor };
}

// VP swing from wealth tiles for a single player. Positive for Wealthiest
// holder, negative for Poor holders.
export function calculateWealthTilesVp(
  state: GameState,
  playerId: PlayerId,
): number {
  if (!state.wealthTiles) return 0;
  let vp = 0;
  if (state.wealthTiles.wealthiest === playerId) vp += WEALTHIEST_CATANIAN_VP;
  if (state.wealthTiles.poor.includes(playerId)) vp += POOR_CATANIAN_VP;
  return vp;
}
