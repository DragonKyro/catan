// Test-only helpers for Explorers & Pirates (rule tests, AI sims, network
// tests). Not imported by production code.

import type {
  EdgeId,
  EpCargo,
  EpShip,
  ExplorersPiratesState,
  GameState,
  HexId,
  PlayerId,
  VertexId,
} from '../../types';
import { createGame } from '../../createGame';
import { applyAction } from '../../engine';
import { edgeKey } from '../../board/coords';
import { canPlaceInitialRoad, canPlaceInitialSettlement } from '../../placement';
import { EXPLORERS_PIRATES_EXPANSION_ID } from './constants';
import { epSetupShipEdges } from './setup';
import type { EpGame } from './state';

export function epGame(seed = 1, players = 3, extra: { ai?: boolean } = {}): EpGame {
  return createGame({
    playerNames: ['A', 'B', 'C', 'D'].slice(0, players),
    playerTypes: extra.ai ? Array(players).fill('ai') : undefined,
    seed,
    settings: { expansions: [EXPLORERS_PIRATES_EXPANSION_ID] },
    randomizeTurnOrder: false,
  }) as EpGame;
}

// Play the three setup rounds with the first legal spot each time.
export function runEpSetup(state: GameState): EpGame {
  let s = state;
  for (let guard = 0; guard < 100 && s.phase.startsWith('setupRound'); guard++) {
    const pid = s.playerOrder[s.currentPlayerIndex]!;
    const step = s.setupState!.step;
    if (step === 'settlement') {
      const v = s.board.vertexIds.find((x) => canPlaceInitialSettlement(s, x))!;
      s = applyAction(s, { type: 'placeInitialSettlement', playerId: pid, vertex: v });
    } else if (step === 'road') {
      const anchor = s.setupState!.lastPlacedSettlement!;
      const e = s.board.vertices[anchor]!.edges.find((x) => canPlaceInitialRoad(s, anchor, x))!;
      s = applyAction(s, { type: 'placeInitialRoad', playerId: pid, edge: e });
    } else {
      const e = epSetupShipEdges(s, pid)[0]!;
      s = applyAction(s, { type: 'placeInitialShip', playerId: pid, edge: e });
    }
  }
  return s as EpGame;
}

// After setup, p0 rolled `dice` (default a 4 with nothing special).
export function epMainPhase(seed = 1, players = 3, dice: [number, number] = [1, 3]): EpGame {
  let s: GameState = runEpSetup(epGame(seed, players));
  s = applyAction(s, { type: 'rollDice', playerId: 'p0', dice });
  return s as EpGame;
}

export function patchEpState(s: GameState, fn: (ep: ExplorersPiratesState) => Partial<ExplorersPiratesState>): EpGame {
  return { ...s, explorersPirates: { ...s.explorersPirates!, ...fn(s.explorersPirates!) } } as EpGame;
}

export function setPlayer(s: GameState, pid: PlayerId, patch: Partial<GameState['players'][number]>): EpGame {
  return { ...s, players: s.players.map((p) => (p.id === pid ? { ...p, ...patch } : p)) } as EpGame;
}

// Put a ship on the board (replacing one with the same id).
export function putShip(s: GameState, ship: Partial<EpShip> & { owner: PlayerId; edge: EdgeId }): EpGame {
  const ep = s.explorersPirates!;
  const id = ship.id ?? `t${ep.nextShipId}`;
  const full: EpShip = { id, owner: ship.owner, edge: ship.edge, cargo: ship.cargo ?? [] };
  return patchEpState(s, (e) => ({
    ships: [...e.ships.filter((x) => x.id !== id), full],
    nextShipId: e.nextShipId + 1,
  }));
}

export function clearShips(s: GameState): EpGame {
  return patchEpState(s, () => ({ ships: [] }));
}

// Turn a hidden hex face up as a given tile (rewriting what's under it).
export function setHidden(
  s: GameState,
  hex: HexId,
  tile: Partial<ExplorersPiratesState['hidden'][string]>,
): EpGame {
  return patchEpState(s, (e) => ({ hidden: { ...e.hidden, [hex]: { ...e.hidden[hex]!, ...tile } } }));
}

export const hexAt = (s: GameState, q: number, r: number) => s.board.hexes[`${q},${r}`]!;
// Corner c (0 NE, 1 SE, 2 S, 3 SW, 4 NW, 5 N) and edge d (0 E … 5 NE).
export const cornerOf = (s: GameState, q: number, r: number, c: number): VertexId => hexAt(s, q, r).corners[c]!;
export const edgeOf = (s: GameState, q: number, r: number, d: number): EdgeId =>
  edgeKey(hexAt(s, q, r).corners[d]!, hexAt(s, q, r).corners[(d + 1) % 6]!);

export function cargo(...pieces: EpCargo[]): EpCargo[] {
  return pieces;
}
