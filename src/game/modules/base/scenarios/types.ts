import type { ScenarioLayout } from '../../../board/scenarioTypes';

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
}
