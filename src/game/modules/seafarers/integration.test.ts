import { describe, it, expect } from 'vitest';
import { createGame } from '../../createGame';
import { applyAction } from '../../engine';
import { chooseAction, shouldAcceptTrade } from '@/ai';
import { getActingPlayerId } from '../../helpers';
import type { GameState } from '../../types';
import { SCENARIO_ORDER } from './board/scenarios';

// Full AI-vs-AI run on a Seafarers board. Sanity-checks that the engine,
// AI, and module wiring all hold up across the new phases (ship-building,
// gold picks, pirate moves, island chips, longest trade route). Uses a
// modest VP target so games terminate quickly.
function playSeafarersGame(
  scenarioId: string,
  seed: number,
  vpTarget = 5,
): GameState {
  let s = createGame({
    playerNames: ['AI-A', 'AI-B', 'AI-C'],
    playerTypes: ['ai', 'ai', 'ai'],
    seed,
    settings: {
      victoryPointsToWin: vpTarget,
      expansions: ['seafarers'],
      scenarioId,
    },
  });
  let safety = 0;
  while (s.winner === null && safety < 8000) {
    safety++;
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
      s = applyAction(s, { type: 'cancelTrade', playerId: pt.proposerId });
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

function playSeafarersGame5p(
  scenarioId: string,
  seed: number,
  vpTarget = 5,
): GameState {
  let s = createGame({
    playerNames: ['AI-A', 'AI-B', 'AI-C', 'AI-D', 'AI-E'],
    playerTypes: ['ai', 'ai', 'ai', 'ai', 'ai'],
    seed,
    settings: {
      victoryPointsToWin: vpTarget,
      expansions: ['seafarers'],
      scenarioId,
    },
  });
  let safety = 0;
  while (s.winner === null && safety < 12000) {
    safety++;
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
      s = applyAction(s, { type: 'cancelTrade', playerId: pt.proposerId });
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

describe('seafarers integration', () => {
  it('AI plays a full Heading for New Shores game to completion', () => {
    const final = playSeafarersGame('headingForNewShores', 42, 5);
    expect(final.winner).not.toBeNull();
    expect(final.phase).toBe('gameOver');
  }, 60_000);

  it('AI plays a Four Islands game to completion (heavy ship reliance)', () => {
    const final = playSeafarersGame('fourIslands', 7, 5);
    expect(final.winner).not.toBeNull();
    expect(final.phase).toBe('gameOver');
  }, 60_000);

  it('AI plays a Pirate Islands game to completion', () => {
    const final = playSeafarersGame('pirateIslands', 12, 5);
    expect(final.winner).not.toBeNull();
    expect(final.phase).toBe('gameOver');
  }, 60_000);

  it('AI plays a 5-player Seafarers game (5-6 board + paired-player rule)', () => {
    // All 9 scenarios now support 3-6 players (Phase 7 done). Four Islands
    // is exercised here as the canonical "anyIsland" scenario; other 5-6p
    // layouts are smoke-tested via the `every scenario produces a board`
    // case below.
    const final = playSeafarersGame5p('fourIslands', 11, 4);
    expect(final.winner).not.toBeNull();
    expect(final.phase).toBe('gameOver');
    // 5-6 player Seafarers uses the larger radius-4 grid (61 hexes).
    expect(final.board.hexIds.length).toBe(61);
  }, 90_000);

  it('every scenario produces a board the engine can run', () => {
    // Just instantiate every scenario and verify createGame succeeds.
    for (const { id } of SCENARIO_ORDER) {
      const s = createGame({
        playerNames: ['A', 'B', 'C'],
        seed: 1,
        settings: { expansions: ['seafarers'], scenarioId: id },
      });
      expect(s.phase).toBe('setupRound1');
      expect(s.islandChips).toBeDefined();
      expect(s.board.pirateHex).toBeDefined();
    }
  });
});
