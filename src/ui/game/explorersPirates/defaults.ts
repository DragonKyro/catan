import type { Action, GameState, HexId, PlayerId } from '@/game/types';
import { RESOURCES } from '@/game/types';
import {
  isExplorersPirates,
  legalShipSteps,
  moveCanEnd,
  pirateHexOptions,
  pirateVictims,
  shipsOnEdge,
} from '@/game/modules/explorersPirates/state';
import { epSetupShipEdges } from '@/game/modules/explorersPirates/setup';
import { calculateVictoryPoints } from '@/game/scoring/points';

// Automatic Explorers & Pirates moves for when a human's turn timer runs
// out (TurnTimer): a pirate-ship placement, the setup ship, and getting a
// moving ship off an edge it may not stop on.

function cardsOf(game: GameState, pid: PlayerId): number {
  const p = game.players.find((x) => x.id === pid);
  return p ? RESOURCES.reduce((n, r) => n + p.resources[r], 0) : 0;
}

// The best victim on a hex: the most cards, then the most VP.
export function epBestVictim(game: GameState, pid: PlayerId, hex: HexId): PlayerId | null {
  const victims = pirateVictims(game, pid, hex);
  let best: PlayerId | null = null;
  let score = -Infinity;
  for (const v of victims) {
    const s = cardsOf(game, v) * 10 + calculateVictoryPoints(game, v, false);
    if (s > score) {
      score = s;
      best = v;
    }
  }
  return best;
}

// Place the pirate where it robs the richest opponent (else anywhere legal).
export function epDefaultPirateAction(game: GameState, pid: PlayerId): Action | null {
  if (!isExplorersPirates(game) || game.phase !== 'epPlacePirate') return null;
  const options = pirateHexOptions(game);
  if (options.length === 0) return null;
  let hex = options[0]!;
  let best = -1;
  for (const h of options) {
    const v = epBestVictim(game, pid, h);
    const s = v ? 1 + cardsOf(game, v) : 0;
    if (s > best) {
      best = s;
      hex = h;
    }
  }
  return { type: 'epPlacePirate', playerId: pid, hex, stealFrom: epBestVictim(game, pid, hex) };
}

export function epDefaultSetupShip(game: GameState, pid: PlayerId): Action | null {
  if (game.phase !== 'setupRound3' || game.setupState?.step !== 'ship') return null;
  const edge = epSetupShipEdges(game, pid)[0];
  return edge ? { type: 'placeInitialShip', playerId: pid, edge } : null;
}

// A moving ship on an edge with 2 other ships must sail on before the phase
// can end: one step to an edge where it may stop.
export function epUnblockMove(game: GameState, pid: PlayerId): Action | null {
  const m = game.explorersPirates?.movement;
  if (!m?.moving || moveCanEnd(game)) return null;
  const steps = legalShipSteps(game, m.moving);
  const free = steps.find((e) => shipsOnEdge(game, e).length < 2) ?? steps[0];
  return free ? { type: 'epMoveShip', playerId: pid, ship: m.moving, to: free } : null;
}
