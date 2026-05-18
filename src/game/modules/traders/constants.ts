// Traders & Barbarians expansion constants.

export const TRADERS_EXPANSION_ID = 'traders';

// Scenario identifiers (T&B ships 5 in total; this commit lands the first).
export const TRADERS_SCENARIO_RIVERS = 'riversOfCatan';

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
