import type { Action, GameState, PlayerId, Resource } from '@/game/types';
import { RESOURCES } from '@/game/types';
import {
  FISH_COST_REMOVE_ROBBER,
  FISH_COST_TAKE_FROM_BANK,
  FISH_TOKEN_VALUE,
} from '@/game/modules/traders/constants';
import { reportNeeds } from '../value';

// Greedy minimum-token cover of `cost`. Picks largest tokens first so we
// spend fewer slots — keeps small tokens for later 2-fish "drive off
// robber" calls. Returns null when the hand can't cover.
function coverCost(
  hand: Array<'one' | 'two' | 'three'>,
  cost: number,
): Array<'one' | 'two' | 'three'> | null {
  const sorted = [...hand].sort(
    (a, b) => FISH_TOKEN_VALUE[b] - FISH_TOKEN_VALUE[a],
  );
  const picked: Array<'one' | 'two' | 'three'> = [];
  let total = 0;
  for (const t of sorted) {
    if (total >= cost) break;
    picked.push(t);
    total += FISH_TOKEN_VALUE[t];
  }
  return total >= cost ? picked : null;
}

// AI heuristic for fish spending. Conservative — fish tokens are scarce
// and pay multiple ways, so we only spend when there's a concrete win:
//   - Robber on a high-value hex of ours: drive it off (cost 2).
//   - We can finish a build right now if we take 1 resource: take it
//     (cost 4).
// Higher-tier spends (steal/road/devCard) are left to a future tuning pass.
export function tryFishSpend(state: GameState, playerId: PlayerId): Action | null {
  if (state.phase !== 'main') return null;
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const hand = player.fishTokens ?? [];
  if (hand.length === 0) return null;

  // 1) Drive off the robber when it's sitting on one of our producing hexes.
  if ((state.robberActive ?? true)) {
    const robbedHex = state.board.hexes[state.board.robberHex];
    if (robbedHex && robbedHex.terrain !== 'desert') {
      const touchesUs = state.board.vertexIds.some((vid) => {
        const v = state.board.vertices[vid];
        if (!v || !v.hexes.includes(robbedHex.id)) return false;
        return (
          player.settlements.includes(vid) || player.cities.includes(vid)
        );
      });
      if (touchesUs) {
        const tokens = coverCost(hand, FISH_COST_REMOVE_ROBBER);
        if (tokens) {
          return {
            type: 'spendFish',
            playerId,
            tokens,
            effect: { kind: 'removeRobber' },
          };
        }
      }
    }
  }

  // 2) Take 1 resource to plug an immediate build need.
  const needs = reportNeeds(state, playerId);
  if (needs.goal !== 'none') {
    // Find the resource with the largest shortfall.
    let bestResource: Resource | null = null;
    let bestNeed = 0;
    for (const r of RESOURCES) {
      if ((needs.byResource[r] ?? 0) > bestNeed && state.bank[r] > 0) {
        bestNeed = needs.byResource[r];
        bestResource = r;
      }
    }
    if (bestResource && bestNeed > 0.7) {
      const tokens = coverCost(hand, FISH_COST_TAKE_FROM_BANK);
      if (tokens) {
        return {
          type: 'spendFish',
          playerId,
          tokens,
          effect: { kind: 'takeFromBank', resource: bestResource },
        };
      }
    }
  }

  return null;
}

// Pass-boot heuristic: if we hold the boot and an opponent qualifies
// (visible VPs ≥ ours), pass it to the highest-VP qualifier (they're the
// most likely winner, so taxing them is most useful). Returns null if we
// don't hold the boot or no-one qualifies.
export function tryPassBoot(
  state: GameState,
  playerId: PlayerId,
): Action | null {
  if (state.oldBootHolder !== playerId) return null;
  if (state.phase !== 'main') return null;
  // Compute our visible VP inline to avoid an import cycle with scoring.
  // The pass legality is checked by the engine anyway — this just picks
  // the best target.
  const vp = visibleVp(state, playerId);
  let best: { id: PlayerId; vp: number } | null = null;
  for (const p of state.players) {
    if (p.id === playerId) continue;
    const theirVp = visibleVp(state, p.id);
    if (theirVp < vp) continue;
    if (!best || theirVp > best.vp) best = { id: p.id, vp: theirVp };
  }
  if (!best) return null;
  return { type: 'passOldBoot', playerId, to: best.id };
}

function visibleVp(state: GameState, pid: PlayerId): number {
  const p = state.players.find((x) => x.id === pid);
  if (!p) return 0;
  let vp = p.settlements.length + p.cities.length * 2;
  if (p.hasLongestRoad) vp += 2;
  if (p.hasLargestArmy) vp += 2;
  return vp;
}
