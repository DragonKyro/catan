// What the online lobby's choices mean for the game: the base game (any Fun
// Map), Seafarers (any scenario), Cities & Knights (the maps it allows),
// Traders & Barbarians (any scenario) or Explorers & Pirates, plus the T&B
// variants; the seat range
// each allows, the VP target, and the createGame settings. Shared by
// networkStore (to start the game) and the lobby screen (to show it). The
// rules mirror the New Game screen (ui/newGame/ExpansionPicker + NewGame).

import type { GameSettings } from '@/game/types';
import {
  DEFAULT_SCENARIO_ID,
  SCENARIO_ORDER,
  getScenario,
} from '@/game/modules/seafarers/board/scenarios';
import {
  BASE_SCENARIO_ORDER,
  DEFAULT_BASE_SCENARIO_ID,
  baseScenarioAllowed,
  getBaseScenario,
} from '@/game/modules/base/scenarios';
import {
  TRADERS_SCENARIO_ORDER,
  getTradersScenario,
} from '@/game/modules/traders/board/scenarios';
import { SEAFARERS_EXPANSION_ID } from '@/game/modules/seafarers/constants';
import {
  CITIES_AND_KNIGHTS_DEFAULT_VP,
  CITIES_AND_KNIGHTS_EXPANSION_ID,
  CITIES_AND_KNIGHTS_MAX_PLAYERS,
} from '@/game/modules/citiesAndKnights/constants';
import { TRADERS_EXPANSION_ID } from '@/game/modules/traders/constants';
import {
  EP_DEFAULT_VP,
  EP_MAX_PLAYERS,
  EP_MIN_PLAYERS,
  EXPLORERS_PIRATES_EXPANSION_ID,
} from '@/game/modules/explorersPirates/constants';
import { DEFAULT_AI_LEVEL, supportsNeuralAi } from '@/ai/nn';
import type { LobbyGame, LobbyState, LobbyVariants } from '@/net/types';

/** Online games need at least 3 seats (official rules); the lobby holds up to 8. */
export const MIN_SEATS = 3;
export const MAX_SEATS = 8;

export const ONLINE_SEAFARERS_SCENARIOS = SCENARIO_ORDER;
export const ONLINE_TRADERS_SCENARIOS = TRADERS_SCENARIO_ORDER;
/** Every base map; `lobbyBaseMaps` narrows it to what the chosen rules allow. */
export const ONLINE_BASE_MAPS = BASE_SCENARIO_ORDER;

/** The rule sets the lobby offers (one expansion at a time, as offline). */
export type LobbyRules = 'base' | 'seafarers' | 'citiesKnights' | 'traders' | 'explorersPirates';

export const LOBBY_RULES: { id: LobbyRules; label: string }[] = [
  { id: 'base', label: 'Base game' },
  { id: 'seafarers', label: 'Seafarers' },
  { id: 'citiesKnights', label: 'Cities & Knights' },
  { id: 'traders', label: 'Traders & Barbarians' },
  { id: 'explorersPirates', label: 'Explorers & Pirates' },
];

export const LOBBY_VARIANTS: { id: keyof LobbyVariants; label: string; title: string }[] = [
  {
    id: 'friendlyRobber',
    label: 'Friendly Robber',
    title: 'The robber may not go to a hex with a building of a player who has only 2 VPs',
  },
  {
    id: 'strongestPorts',
    label: 'Strongest Ports (+1 VP target)',
    title: '3+ VPs in buildings on harbors takes a 2 VP tile; a player with more takes it over',
  },
  {
    id: 'eventCards',
    label: 'Catan Event Cards',
    title: 'Flip an event card each turn instead of rolling: resolve its event, then produce for its number',
  },
];

const NO_VARIANTS: LobbyVariants = { friendlyRobber: false, strongestPorts: false, eventCards: false };

