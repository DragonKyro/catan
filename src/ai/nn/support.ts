// Which games the trained network plays — kept apart from the network code
// so the menus can ask without loading it.

import type { GameSettings } from '@/game/types';

/** Rule sets the learned agent is trained for: the base game on the standard board, 3+ players. */
export function supportsNeuralAi(
  settings: Pick<GameSettings, 'expansions' | 'baseScenarioId' | 'customMap' | 'tradersVariants'> & { numPlayers?: number },
): boolean {
  // Trained on 4-player tables to 10 VP: a 2-player game (15 VP, a 9-card
  // limit) is the heuristic's. Balanced dice changes only the odds, so the
  // network still plays with it.
  return (settings.numPlayers ?? 3) >= 3
    && settings.expansions.length === 0
    && (settings.baseScenarioId ?? 'standard') === 'standard'
    && !settings.customMap
    && !settings.tradersVariants?.friendlyRobber
    && !settings.tradersVariants?.strongestPorts
    && !settings.tradersVariants?.eventCards;
}
