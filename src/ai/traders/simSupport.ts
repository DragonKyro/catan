// Test-only: seeded all-heuristic-AI games, for the T&B scenario / variant
// simulations. Not imported by production code.
import type { Action, GameState } from '@/game/types';
import { createGame, type CreateGameOptions } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice } from '@/game/rng';
import { chooseAction, shouldAcceptTrade } from '@/ai';

export interface SimResult {
  final: GameState;
  actions: Action[];
  steps: number;
}

export function simulate(
  seed: number,
  numPlayers: number,
  settings: CreateGameOptions['settings'],
  maxSteps = 8000,
  onStep?: (before: GameState, action: Action, after: GameState) => void,
): SimResult {
  const names = ['AI-A', 'AI-B', 'AI-C', 'AI-D', 'AI-E', 'AI-F'].slice(0, numPlayers);
  let s = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings,
  });
  let dice = (seed * 7919 + 13) >>> 0;
  const actions: Action[] = [];
  const step = (action: Action) => {
    let a = action;
    if (a.type === 'rollDice') {
      const [d, next] = rollDice(dice);
      dice = next;
      a = { ...a, dice: d };
    }
    const before = s;
    s = applyAction(s, a);
    actions.push(a);
    onStep?.(before, a, s);
  };
  let steps = 0;
  while (s.phase !== 'gameOver' && steps < maxSteps) {
    steps++;
    const pt = s.pendingTrade;
    if (pt) {
      const acceptor = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id));
      step(
        acceptor
          ? { type: 'acceptTrade', playerId: acceptor.id }
          : { type: 'cancelTrade', playerId: pt.proposerId },
      );
      continue;
    }
    const acting = getActingPlayerId(s);
    step(chooseAction(s, acting) ?? { type: 'endTurn', playerId: acting });
  }
  return { final: s, actions, steps };
}
