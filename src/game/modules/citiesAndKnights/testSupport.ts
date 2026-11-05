// Test-only helpers for Cities & Knights rule tests. Not imported by
// production code.
import type {
  CommodityBank,
  EventDieFace,
  GameState,
  ImprovementTrack,
  KnightStrength,
  PlayerId,
  ProgressCardKind,
  VertexId,
} from '../../types';
import { EVENT_DIE_FACES } from '../../types';
import { createGame } from '../../createGame';
import { applyAction } from '../../engine';
import { runSetupPhase } from '../../__testHelpers';
import { rngInt } from '../../rng';
import { updatePlayer } from '../../helpers';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from './constants';

export function ckGame(numPlayers = 3, seed = 42): GameState {
  return createGame({
    playerNames: Array.from({ length: numPlayers }, (_, i) => `P${i}`),
    seed,
    randomizeTurnOrder: false,
    settings: { expansions: [CITIES_AND_KNIGHTS_EXPANSION_ID] },
  });
}

export function ckAfterSetup(numPlayers = 3, seed = 42): GameState {
  return runSetupPhase(ckGame(numPlayers, seed));
}

// Pick an rngState whose next event-die roll shows `face`.
export function withEventDie(state: GameState, face: EventDieFace): GameState {
  for (let s = 1; s < 100000; s++) {
    const [idx] = rngInt(s, EVENT_DIE_FACES.length);
    if (EVENT_DIE_FACES[idx] === face) return { ...state, rngState: s };
  }
  throw new Error('no rng state found');
}

export function roll(
  state: GameState,
  dice: [number, number],
  face: EventDieFace = 'science',
): GameState {
  const pid = state.playerOrder[state.currentPlayerIndex]!;
  return applyAction(withEventDie(state, face), { type: 'rollDice', playerId: pid, dice });
}

// Roll a harmless total (an 11 with the given face) to reach the Action phase.
export function toMain(state: GameState, face: EventDieFace = 'science'): GameState {
  return roll(state, [5, 6], face);
}

export function setCommodities(
  state: GameState,
  pid: PlayerId,
  c: Partial<CommodityBank>,
): GameState {
  return updatePlayer(state, pid, (p) => ({
    ...p,
    commodities: { paper: 0, cloth: 0, coin: 0, ...c },
  }));
}

export function setImprovements(
  state: GameState,
  pid: PlayerId,
  levels: Partial<Record<ImprovementTrack, number>>,
): GameState {
  return updatePlayer(state, pid, (p) => ({
    ...p,
    improvements: { science: 0, trade: 0, politics: 0, ...p.improvements, ...levels },
  }));
}

export function giveProgressCard(
  state: GameState,
  pid: PlayerId,
  track: ImprovementTrack,
  card: ProgressCardKind,
): GameState {
  return updatePlayer(state, pid, (p) => {
    const hand = p.progressCards ?? { science: [], trade: [], politics: [] };
    return { ...p, progressCards: { ...hand, [track]: [...hand[track], card] } };
  });
}

// Drop a knight straight onto the board (taken from the owner's supply).
export function putKnight(
  state: GameState,
  pid: PlayerId,
  vertex: VertexId,
  strength: KnightStrength = 1,
  active = false,
): GameState {
  const supply = state.knightSupply?.[pid] ?? { 1: 2, 2: 2, 3: 2 };
  return {
    ...state,
    knights: { ...(state.knights ?? {}), [vertex]: { playerId: pid, strength, active } },
    knightSupply: { ...(state.knightSupply ?? {}), [pid]: { ...supply, [strength]: supply[strength] - 1 } },
  };
}

// An empty vertex at the end of one of `pid`'s roads.
export function roadEndSpot(state: GameState, pid: PlayerId): VertexId {
  const p = state.players.find((pl) => pl.id === pid)!;
  for (const eid of p.roads) {
    for (const v of state.board.edges[eid]!.vertices) {
      if (state.knights?.[v]) continue;
      if (state.players.some((pl) => pl.settlements.includes(v) || pl.cities.includes(v))) continue;
      return v;
    }
  }
  throw new Error('no free road end');
}

// Make `pid` the active player in the Action phase (keeps everything else).
export function activeMain(state: GameState, pid: PlayerId): GameState {
  return {
    ...state,
    currentPlayerIndex: state.playerOrder.indexOf(pid),
    turnHolderIndex: state.playerOrder.indexOf(pid),
    phase: 'main',
    hasRolledThisTurn: true,
  };
}
