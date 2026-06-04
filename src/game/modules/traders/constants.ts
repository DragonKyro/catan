// Traders & Barbarians expansion constants.

export const TRADERS_EXPANSION_ID = 'traders';

// Scenario identifiers.
export const TRADERS_SCENARIO_RIVERS = 'riversOfCatan';
export const TRADERS_SCENARIO_FISHING = 'fishingOnCatan';
export const TRADERS_SCENARIO_MERCHANT_TRAINS = 'merchantTrains';
export const TRADERS_SCENARIO_BARBARIAN_ATTACK = 'barbarianAttack';

// Merchant Trains: rulebook ships 22 wagon tokens in a shared neutral
// supply. Each successful `placeWagon` action draws one.
export const MERCHANT_WAGON_SUPPLY = 22;

// Merchant Trains victory-point target (rulebook: "If you have 12 or more
// VPs at any point during your turn, the game ends and you are the winner!").
export const MERCHANT_TRAINS_DEFAULT_VP = 12;

// Bid resources. Only wool (sheep) and wheat may be wagered in the voting
// round. Other resources are rejected by `handleSubmitWagonVote`.
export const MERCHANT_BID_RESOURCES = ['sheep', 'wheat'] as const;

// Fishing on Catan: cap on fish tokens a player may hold (rulebook). Excess
// draws are blocked once the cap is reached; the per-turn discard-and-
// replace nicety is deferred.
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

// Barbarian Attack defaults.
export const BARBARIAN_ATTACK_DEFAULT_VP = 12;
// Shared supply of defender knights. 18 = 6 per max player; finite to keep
// scarcity bite even if everyone hires aggressively.
export const BARBARIAN_KNIGHT_SUPPLY = 18;
// Length of each barbarian path including the castle hex as the final
// index. So with 4 hexes, position 0 = farthest, position 3 = at the
// castle (combat tick).
export const BARBARIAN_PATH_LENGTH = 4;
// Default strength every barbarian group hits the castle with.
export const BARBARIAN_BASE_STRENGTH = 4;
