import type { GameState } from '@/game/types';
import {
  FISH_COST_BUILD_ROAD,
  FISH_COST_BUY_DEV_CARD,
  FISH_COST_REMOVE_ROBBER,
  FISH_COST_STEAL,
  FISH_COST_TAKE_FROM_BANK,
  GOLD_PER_RESOURCE,
  MAX_GOLD_SPENDS_PER_TURN,
} from '@/game/modules/traders/constants';

// Extra lines for the Costs cheatsheet: what coins and fish buy.
export function tradersCostNotes(game: GameState | null): string[] {
  if (!game) return [];
  const out: string[] = [];
  if (game.coinsInPlay) {
    out.push(`🪙 ${GOLD_PER_RESOURCE} gold → 1 card of your choice (${MAX_GOLD_SPENDS_PER_TURN}× per turn)`);
    out.push('🪙 Buy 1 gold: 4 cards (3 with a 3:1 harbor, 2 of its resource with a 2:1)');
  }
  if (game.tradersBarbarians) {
    out.push('🛒 Wagon, per edge: 2 MP · your road 1 · a rival’s road 1 + 1🪙 to its owner · +2 with a barbarian');
  }
  if (game.fishingGrounds || game.lakeHexId) {
    out.push(
      `🐟 ${FISH_COST_REMOVE_ROBBER} remove robber · ${FISH_COST_STEAL} steal · ${FISH_COST_TAKE_FROM_BANK} take a card · ${FISH_COST_BUILD_ROAD} road · ${FISH_COST_BUY_DEV_CARD} dev card`,
    );
  }
  return out;
}
