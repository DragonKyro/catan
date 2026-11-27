// What the online lobby's choices mean for the game: the base game (any Fun
// Map; 2 players on the standard board), Seafarers (any scenario), Cities &
// Knights (the maps it allows), Traders & Barbarians (any scenario) or
// Explorers & Pirates, plus the rule options (Friendly Robber, balanced dice:
// any game, on by default at 2 players) and the T&B variants (with T&B); the seat range
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
import { supportsNeuralAi } from '@/ai/nn/support';
import { TWO_PLAYER_VP_TO_WIN } from '@/game/createGame';
import type { LobbyGame, LobbyState, LobbyVariants } from '@/net/types';

/** Online games need at least 2 seats (the base game; the rest need 3); the lobby holds up to 8. */
export const MIN_SEATS = 2;
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

export type LobbyVariantId = keyof LobbyVariants;

/** Rule options for any game (on by default at 2 players). */
export const LOBBY_RULE_OPTIONS: LobbyVariantId[] = ['friendlyRobber', 'balancedDice'];
/** Traders & Barbarians variants (offered with a T&B scenario). */
export const LOBBY_TRADERS_VARIANTS: LobbyVariantId[] = ['strongestPorts', 'eventCards'];
const ALL_VARIANTS = [...LOBBY_RULE_OPTIONS, ...LOBBY_TRADERS_VARIANTS];

const VARIANT_LABELS: Record<LobbyVariantId, string> = {
  friendlyRobber: 'Friendly Robber',
  balancedDice: 'Balanced dice',
  strongestPorts: 'Strongest Ports',
  eventCards: 'Catan Event Cards',
};

const NO_VARIANTS: LobbyVariants = { strongestPorts: false, eventCards: false };

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
 * Why an option can't be picked with these rules (createGame refuses the
 * combination), or null when it can: the T&B variants only with a T&B
 * scenario, no Friendly Robber in Explorers & Pirates (no robber), no
 * balanced dice under the Event Cards (they replace the dice).
 */
export function lobbyVariantBlockReason(game: LobbyGame, id: LobbyVariantId): string | null {
  const rules = lobbyRules(game);
  if ((id === 'strongestPorts' || id === 'eventCards') && rules !== 'traders') return 'Traders & Barbarians only';
  if (id === 'friendlyRobber' && rules === 'explorersPirates') return 'Explorers & Pirates has no robber';
  if (id === 'balancedDice' && rules === 'traders' && game.variants.eventCards) return 'The Catan Event Cards replace the dice';
  return null;
}

export function lobbyVariantAllowed(game: LobbyGame, id: LobbyVariantId): boolean {
  return lobbyVariantBlockReason(game, id) === null;
}

/** Whether an option is on: the host's choice, else the default (rule options on at 2 seats). */
export function lobbyVariantOn(lobby: Pick<LobbyState, 'game' | 'seats'>, id: LobbyVariantId): boolean {
  if (!lobbyVariantAllowed(lobby.game, id)) return false;
  const chosen = lobby.game.variants[id];
  if (chosen !== undefined) return chosen;
  return LOBBY_RULE_OPTIONS.includes(id) && lobby.seats.length === 2;
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
  // The T&B variants go with the T&B scenarios; a rule option the rules
  // refuse is simply off (lobbyVariantOn), so it comes back with other rules.
  for (const id of LOBBY_TRADERS_VARIANTS) {
    if (!lobbyVariantAllowed(next, id)) next.variants[id] = false;
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
        ...seats(Math.max(3, m.minPlayers), Math.min(m.maxPlayers, CITIES_AND_KNIGHTS_MAX_PLAYERS)),
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
        recommendedVp: (n) =>
          n === 2 && !game.seafarers
            ? TWO_PLAYER_VP_TO_WIN
            : n >= 5 && s.defaultVpToWin5_6 != null ? s.defaultVpToWin5_6 : vp,
      };
    }
  }
}

/** The options on for the lobby's rules and seats, as labels. */
export function lobbyVariantLabels(lobby: Pick<LobbyState, 'game' | 'seats'>): string[] {
  return ALL_VARIANTS.filter((id) => lobbyVariantOn(lobby, id)).map((id) => VARIANT_LABELS[id]);
}

/** The VP target the host picked (or the recommended one), before the Strongest Ports +1. */
export function lobbyVp(lobby: LobbyState): number {
  return lobby.victoryPointsToWin ?? lobbyScenario(lobby.game).recommendedVp(lobby.seats.length);
}

/** The VP target the game will actually use: createGame adds 1 for Strongest Ports. */
export function lobbyVpTarget(lobby: LobbyState): number {
  return lobbyVp(lobby) + (lobbyVariantOn(lobby, 'strongestPorts') ? 1 : 0);
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
  const on = (id: LobbyVariantId) => lobbyVariantOn({ game, seats: lobby.seats }, id);
  const tv = { friendlyRobber: on('friendlyRobber'), strongestPorts: on('strongestPorts'), eventCards: on('eventCards') };
  const tradersVariants = tv.friendlyRobber || tv.strongestPorts || tv.eventCards ? tv : undefined;
  const balancedDice = on('balancedDice');
  const neural = supportsNeuralAi({ expansions, baseScenarioId, tradersVariants, numPlayers: lobby.seats.length });
  return {
    victoryPointsToWin: lobbyVp({ ...lobby, game }),
    expansions,
    scenarioId: rules === 'seafarers' ? game.scenarioId : undefined,
    baseScenarioId,
    tradersScenarioId: rules === 'traders' ? game.tradersScenarioId : undefined,
    tradersVariants,
    ...(balancedDice ? { balancedDice: true } : {}),
    aiLevel: neural ? 'hard' : undefined,
  };
}

/** Whether the AI seats play the trained network (it only plays the base game on the standard map). */
export function lobbyUsesTrainedAi(lobby: LobbyState): boolean {
  return lobbySettings(lobby).aiLevel !== undefined;
}
