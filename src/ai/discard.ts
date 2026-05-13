import type { GameState, PlayerId, Resource, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { reportNeeds } from './value';

// Discards by trying to keep one of each resource we still need for our
// current goal, and dumping the most-abundant otherwise.
export function chooseDiscard(
  state: GameState,
  playerId: PlayerId,
): Partial<ResourceBank> {
  const required = state.discardState?.required[playerId];
  if (!required) return {};
  const player = state.players.find((p) => p.id === playerId)!;
  const needs = reportNeeds(state, playerId);

  // Sort resources by "least needed first"
  const sortable: { r: Resource; have: number; need: number }[] = RESOURCES.map((r) => ({
    r,
    have: player.resources[r],
    need: needs.byResource[r],
  }));
  // Highest abundance / lowest need → discarded first
  sortable.sort((a, b) => {
    const aPriority = a.have - a.need * 3;
    const bPriority = b.have - b.need * 3;
    return bPriority - aPriority;
  });

  const result: Partial<ResourceBank> = {};
  let remaining = required;
  for (const { r, have } of sortable) {
    if (remaining === 0) break;
    if (have === 0) continue;
    const dis = Math.min(remaining, have);
    if (dis > 0) {
      result[r] = dis;
      remaining -= dis;
    }
  }
  return result;
}
