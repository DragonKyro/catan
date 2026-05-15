import type { GameState, PlayerId, HexId } from '@/game/types';
import { totalResources } from '@/game/resources';

// Pick a target sea hex for the pirate. Prefers a hex with an opponent's
// ship adjacent (so we can steal). Falls back to any sea hex other than the
// current pirate hex.
export function choosePirateMove(
  state: GameState,
  playerId: PlayerId,
): { hex: HexId; stealFrom: PlayerId | null } | null {
  const cur = state.board.pirateHex;
  let bestHex: HexId | null = null;
  let bestVictim: PlayerId | null = null;
  let bestScore = -Infinity;

  for (const hid of state.board.hexIds) {
    if (hid === cur) continue;
    if (state.board.hexes[hid]!.terrain !== 'sea') continue;
    const adjacentEdges = state.board.edgeIds.filter((eid) =>
      state.board.edges[eid]!.hexes.includes(hid),
    );

    let victim: PlayerId | null = null;
    let victimHand = -1;
    for (const p of state.players) {
      if (p.id === playerId) continue;
      const hasShipHere = adjacentEdges.some((eid) => p.ships.includes(eid));
      if (!hasShipHere) continue;
      const hand = totalResources(p.resources);
      if (hand <= 0) continue;
      if (hand > victimHand) {
        victim = p.id;
        victimHand = hand;
      }
    }

    // Score: a hex with a robust victim is best; an empty sea hex is fine
    // but lowest priority.
    const score = victim ? 100 + victimHand : 0;
    if (score > bestScore) {
      bestScore = score;
      bestHex = hid;
      bestVictim = victim;
    }
  }

  if (!bestHex) return null;
  return { hex: bestHex, stealFrom: bestVictim };
}

// AI choice between robber and pirate. Compares the best victim hand for
// each option and picks whichever offers a steal. Ties go to robber so the
// AI doesn't pirate-spam when both are equally bad.
export function preferPirate(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const pirate = choosePirateMove(state, playerId);
  if (!pirate) return false;
  if (!pirate.stealFrom) return false;
  return true;
}
