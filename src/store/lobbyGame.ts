// What the online lobby's choices mean for the game: base game (any Fun Map)
// or Seafarers (any scenario), the seat range each allows, the VP target, and
// the createGame settings. Shared by networkStore (to start the game) and the
// lobby screen (to show it).

import type { GameSettings } from '@/game/types';
import {
  DEFAULT_SCENARIO_ID,
  SCENARIO_ORDER,
  getScenario,
} from '@/game/modules/seafarers/board/scenarios';
import {
  BASE_SCENARIO_ORDER,
  DEFAULT_BASE_SCENARIO_ID,
  getBaseScenario,
} from '@/game/modules/base/scenarios';
import { DEFAULT_AI_LEVEL, supportsNeuralAi } from '@/ai/nn';
import type { LobbyGame, LobbyState } from '@/net/types';

/** Online games need at least 3 seats (official rules); the lobby holds up to 8. */
export const MIN_SEATS = 3;
export const MAX_SEATS = 8;

export const ONLINE_SEAFARERS_SCENARIOS = SCENARIO_ORDER;
export const ONLINE_BASE_MAPS = BASE_SCENARIO_ORDER;

export function defaultLobbyGame(): LobbyGame {
  return { seafarers: false, scenarioId: DEFAULT_SCENARIO_ID, baseScenarioId: DEFAULT_BASE_SCENARIO_ID };
}

export interface LobbyScenarioInfo {
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Recommended VP target for `seats` players. */
  recommendedVp: (seats: number) => number;
}

export function lobbyScenario(game: LobbyGame): LobbyScenarioInfo {
  const s = game.seafarers ? getScenario(game.scenarioId) : getBaseScenario(game.baseScenarioId);
  const vp = s.defaultVpToWin ?? 10;
  return {
    name: game.seafarers ? `Seafarers: ${s.name}` : s.name === 'Standard' ? 'Base game' : `Base game: ${s.name}`,
    minPlayers: Math.max(MIN_SEATS, s.minPlayers),
    maxPlayers: Math.min(MAX_SEATS, s.maxPlayers),
    recommendedVp: (seats) => (seats >= 5 && s.defaultVpToWin5_6 != null ? s.defaultVpToWin5_6 : vp),
  };
}

/** The VP target the game will use with the lobby's current seats. */
export function lobbyVp(lobby: LobbyState): number {
  return lobby.victoryPointsToWin ?? lobbyScenario(lobby.game).recommendedVp(lobby.seats.length);
}

/** Why the host can't start yet, or null when they can. */
export function lobbyStartProblem(lobby: LobbyState): string | null {
  const info = lobbyScenario(lobby.game);
  const n = lobby.seats.length;
  if (n >= info.minPlayers && n <= info.maxPlayers) return null;
  const range = info.minPlayers === info.maxPlayers ? `${info.minPlayers}` : `${info.minPlayers}–${info.maxPlayers}`;
  return `${info.name} needs ${range} players (${n} seated).`;
}

/** createGame settings for the lobby's choices. */
export function lobbySettings(lobby: LobbyState): Partial<GameSettings> {
  const expansions = lobby.game.seafarers ? ['seafarers'] : [];
  const baseScenarioId = lobby.game.seafarers ? undefined : lobby.game.baseScenarioId;
  const neural = supportsNeuralAi({ expansions, baseScenarioId });
  return {
    victoryPointsToWin: lobbyVp(lobby),
    expansions,
    scenarioId: lobby.game.seafarers ? lobby.game.scenarioId : undefined,
    baseScenarioId,
    aiLevel: neural ? (lobby.aiLevel ?? DEFAULT_AI_LEVEL) : undefined,
  };
}

/** Whether the AI difficulty choice applies (the trained AI only plays the base game on the standard map). */
export function lobbyHasAiLevels(lobby: LobbyState): boolean {
  return lobbySettings(lobby).aiLevel !== undefined;
}
