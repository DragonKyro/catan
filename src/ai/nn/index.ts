// Catan learned agent — what the app uses to play a trained network.
//
// A base game (supportsNeuralAi) with `settings.aiLevel` set plays every AI
// seat with the Hard network for its table size (2, 3 or 4+ players —
// levels.ts `aiPolicyFor`; any stored level — older builds also wrote
// 'easy' / 'normal' — plays Hard); anything else keeps the heuristic AI.
// The UI owns the KnowledgeSession (fed from the game log) and the loading
// of the network's policy file (levels.ts).

import type { Action, GameState, PlayerId } from '@/game/types';
import { rulesFromMeta } from './actions';
import { actWithPolicy } from './agent';
import type { CatanKnowledge } from './knowledge';
import { supportsNeuralAi } from './observation';
import { greedyPolicy, type CatanPolicyNet } from './runtime';
import { aiPolicyFor, type AiPolicyId } from './levels';

export { supportsNeuralAi } from './observation';
export { KnowledgeSession } from './session';
export {
  AI_POLICIES, AI_POLICY_IDS, AI_LEVEL_IDS, DEFAULT_AI_LEVEL, aiPolicyFor, loadAiPolicy, loadedAiPolicy, type AiPolicyId,
} from './levels';

/** The network that plays this game's AI seats, or null for the heuristic AI. */
export function neuralPolicy(state: Pick<GameState, 'settings' | 'players'>): AiPolicyId | null {
  const players = state.players.length;
  if (!state.settings.aiLevel || !supportsNeuralAi({ ...state.settings, numPlayers: players })) return null;
  return aiPolicyFor(state.settings.aiLevel, players);
}

/** The network's next action for `playerId` (its top legal move), or null if it has nothing to decide. */
export function chooseNeuralAction(
  state: GameState,
  playerId: PlayerId,
  knowledge: CatanKnowledge,
  net: CatanPolicyNet,
): Action | null {
  return actWithPolicy(state, playerId, knowledge, greedyPolicy(net), undefined, rulesFromMeta(net.meta));
}
