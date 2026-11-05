import type { EpCargo, EpMission, ResourceBank } from '../../types';

// Explorers & Pirates (2025 rulebook). Everything here is printed on the
// player aid, the trade rate tile or the mission track frame pieces.

export const EXPLORERS_PIRATES_EXPANSION_ID = 'explorersPirates';
export const EXPLORERS_PIRATES_SCENARIO_ID = 'explorersPirates';

export const EP_DEFAULT_VP = 17;
export const EP_MIN_PLAYERS = 3;
export const EP_MAX_PLAYERS = 4;

// Building costs (player aid). Road and settlement use the base COSTS; a
// settler costs the same as a settlement.
export const EP_COSTS: Record<'harbor' | 'ship' | 'settler' | 'crew' | 'boost', Partial<ResourceBank>> = {
  harbor: { wheat: 2, ore: 2 },
  ship: { wood: 1, sheep: 1 },
  settler: { brick: 1, wood: 1, sheep: 1, wheat: 1 },
  crew: { sheep: 1, ore: 1 },
  // Extra ship move: 1 wool per ship per turn.
  boost: { sheep: 1 },
};

// Pieces per player.
export const EP_PIECES = {
  roads: 15,
  settlements: 5,
  harbors: 4,
  ships: 3,
  settlers: 2,
  crews: 9,
} as const;

export const EP_START_GOLD = 2;
// "If you do not receive any resources from producing hexes, you receive
// 1 gold from the supply instead."
export const EP_NOTHING_PRODUCED_GOLD = 1;
// A captured gold field produces 2 gold for each building on it.
export const EP_GOLD_FIELD_GOLD = 2;
// Exploring a hex with no matching resource (gold field, spice farm, fish
// shoal, sea) pays 2 gold.
export const EP_EXPLORE_GOLD = 2;
// Supply trades are 3:1 (resource or 1 gold); 2 gold buys a resource twice
// a turn (the T&B coin actions, which read these through coinsInPlay).
export const EP_SUPPLY_RATE = 3;

// Ships: 4 MP, +2 for 1 wool, +1 per Swift Voyage crew. Two ships per edge.
export const EP_SHIP_MP = 4;
export const EP_BOOST_MP = 2;
export const EP_SHIPS_PER_EDGE = 2;
// Ships and harbor settlements hold 1 large or 2 small pieces.
export const EP_CAPACITY = 2;
export const EP_CARGO_SIZE: Record<EpCargo, number> = {
  settler: 2,
  fish: 2,
  crew: 1,
  spice: 1,
};

// Tribute for moving onto, off of or around the pirate's hex.
export const EP_TRIBUTE_GOLD = 1;
// Chasing the pirate away: a 6, or the Pirate Bonus farm's number.
export const EP_CHASE_ROLL = 6;

// Pirate lairs: the third crew captures it; every involved player gets 2
// gold and one track space, the hero one more.
export const EP_LAIR_CREWS = 3;
export const EP_LAIR_GOLD = 2;

export const EP_FISH_HAULS = 6;

// Mission tracks: VP printed next to each space (space 1 first). A marker
// on the start space scores nothing. The track's leader holds its 1 VP
// bonus tile (ties: the marker that got there first keeps it).
export const EP_TRACK_VP: Record<EpMission, readonly number[]> = {
  pirateLairs: [1, 1, 2, 2, 2, 3, 3],
  fish: [1, 1, 2, 2, 2, 3, 3],
  spice: [1, 1, 2, 2, 3, 3],
};
export const EP_BONUS_TILE_VP = 1;
export const EP_MISSIONS: readonly EpMission[] = ['pirateLairs', 'fish', 'spice'];

export const EP_MISSION_NAMES: Record<EpMission, string> = {
  pirateLairs: 'Pirate Lairs',
  fish: 'Fish for Catan',
  spice: 'Spices for Catan',
};
export const EP_BONUS_TILE_NAMES: Record<EpMission, string> = {
  pirateLairs: 'Greatest Pirate Scourge',
  fish: 'Best Fisher',
  spice: 'Greatest Spice Merchant',
};
