import type { Commodity } from '../../types';

export const CITIES_AND_KNIGHTS_EXPANSION_ID = 'citiesAndKnights';

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
