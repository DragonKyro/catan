// Catan learned agent — adapts any slot policy to "one reducer action".
//
// A policy sees the encoded observation and the legal mask and names a slot.
// Multi-part answers (discards, robber hex then victim, Road Building) take
// several policy calls; the draft between them is local to this loop, so
// the game state only changes once the whole answer is in.

import type { Action, GameState, PlayerId } from '@/game/types';
import { decodeSlot, legalMask, randomDice } from './actions';
import { encodeObservation, type CatanFeatures } from './encode';
import type { CatanKnowledge } from './knowledge';
import { observe, type CatanDraft, type CatanObservation } from './observation';

export type SlotPolicy = (features: CatanFeatures, mask: Uint8Array, obs: CatanObservation) => number;

/** The viewer's next action, or null when it has nothing to decide. */
export function actWithPolicy(
  state: GameState,
  playerId: PlayerId,
  knowledge: CatanKnowledge,
  policy: SlotPolicy,
  rollDice: () => [number, number] = randomDice,
): Action | null {
  let draft: CatanDraft | null = null;
  // The longest answer is a discard of half a very large hand.
  for (let part = 0; part < 64; part++) {
    const obs = observe(state, playerId, knowledge, { draft });
    if (!obs.decision) return null;
    const mask = legalMask(obs);
    const decoded = decodeSlot(obs, policy(encodeObservation(obs), mask, obs), rollDice);
    if (decoded.kind === 'action') return decoded.action;
    draft = decoded.draft;
  }
  throw new Error('actWithPolicy: answer did not finish');
}
