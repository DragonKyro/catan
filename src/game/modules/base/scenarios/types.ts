import type { ScenarioLayout } from '../../../board/scenarioTypes';
import type { PlayerColor } from '../../../types';

// A hex corner, counted clockwise from the north-east one (0 NE, 1 SE, 2 S,
// 3 SW, 4 NW, 5 N), and a hex side: the edge between corners d and d + 1
// (0 E, 1 SE, 2 SW, 3 W, 4 NW, 5 NE). Same convention as the port anchors.
export interface HexCornerRef {
  q: number;
  r: number;
  corner: 0 | 1 | 2 | 3 | 4 | 5;
}
export interface HexSideRef {
  q: number;
  r: number;
  direction: 0 | 1 | 2 | 3 | 4 | 5;
}

// One color's printed starting pieces on a beginner board.
export interface StartingSlot {
  // The rulebook's name for the color ("Red", "Blue", …).
  label: string;
  // The palette color closest to it: a player who picked this color is
  // seated on this slot.
  color: PlayerColor;
  // The two settlements, each with the road printed next to it.
  pieces: [
    { settlement: HexCornerRef; road: HexSideRef },
    { settlement: HexCornerRef; road: HexSideRef },
  ];
  // The settlement marked with the white star: its hexes pay the starting
  // resources.
  star: 0 | 1;
}

// The rulebooks' "starting set-up for beginners": every color's pieces are
// printed on the map, so the placement rounds are skipped.
export interface StartingSetup {
  // 3-4 players.
  slots3_4?: StartingSlot[];
  // 3 players: this slot (by label) sits out ("remove the red pieces").
  dropAt3?: string;
  // 5-6 players. At 5, one slot drawn at random is inactive: its settlements
  // stay on the board as inactive settlements, its roads come off.
  slots5_6?: StartingSlot[];
}

// Modular schema for base-game "Fun Maps" — colonist.io-style variants
// (Gold Rush, Volcano, Black Forest, Diamond, Gear, Lakes, Pond, Twirl) that
// reuse the standard base-game ruleset but ship custom board shapes.
//
// Mirrors the Seafarers `Scenario` type but trimmed to fields that make sense
// without expansion mechanics. The Volcano scenario adds a single
// scenario-specific field (`volcano`) — anything more complex should live in
// its own expansion module.

export interface BaseScenario {
  id: string;
  name: string;
  // Single-sentence blurb shown in the lobby. Optional.
  description?: string;
  minPlayers: number;
  maxPlayers: number;
  // VP target for 3-4p games. Defaults to 10 if absent.
  defaultVpToWin?: number;
  // VP target for 5-6p games. Defaults to `defaultVpToWin` (which defaults
  // to 10). Colonist's Fun Maps don't change the VP target — included for
  // future-proofing.
  defaultVpToWin5_6?: number;
  // Modular per-player-count layouts. When all three are absent the scenario
  // is treated as "Standard" and the generator falls through to the legacy
  // hardcoded `generateBoard()`. 4p falls back to 3p; 5-6p has no fallback.
  layout3p?: ScenarioLayout;
  layout4p?: ScenarioLayout;
  layout5_6p?: ScenarioLayout;
  // Volcano scenario only: the (q, r) of the volcano hex. Surfaced on
  // BoardState as `volcanoHex` so the dice handler can fire eruptions and
  // the setup validator can block adjacent settlements.
  volcano?: { q: number; r: number };
  // Map only offered with this expansion (the Cities & Knights first-game
  // board). Absent = any rule set.
  onlyWithExpansion?: string;
  // Expansions this map can't be played with (its mechanic isn't wired into
  // that expansion's turn — e.g. gold fields or the volcano under C&K).
  notWithExpansions?: string[];
  // Fixed starting pieces (the beginner boards). createGame places them,
  // pays the starting resources and starts the game at the first roll.
  startingSetup?: StartingSetup;
}
