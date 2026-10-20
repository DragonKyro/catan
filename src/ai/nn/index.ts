// Catan learned agent — what the app uses to play a trained network.
//
// A base game (supportsNeuralAi) with `settings.aiLevel` set plays every AI
// seat with that level's network; anything else keeps the heuristic AI.
// The UI owns the KnowledgeSession (fed from the game log) and the loading
// of the level's policy file (levels.ts).

import type { Action, AiLevel, GameState, PlayerId } from '@/game/types';
import { actWithPolicy } from './agent';
import type { CatanKnowledge } from './knowledge';
import { supportsNeuralAi } from './observation';
import { greedyPolicy, type CatanPolicyNet } from './runtime';

export { supportsNeuralAi } from './observation';
export { KnowledgeSession } from './session';
export { AI_LEVELS, AI_LEVEL_IDS, DEFAULT_AI_LEVEL, loadAiLevel, loadedAiLevel } from './levels';

/** The network level that plays this game's AI seats, or null for the heuristic AI. */
export function neuralLevel(state: Pick<GameState, 'settings'>): AiLevel | null {
  return supportsNeuralAi(state.settings) ? state.settings.aiLevel ?? null : null;
}

/** The network's next action for `playerId` (its top legal move), or null if it has nothing to decide. */
export function chooseNeuralAction(
  state: GameState,
  playerId: PlayerId,
  knowledge: CatanKnowledge,
  net: CatanPolicyNet,
): Action | null {
  return actWithPolicy(state, playerId, knowledge, greedyPolicy(net));
}
