import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice } from '@/game/rng';
import type { Action, AiLevel, GameState, PlayerId } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '../index';
import { ACTION_SPACE_VERSION } from './actions';
import { ENCODER_VERSION } from './encode';
import { AI_LEVELS, AI_LEVEL_IDS, DEFAULT_AI_LEVEL, loadedAiLevel, setAiLevelNet } from './levels';
import { KnowledgeSession, chooseNeuralAction, neuralLevel } from './index';
import { CatanPolicyNet, type CatanPolicyFile } from './runtime';

const readPolicy = (level: AiLevel) =>
  JSON.parse(readFileSync(resolve('src/ai/nn/policies', AI_LEVELS[level].file), 'utf8')) as CatanPolicyFile;

const nets = {} as Record<AiLevel, CatanPolicyNet>;
for (const level of AI_LEVEL_IDS) {
  nets[level] = new CatanPolicyNet(readPolicy(level));
  setAiLevelNet(level, nets[level]);
}

/** Who must act next: a trade answer comes before anything else (as training/catan/vec-env.ts). */
function decidingSeat(s: GameState): PlayerId {
  const pt = s.pendingTrade;
  if (pt) {
    const acting = s.playerOrder[s.currentPlayerIndex]!;
    if (pt.proposerId !== acting) return acting;
    const n = s.playerOrder.length;
    const at = s.playerOrder.indexOf(pt.proposerId);
    for (let k = 1; k < n; k++) {
      const id = s.playerOrder[(at + k) % n]!;
      if (!pt.rejectedBy.includes(id)) return id;
    }
  }
  return getActingPlayerId(s);
}

/** A seeded game to the end: `network` seats play their level's net through
 *  a KnowledgeSession fed the log (as the AIDriver does), the rest the heuristic. */
function playLevelGame(players: number, seed: number, level: AiLevel, network: (seat: number) => boolean) {
  const names = Array.from({ length: players }, (_, i) => `p${i}`);
  const initial = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings: { victoryPointsToWin: 10, aiLevel: level },
  });
  expect(neuralLevel(initial)).toBe(level);
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
      action = chooseNeuralAction(s, id, known![id]!, loadedAiLevel(level)!);
      // Its own offer on the table: the network waits; the app's driver cancels.
      if (!action && s.pendingTrade?.proposerId === id) action = { type: 'cancelTrade', playerId: id };
      expect(action, `network ${id} had no move in ${s.phase}`).not.toBeNull();
      networkMoves++;
    } else if (s.pendingTrade && s.pendingTrade.proposerId !== id) {
      const counter = s.pendingTrade.proposerId !== s.playerOrder[s.currentPlayerIndex];
      action = shouldAcceptTrade(s, id)
        ? { type: 'acceptTrade', playerId: id }
        : { type: counter ? 'cancelTrade' : 'rejectTrade', playerId: id };
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
  it('ships a policy file for each level, built for this encoder and action space', () => {
    expect(AI_LEVEL_IDS).toContain(DEFAULT_AI_LEVEL);
    for (const level of AI_LEVEL_IDS) {
      const file = readPolicy(level);
      expect(file.encoderVersion).toBe(ENCODER_VERSION);
      expect(file.actionSpaceVersion).toBe(ACTION_SPACE_VERSION);
      expect(typeof AI_LEVELS[level].url).toBe('string');
    }
  });

  it('stays out of rule sets the networks were not trained for', () => {
    const base = { numPlayers: 4, victoryPointsToWin: 10, aiLevel: 'hard' as const };
    expect(neuralLevel({ settings: { ...base, expansions: [] } })).toBe('hard');
    expect(neuralLevel({ settings: { ...base, expansions: [], aiLevel: undefined } })).toBeNull();
    expect(neuralLevel({ settings: { ...base, expansions: ['seafarers'] } })).toBeNull();
    expect(neuralLevel({ settings: { ...base, expansions: [], baseScenarioId: 'volcano' } })).toBeNull();
  });

  it.each([
    [4, 'hard', 'every seat'],
    [3, 'normal', 'every seat'],
    [6, 'easy', 'every seat'],
    [4, 'hard', 'two seats, two heuristics'],
  ] as const)('%ip %s: %s play a full game to the end', (players, level, who) => {
    const { final, networkMoves } = playLevelGame(players, 900 + players, level, (i) => who === 'every seat' || i % 2 === 0);
    expect(final.phase).toBe('gameOver');
    expect(final.winner).not.toBeNull();
    expect(networkMoves).toBeGreaterThan(100);
  }, 120_000);
});
