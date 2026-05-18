import type { BaseScenario } from './types';

// The default base-game board. Sentinel scenario — no layouts declared, so
// the base-scenario generator delegates to the legacy `generateBoard()`
// (3-4p / 5-6p / 7-8p hardcoded shapes with algorithmic port placement).
// Keeping this special-cased means the default new-game flow is bit-for-bit
// unchanged from before the Fun Maps work.
export const standard: BaseScenario = {
  id: 'standard',
  name: 'Standard',
  description: 'The classic Catan board.',
  minPlayers: 2,
  maxPlayers: 8,
  defaultVpToWin: 10,
  defaultVpToWin5_6: 10,
};
