import { readFileSync } from 'node:fs';
import { nextTradeResponder } from '../trade';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice } from '@/game/rng';
import type { Action, GameSettings, GameState, PlayerId } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '../index';
import { ACTION_SPACE_VERSION } from './actions';
import { ENCODER_VERSION } from './encode';
import { AI_LEVEL_IDS, AI_POLICIES, AI_POLICY_IDS, DEFAULT_AI_LEVEL, loadedAiPolicy, setAiPolicyNet, type AiPolicyId } from './levels';
import { KnowledgeSession, chooseNeuralAction, neuralPolicy } from './index';
import { CatanPolicyNet, decodePolicyBinary } from './runtime';

const readPolicy = (id: AiPolicyId) =>
  decodePolicyBinary(readFileSync(resolve('src/ai/nn/policies', AI_POLICIES[id].file)));

for (const id of AI_POLICY_IDS) setAiPolicyNet(id, new CatanPolicyNet(readPolicy(id)));

/** colonist.io's 1v1 rules (createGame adds 15 VP and the 9-card limit at 2 players). */
const ONE_V_ONE: Partial<GameSettings> = { balancedDice: true, tradersVariants: { friendlyRobber: true } };

/** Who must act next: a trade answer comes before anything else (as training/catan/vec-env.ts). */
function decidingSeat(s: GameState): PlayerId {
  const pt = s.pendingTrade;
  if (pt) {
    const acting = s.playerOrder[s.currentPlayerIndex]!;
    if (pt.proposerId !== acting) return acting;
    // Each opponent answers in turn; then the proposer picks a partner.
    return nextTradeResponder(s) ?? pt.proposerId;
  }
  return getActingPlayerId(s);
}

/** A seeded game to the end: `network` seats play the table size's net through
 *  a KnowledgeSession fed the log (as the AIDriver does), the rest the heuristic. */
function playLevelGame(players: number, seed: number, policy: AiPolicyId, network: (seat: number) => boolean) {
  const names = Array.from({ length: players }, (_, i) => `p${i}`);
  const initial = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings: { aiLevel: 'hard', ...(players === 2 ? ONE_V_ONE : { victoryPointsToWin: 10 }) },
  });
  expect(neuralPolicy(initial)).toBe(policy);
  const netSeats = names.filter((_, i) => network(i));
  const session = new KnowledgeSession();
  const actions: Action[] = [];
  let s = initial;
  let dice = (seed * 2654435761) >>> 0;
  const roll = (): [number, number] => {
    const [d, next] = rollDice(dice);
    dice = next;
    return d;
  };
  let networkMoves = 0;
  for (let step = 0; s.phase !== 'gameOver' && step < 20000; step++) {
    const id = decidingSeat(s);
    let action: Action | null;
    if (netSeats.includes(id)) {
      const known = session.sync(initial, actions, s, netSeats);
      expect(known, session.problem ?? '').not.toBeNull();
      action = chooseNeuralAction(s, id, known![id]!, loadedAiPolicy(policy)!);
      // Its own offer, everyone has answered: the heuristic picks a partner (as the app's driver does).
      if (!action && s.pendingTrade?.proposerId === id) action = chooseAction(s, id);
      expect(action, `network ${id} had no move in ${s.phase}`).not.toBeNull();
      networkMoves++;
    } else if (s.pendingTrade && s.pendingTrade.proposerId !== id) {
      action = { type: shouldAcceptTrade(s, id) ? 'acceptTrade' : 'rejectTrade', playerId: id };
    } else {
      action = chooseAction(s, id) ?? { type: 'endTurn', playerId: id };
      if (action.type === 'rollDice') action = { ...action, dice: roll() };
    }
    s = applyAction(s, action!);
    actions.push(action!);
  }
  return { final: s, networkMoves };
}

describe('AI levels', () => {
  it('ships a policy file for each network, built for this encoder and action space', () => {
    expect(AI_LEVEL_IDS).toContain(DEFAULT_AI_LEVEL);
    for (const id of AI_POLICY_IDS) {
      const file = readPolicy(id);
      expect(file.encoderVersion).toBe(ENCODER_VERSION);
      expect(file.actionSpaceVersion).toBe(ACTION_SPACE_VERSION);
      expect(typeof AI_POLICIES[id].url).toBe('string');
      expect(AI_LEVEL_IDS).toContain(AI_POLICIES[id].level);
    }
  });

  it('plays each table size with its own network, and stays out of rule sets they were not trained for', () => {
    const settings = { victoryPointsToWin: 10, aiLevel: 'hard' as const, expansions: [] };
    const table = (n: number, more: Partial<GameSettings> = {}) =>
      neuralPolicy({ settings: { ...settings, numPlayers: n, ...more }, players: Array.from({ length: n }, () => ({}) as never) });
    expect([2, 3, 4, 5, 8].map((n) => table(n))).toEqual(['hard2p', 'hard3p', 'hard', 'hard', 'hard']);
    expect(table(2, ONE_V_ONE)).toBe('hard2p'); // the 2-player network trained with the Friendly Robber
    expect(table(3, ONE_V_ONE)).toBeNull(); // ... the others didn't
    expect(table(4, { balancedDice: true })).toBe('hard');
    expect(table(4, { aiLevel: undefined })).toBeNull();
    expect(table(4, { expansions: ['seafarers'] })).toBeNull();
    expect(table(2, { baseScenarioId: 'volcano' })).toBeNull();
  });

  it.each([
    [4, 'hard', 'every seat'],
    [3, 'hard3p', 'every seat'],
    [2, 'hard2p', 'every seat'],
    [6, 'hard', 'every seat'],
    [4, 'hard', 'two seats, two heuristics'],
    [2, 'hard2p', 'one seat, a heuristic'],
  ] as const)('%ip %s: %s play a full game to the end', (players, policy, who) => {
    const { final, networkMoves } = playLevelGame(players, 900 + players, policy, (i) => who === 'every seat' || i % 2 === 0);
    expect(final.phase).toBe('gameOver');
    expect(final.winner).not.toBeNull();
    expect(networkMoves).toBeGreaterThan(100);
  }, 120_000);
});
