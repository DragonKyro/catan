import type { GameState, PlayerId, Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { RESOURCE_WEIGHT } from '@/ai/value';

// AI gold-resource pick: greedily pick the highest-weighted resource the AI
// is short on, taking bank constraints into account. Simple but effective:
// each pick re-evaluates the AI's "neediest" resource given previous picks.
export function chooseGoldResourcePicks(
  state: GameState,
  playerId: PlayerId,
  count: number,
): Resource[] {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return [];

  const projected: Record<Resource, number> = { ...player.resources };
  const bank: Record<Resource, number> = { ...state.bank };
  const out: Resource[] = [];

  for (let i = 0; i < count; i++) {
    let bestR: Resource | null = null;
    let bestScore = -Infinity;
    for (const r of RESOURCES) {
      if (bank[r] <= 0) continue;
      // Score: prefer scarce-on-hand (low projected[r]) high-weight resources.
      const score = RESOURCE_WEIGHT[r] * (1 + 1 / (projected[r] + 1));
      if (score > bestScore) {
        bestScore = score;
        bestR = r;
      }
    }
    if (!bestR) {
      // Bank totally empty — synthesize a fallback (the engine will throw,
      // but this is extreme corner case).
      out.push('wheat');
      continue;
    }
    out.push(bestR);
    projected[bestR]++;
    bank[bestR]--;
  }
  return out;
}
