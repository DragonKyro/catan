import type { GameState, PlayerId, HexId } from '@/game/types';
import { totalResources } from '@/game/resources';
import {
  canMovePirateTo,
  pirateStealCandidates,
} from '@/game/modules/seafarers/actions/movePirate';
import { chooseRobberMove } from '../robber';

export interface PirateChoice {
  hex: HexId;
  stealFrom: PlayerId | null;
  stealCloth: boolean;
  score: number;
}

// Pick a sea hex for the pirate: the one where we can rob the biggest hand
// (Cloth for Catan: or take a cloth token), favouring hexes that also block
// several opposing ships.
export function choosePirateMove(state: GameState, playerId: PlayerId): PirateChoice | null {
  const me = state.players.find((p) => p.id === playerId);
  let best: PirateChoice | null = null;
  for (const hid of state.board.hexIds) {
    if (!canMovePirateTo(state, hid)) continue;
    let victim: PlayerId | null = null;
    let victimValue = -1;
    let stealCloth = false;
    for (const pid of pirateStealCandidates(state, playerId, hid)) {
      const p = state.players.find((x) => x.id === pid)!;
      const hand = totalResources(p.resources);
      const cloth = p.cloth ?? 0;
      // Cloth is worth half a VP per token; grab one when it completes one
      // of our pairs or the victim has no cards.
      const takeCloth =
        state.clothVillages !== undefined &&
        cloth > 0 &&
        (hand === 0 || (me?.cloth ?? 0) % 2 === 1);
      const value = takeCloth ? 6 : hand;
      if (value > victimValue) {
        victim = pid;
        victimValue = value;
        stealCloth = takeCloth;
      }
    }
    let blocked = 0;
    for (const p of state.players) {
      if (p.id === playerId) continue;
      blocked += p.ships.filter((e) => state.board.edges[e]?.hexes.includes(hid)).length;
    }
    const score = (victim ? 4 + victimValue : 0) + blocked * 0.5;
    if (!best || score > best.score) best = { hex: hid, stealFrom: victim, stealCloth, score };
  }
  return best;
}

// Robber or pirate? Take the pirate only when it robs someone and the
// robber's best move isn't clearly better.
export function preferPirate(state: GameState, playerId: PlayerId): boolean {
  const pirate = choosePirateMove(state, playerId);
  if (!pirate || !pirate.stealFrom) return false;
  const robber = chooseRobberMove(state, playerId);
  if (!robber.stealFrom) return true;
  return pirate.score >= robber.score * 0.5;
}
