import { describe, it, expect } from 'vitest';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { chooseAction, shouldAcceptTrade } from './index';
import { getActingPlayerId } from '@/game/helpers';
import type { GameState } from '@/game/types';

// Run the AI against itself until someone wins (or we hit a safety limit).
// This exercises essentially every code path in the engine + AI: setup
// snake order, dice rolls, resource distribution, building, dev cards,
// robber, discard, and trades.
function playFullGame(
  seed: number,
  vpTarget = 4,
  playerCount = 3,
): GameState {
  const names = [
    'AI-A', 'AI-B', 'AI-C', 'AI-D', 'AI-E', 'AI-F', 'AI-G', 'AI-H',
  ].slice(0, playerCount);
  let s = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings: { victoryPointsToWin: vpTarget },
  });

  let safety = 0;
  while (s.winner === null && safety < 5000) {
    safety++;

    // 1) If there's a pending trade, evaluate acceptance for each opponent.
    const pt = s.pendingTrade;
    if (pt) {
      let accepted = false;
      for (const p of s.players) {
        if (p.id === pt.proposerId) continue;
        if (shouldAcceptTrade(s, p.id)) {
          s = applyAction(s, { type: 'acceptTrade', playerId: p.id });
          accepted = true;
          break;
        }
      }
      if (accepted) continue;
      // Nobody wanted it — cancel it so the proposer can move on.
      s = applyAction(s, {
        type: 'cancelTrade',
        playerId: pt.proposerId,
      });
      continue;
    }

    const acting = getActingPlayerId(s);
    const action = chooseAction(s, acting);
    if (action) {
      s = applyAction(s, action);
    } else {
      s = applyAction(s, { type: 'endTurn', playerId: acting });
    }
  }
  return s;
}

describe('AI plays a full game', () => {
  it('terminates with a winner at VP target 4', () => {
    const final = playFullGame(42, 4);
    expect(final.winner).not.toBeNull();
    expect(final.phase).toBe('gameOver');
  }, 30_000);

  it('terminates with a winner at VP target 5', () => {
    const final = playFullGame(7, 5);
    expect(final.winner).not.toBeNull();
    expect(final.phase).toBe('gameOver');
  }, 30_000);

  it('different seeds produce different game outcomes', () => {
    const a = playFullGame(1, 4);
    const b = playFullGame(999, 4);
    // Different RNG → very likely different board / decisions, even if
    // the same player ends up winning sometimes.
    expect(a.board.robberHex === b.board.robberHex && a.players[0]!.settlements.join('') === b.players[0]!.settlements.join('')).toBe(false);
  }, 30_000);

  it('5-player game terminates (exercises Special Build Phase)', () => {
    const final = playFullGame(42, 4, 5);
    expect(final.winner).not.toBeNull();
    expect(final.phase).toBe('gameOver');
  }, 60_000);

  it('8-player game terminates (exercises 7-8p extension + paired-player rule)', () => {
    const final = playFullGame(42, 4, 8);
    expect(final.winner).not.toBeNull();
    expect(final.phase).toBe('gameOver');
    expect(final.boardVariant).toBe('7-8');
  }, 120_000);
});
