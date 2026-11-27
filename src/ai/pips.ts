// Pips a player's buildings collect per resource (settlement x1, city x2) — a
// pure board helper with no AI dependencies, so the game log can use it
// without loading the AI (src/ai/value.ts re-exports it).

import type { GameState, PlayerId, Resource, VertexId } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { hexPips } from '@/game/board/hexNumbers';

export function pipsByResource(state: GameState, playerId: PlayerId): Record<Resource, number> {
  const out: Record<Resource, number> = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return out;
  const owned = new Map<VertexId, number>();
  for (const v of player.settlements) owned.set(v, 1);
  for (const v of player.cities) owned.set(v, 2);
  for (const [vid, mult] of owned) {
    const vertex = state.board.vertices[vid];
    if (!vertex) continue;
    for (const hexId of vertex.hexes) {
      const hex = state.board.hexes[hexId]!;
      // Only resource hexes (not desert / sea / swamp / lake / ...).
      if (!(RESOURCES as readonly string[]).includes(hex.terrain)) continue;
      const pips = hexPips(hex);
      out[hex.terrain as Resource] += pips * mult;
    }
  }
  return out;
}
