import type { Commodity, ImprovementTrack, KnightStrength } from '../../types';

export const CITIES_AND_KNIGHTS_EXPANSION_ID = 'citiesAndKnights';

// Per-player knight supply: 2 of each strength.
export const KNIGHT_SUPPLY_PER_STRENGTH = 2;

// Max city-improvement level. Levels 1-3 just gate progress card draws +
// give the level-3 ability; 4/5 confer the metropolis.
export const MAX_IMPROVEMENT_LEVEL = 5;
export const MIN_METROPOLIS_LEVEL = 4;

// Progress card hand limit (per rulebook p.10).
export const PROGRESS_CARD_HAND_LIMIT = 4;

// Aqueduct / Merchant Guild / Fortress unlock at level 3.
export const LEVEL3_ABILITY_THRESHOLD = 3;

// Track display info used by the cost cheatsheet and improvement panel.
export const TRACK_LABEL: Record<ImprovementTrack, string> = {
  science: 'Science',
  trade: 'Trade',
  politics: 'Politics',
};

export const TRACK_EMOJI: Record<ImprovementTrack, string> = {
  science: '📚',
  trade: '⚖️',
  politics: '🤝',
};

export const KNIGHT_LABEL: Record<KnightStrength, string> = {
  1: 'Basic Knight',
  2: 'Strong Knight',
  3: 'Mighty Knight',
};

// Number of spaces on the barbarian track. The ship starts at 0 and attacks
// when it reaches this number — exactly 7 barbarian events between attacks.
export const BARBARIAN_TRACK_LENGTH = 7;

// Each player may build at most 3 city walls.
export const MAX_CITY_WALLS = 3;

// Each wall raises the discard-threshold by this much. With max walls (3) a
// player can hold up to 7 + 3*2 = 13 cards without discarding on a 7.
export const CITY_WALL_HAND_BONUS = 2;

// Rulebook official VP target for Cities & Knights games. Overridable via
// settings.victoryPointsToWin when needed.
export const CITIES_AND_KNIGHTS_DEFAULT_VP = 13;

// Commodity bank size per commodity. Rulebook ships 12 cards each.
export const COMMODITY_BANK_SIZE = 12;

// Display emoji for each commodity (used by HandPanel, OpponentPanel,
// BankPanel, CostCheatsheet). Kept on the engine side so the same icon is
// used everywhere without a UI-side duplicate map.
export const COMMODITY_EMOJI: Record<Commodity, string> = {
  paper: '📜',
  cloth: '🧵',
  coin: '🪙',
};

export const COMMODITY_LABEL: Record<Commodity, string> = {
  paper: 'Paper',
  cloth: 'Cloth',
  coin: 'Coin',
};