export function defaultLobbyGame(): LobbyGame {
  return {
    seafarers: false,
    scenarioId: DEFAULT_SCENARIO_ID,
    baseScenarioId: DEFAULT_BASE_SCENARIO_ID,
    citiesKnights: false,
    traders: false,
    tradersScenarioId: TRADERS_SCENARIO_ORDER[0]?.id ?? 'riversOfCatan',
    explorersPirates: false,
    variants: { ...NO_VARIANTS },
  };
}

export function lobbyRules(game: LobbyGame): LobbyRules {
  if (game.seafarers) return 'seafarers';
  if (game.citiesKnights) return 'citiesKnights';
  if (game.traders) return 'traders';
  if (game.explorersPirates) return 'explorersPirates';
  return 'base';
}

function lobbyExpansions(game: LobbyGame): string[] {
  switch (lobbyRules(game)) {
    case 'seafarers':
      return [SEAFARERS_EXPANSION_ID];
    case 'citiesKnights':
      return [CITIES_AND_KNIGHTS_EXPANSION_ID];
    case 'traders':
      return [TRADERS_EXPANSION_ID];
    case 'explorersPirates':
      return [EXPLORERS_PIRATES_EXPANSION_ID];
    case 'base':
      return [];
  }
}

/**
 * Why a variant can't be picked with these rules (createGame refuses the
 * combination), or null when it can: Event Cards with Cities & Knights, any
 * variant with Explorers & Pirates (no robber, harbors or plain dice roll).
 */
export function lobbyVariantBlockReason(game: LobbyGame, id: keyof LobbyVariants): string | null {
  const rules = lobbyRules(game);
  if (rules === 'explorersPirates') return "Can't be combined with Explorers & Pirates";
  if (id === 'eventCards' && rules === 'citiesKnights') return "Can't be combined with Cities & Knights yet";
  return null;
}

export function lobbyVariantAllowed(game: LobbyGame, id: keyof LobbyVariants): boolean {
  return lobbyVariantBlockReason(game, id) === null;
}

/**
 * Make a lobby choice consistent: at most one expansion, a base map the rules
 * allow (the C&K first-game board needs C&K; Gold Rush / Volcano can't take
 * it), and no variant the rules refuse.
 */
export function normalizeLobbyGame(game: LobbyGame): LobbyGame {
  const rules = lobbyRules(game);
  const next: LobbyGame = {
    ...defaultLobbyGame(),
    ...game,
    seafarers: rules === 'seafarers',
    citiesKnights: rules === 'citiesKnights',
    traders: rules === 'traders',
    explorersPirates: rules === 'explorersPirates',
    variants: { ...NO_VARIANTS, ...game.variants },
  };
  if (!baseScenarioAllowed(getBaseScenario(next.baseScenarioId), lobbyExpansions(next))) {
    next.baseScenarioId = DEFAULT_BASE_SCENARIO_ID;
  }
  for (const v of LOBBY_VARIANTS) {
    if (!lobbyVariantAllowed(next, v.id)) next.variants[v.id] = false;
  }
  return next;
}

/** Switch the lobby to other rules, keeping the other choices where they still apply. */
export function withLobbyRules(game: LobbyGame, rules: LobbyRules): LobbyGame {
  return normalizeLobbyGame({
    ...game,
    seafarers: rules === 'seafarers',
    citiesKnights: rules === 'citiesKnights',
    traders: rules === 'traders',
    explorersPirates: rules === 'explorersPirates',
  });
}

/** The base maps the lobby's rules allow (base game or Cities & Knights). */
export function lobbyBaseMaps(game: LobbyGame): { id: string; label: string }[] {
  const expansions = lobbyExpansions(game);
  return ONLINE_BASE_MAPS.filter((m) => baseScenarioAllowed(getBaseScenario(m.id), expansions));
}

export interface LobbyScenarioInfo {
  name: string;
  minPlayers: number;
  maxPlayers: number;
  /** Recommended VP target for `seats` players (before the Strongest Ports +1). */
  recommendedVp: (seats: number) => number;
}

