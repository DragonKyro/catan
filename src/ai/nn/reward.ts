// Catan learned agent — reward.
//
// Terminal reward per seat, from the final standings (true VP — hidden VP
// cards count, as they're revealed at game end):
//
//   win        weights.win to the winner
//   placement  weights.placement × (n − rank) / (n − 1): 1st full, last 0.
//              Tied seats share the average of the ranks they span. The
//              winner always ranks 1st, even if someone else also holds
//              enough VP (they hadn't claimed it on their own turn).
//   vp         weights.vp × min(vp, target) / target
//
// then, with weights.zeroSum, minus the table's mean, so what counts is doing
// better than the table, which is what placement means. Defaults at 4
// players (10 / 8 / 6 / 4 VP): +1.15, −0.12, −0.38, −0.65. Winning is worth
// far more than any finish behind it, each place up is worth ~0.27, and each
// VP ~0.05.
//
// A match cut off before anyone wins (the env's step cap) has no win term
// and every seat takes an extra −weights.truncation after centring, so
// stalling never beats playing on.
//
// Dense shaping, if the trainer wants it: potential-based on own VP,
// Φ(s) = scale × VP(s) / target, paid as γ·Φ(s′) − Φ(s) between a seat's
// decisions. It telescopes over a match, so it speeds learning without
// changing which policy is best.

import type { GameState, PlayerId } from '@/game/types';
import { calculateVictoryPoints } from '@/game/scoring/points';

export interface RewardWeights {
  win: number;
  placement: number;
  vp: number;
  zeroSum: boolean;
  truncation: number;
}

export const DEFAULT_REWARD_WEIGHTS: RewardWeights = {
  win: 1,
  placement: 0.5,
  vp: 0.5,
  zeroSum: true,
  truncation: 0.5,
};

export interface Standing {
  playerId: PlayerId;
  vp: number;
  /** 1 = first; shared ranks are averaged (two seats tied for 2nd–3rd both get 2.5). */
  rank: number;
}

/** Final standings in `state.players` order. */
export function finalStandings(state: GameState): Standing[] {
  const rows = state.players.map((p) => ({
    playerId: p.id,
    vp: calculateVictoryPoints(state, p.id, true),
    won: p.id === state.winner,
  }));
  const sorted = [...rows].sort((a, b) => Number(b.won) - Number(a.won) || b.vp - a.vp);
  const rank = new Map<PlayerId, number>();
  for (let i = 0; i < sorted.length;) {
    let j = i;
    while (j + 1 < sorted.length && !sorted[j + 1]!.won && !sorted[i]!.won && sorted[j + 1]!.vp === sorted[i]!.vp) j++;
    for (let k = i; k <= j; k++) rank.set(sorted[k]!.playerId, (i + j) / 2 + 1);
    i = j + 1;
  }
  return rows.map((r) => ({ playerId: r.playerId, vp: r.vp, rank: rank.get(r.playerId)! }));
}

/** Reward per seat for a finished (or step-capped) match. */
export function terminalRewards(state: GameState, weights: RewardWeights = DEFAULT_REWARD_WEIGHTS): Record<PlayerId, number> {
  const standings = finalStandings(state);
  const n = standings.length;
  const target = state.settings.victoryPointsToWin;
  const truncated = state.winner === null;
  const raw = standings.map((s) =>
    (s.playerId === state.winner ? weights.win : 0)
    + weights.placement * (n > 1 ? (n - s.rank) / (n - 1) : 1)
    + weights.vp * Math.min(s.vp, target) / target);
  const mean = raw.reduce((a, b) => a + b, 0) / n;
  const out: Record<PlayerId, number> = {};
  standings.forEach((s, i) => {
    out[s.playerId] = raw[i]! - (weights.zeroSum ? mean : 0) - (truncated ? weights.truncation : 0);
  });
  return out;
}

/** Shaping potential Φ for one seat: `scale` × own VP / target. */
export function vpPotential(state: GameState, playerId: PlayerId, scale: number): number {
  return (scale * calculateVictoryPoints(state, playerId, true)) / state.settings.victoryPointsToWin;
}
