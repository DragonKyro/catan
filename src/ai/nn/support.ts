// Which games the trained network plays — kept apart from the network code
// so the menus can ask without loading it.

import type { GameSettings } from '@/game/types';

/** Rule sets the learned agent is trained for: the base game on the standard board, any table size. */
export function supportsNeuralAi(
  settings: Pick<GameSettings, 'expansions' | 'baseScenarioId' | 'customMap' | 'tradersVariants'> & { numPlayers?: number },
): boolean {
  // A network per table size (levels.ts): 2 players trained under the 1v1
  // rules (15 VP, 9-card limit, Friendly Robber, balanced dice), 3 and 4
  // players at 10 VP without either option. Balanced dice changes only the
  // odds, so every network plays with it; the Friendly Robber only the
  // 2-player one trained with (the others leave it to the heuristic).
  const players = settings.numPlayers ?? 3;
  return players >= 2
    && settings.expansions.length === 0
    && (settings.baseScenarioId ?? 'standard') === 'standard'
    && !settings.customMap
    && (!settings.tradersVariants?.friendlyRobber || players === 2)
    && !settings.tradersVariants?.strongestPorts
    && !settings.tradersVariants?.eventCards;
}