export function lobbyScenario(game: LobbyGame): LobbyScenarioInfo {
  const seats = (min: number, max: number) => ({
    minPlayers: Math.max(MIN_SEATS, min),
    maxPlayers: Math.min(MAX_SEATS, max),
  });
  switch (lobbyRules(game)) {
    case 'explorersPirates':
      return {
        name: 'Explorers & Pirates',
        ...seats(EP_MIN_PLAYERS, EP_MAX_PLAYERS),
        recommendedVp: () => EP_DEFAULT_VP,
      };
    case 'traders': {
      const s = getTradersScenario(game.tradersScenarioId);
      const vp = s.defaultVpToWin ?? 10;
      return {
        name: `Traders & Barbarians: ${s.name}`,
        ...seats(s.minPlayers, s.maxPlayers),
        recommendedVp: () => vp,
      };
    }
    case 'citiesKnights': {
      const m = getBaseScenario(game.baseScenarioId);
      return {
        name: m.id === DEFAULT_BASE_SCENARIO_ID ? 'Cities & Knights' : `Cities & Knights: ${m.name}`,
        ...seats(m.minPlayers, Math.min(m.maxPlayers, CITIES_AND_KNIGHTS_MAX_PLAYERS)),
        recommendedVp: () => CITIES_AND_KNIGHTS_DEFAULT_VP,
      };
    }
    case 'seafarers':
    case 'base': {
      const s = game.seafarers ? getScenario(game.scenarioId) : getBaseScenario(game.baseScenarioId);
      const vp = s.defaultVpToWin ?? 10;
      return {
        name: game.seafarers ? `Seafarers: ${s.name}` : s.name === 'Standard' ? 'Base game' : `Base game: ${s.name}`,
        ...seats(s.minPlayers, s.maxPlayers),
        recommendedVp: (n) => (n >= 5 && s.defaultVpToWin5_6 != null ? s.defaultVpToWin5_6 : vp),
      };
    }
  }
}

/** The variants on (and allowed) for the lobby's rules, as labels. */
export function lobbyVariantLabels(game: LobbyGame): string[] {
  return LOBBY_VARIANTS.filter((v) => game.variants[v.id] && lobbyVariantAllowed(game, v.id)).map(
    (v) => v.label.replace(/ \(.*\)$/, ''),
  );
}

/** The VP target the host picked (or the recommended one), before the Strongest Ports +1. */
export function lobbyVp(lobby: LobbyState): number {
  return lobby.victoryPointsToWin ?? lobbyScenario(lobby.game).recommendedVp(lobby.seats.length);
}

/** The VP target the game will actually use: createGame adds 1 for Strongest Ports. */
export function lobbyVpTarget(lobby: LobbyState): number {
  return lobbyVp(lobby) + (lobby.game.variants.strongestPorts ? 1 : 0);
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
  const game = normalizeLobbyGame(lobby.game);
  const rules = lobbyRules(game);
  const expansions = lobbyExpansions(game);
  const baseScenarioId = rules === 'base' || rules === 'citiesKnights' ? game.baseScenarioId : undefined;
  const anyVariant = LOBBY_VARIANTS.some((v) => game.variants[v.id]);
  const tradersVariants = anyVariant ? { ...game.variants } : undefined;
  const neural = supportsNeuralAi({ expansions, baseScenarioId, tradersVariants });
  return {
    victoryPointsToWin: lobbyVp({ ...lobby, game }),
    expansions,
    scenarioId: rules === 'seafarers' ? game.scenarioId : undefined,
    baseScenarioId,
    tradersScenarioId: rules === 'traders' ? game.tradersScenarioId : undefined,
    tradersVariants,
    aiLevel: neural ? (lobby.aiLevel ?? DEFAULT_AI_LEVEL) : undefined,
  };
}

/** Whether the AI difficulty choice applies (the trained AI only plays the base game on the standard map). */
export function lobbyHasAiLevels(lobby: LobbyState): boolean {
  return lobbySettings(lobby).aiLevel !== undefined;
}
