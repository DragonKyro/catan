// Traders & Barbarians expansion constants.

export const TRADERS_EXPANSION_ID = 'traders';

// Scenario identifiers.
export const TRADERS_SCENARIO_RIVERS = 'riversOfCatan';
export const TRADERS_SCENARIO_FISHING = 'fishingOnCatan';
export const TRADERS_SCENARIO_MERCHANT_TRAINS = 'merchantTrains';
export const TRADERS_SCENARIO_BARBARIAN_ATTACK = 'barbarianAttack';
export const TRADERS_SCENARIO_TRADERS_BARBARIANS = 'tradersAndBarbarians';

// Merchant Trains: rulebook ships 22 wagon tokens in a shared neutral
// supply. Each successful `placeWagon` action draws one.
export const MERCHANT_WAGON_SUPPLY = 22;
// T&B 5-6 adds 11 trade wagons (rulebook p. 7): 33.
export const MERCHANT_WAGON_SUPPLY_5_6 = 33;

// Merchant Trains victory-point target (rulebook: "If you have 12 or more
// VPs at any point during your turn, the game ends and you are the winner!").
export const MERCHANT_TRAINS_DEFAULT_VP = 12;

// Bid resources. Only wool (sheep) and wheat may be wagered in the voting
// round. Other resources are rejected by `handleSubmitWagonVote`.
export const MERCHANT_BID_RESOURCES = ['sheep', 'wheat'] as const;

// Fishing on Catan: cap on fish tokens a player may hold, not counting the
// old boot (rulebook). A draw that would go past it stops the player's
// drawing; they may then swap one token for a fresh draw ('fishSwap').
export const FISH_TOKEN_CAP = 7;

// Fish-token face values (cost units). Old boot has no value — never
// participates in spending.
export const FISH_TOKEN_VALUE: Record<'one' | 'two' | 'three', number> = {
  one: 1,
  two: 2,
  three: 3,
};

// Fish spend costs (rulebook). Each spend action requires tokens summing to
// at least this value; excess fish is forfeit.
export const FISH_COST_REMOVE_ROBBER = 2;
export const FISH_COST_STEAL = 3;
export const FISH_COST_TAKE_FROM_BANK = 4;
export const FISH_COST_BUILD_ROAD = 5;
export const FISH_COST_BUY_DEV_CARD = 7;

// Old boot VP penalty: the holder needs +1 VP to win (rulebook).
export const OLD_BOOT_VP_TAX = 1;

// Bridge build payoff (rules: +3 gold per built bridge).
export const BRIDGE_GOLD_REWARD = 3;

// Bridges per player (3 in each colour).
export const MAX_BRIDGES = 3;

// Coins: 2 gold buys 1 resource card of your choice, at most twice a turn.
export const GOLD_PER_RESOURCE = 2;
export const MAX_GOLD_SPENDS_PER_TURN = 2;

// River-tile build payoff (rules: +1 gold per road or settlement built on a
// river-tile edge / vertex). Bridges have their own larger reward above.
export const RIVER_BUILD_GOLD_REWARD = 1;

// Strongest Ports threshold: holder must have ≥ this many VPs worth of
// buildings on ports (settlement = 1, city = 2). Rulebook says "3 VPs in
// buildings on ports."
export const STRONGEST_PORTS_MIN_VP = 3;

// Strongest Ports tile is worth this many VPs. The variant also bumps the
// game's VP target by 1, so the net effect on game length is roughly neutral.
export const STRONGEST_PORTS_VP = 2;

// Wealthiest / Poor Catanian VP swings.
export const WEALTHIEST_CATANIAN_VP = 1;
export const POOR_CATANIAN_VP = -2;

// Barbarian Attack (rulebook pp.15-19).
export const BARBARIAN_ATTACK_DEFAULT_VP = 12;
// 36 barbarian figures: 1 starts on the 2 hex, 1 on the 12 hex, the rest
// next to the board.
export const BARBARIAN_TOTAL = 36;
// T&B 5-6 adds 12 more (rulebook p. 2 / p. 8).
export const BARBARIAN_TOTAL_5_6 = 48;
// Three barbarians on a coastal hex conquer it.
export const BARBARIANS_TO_CONQUER = 3;
// Barbarians placed (dice rolls) after each building placed.
export const BARBARIAN_LANDING_ROLLS = 3;
// Knights in each player's colour.
export const BARBARIAN_KNIGHTS_PER_PLAYER = 6;
// End-of-turn knight move: up to 3 edges, or 5 for 1 wheat.
export const BARBARIAN_KNIGHT_MOVE = 3;
export const BARBARIAN_KNIGHT_MOVE_BOOSTED = 5;
export const BARBARIAN_KNIGHT_BOOST_COST = { wheat: 1 } as const;
// Gold for an involved player left without a prisoner, and per knight lost.
export const BARBARIAN_CONSOLATION_GOLD = 3;
export const BARBARIAN_KNIGHT_LOSS_GOLD = 3;
// Treason pays 2 gold.
export const BARBARIAN_TREASON_GOLD = 2;
// Every 2 prisoners = 1 VP.
export const BARBARIAN_PRISONERS_PER_VP = 2;
// The scenario's development deck (26 cards).
export const BARBARIAN_DECK_COUNTS = {
  capture: 4,
  knighthood: 14,
  swiftKnight: 4,
  treason: 4,
} as const;
