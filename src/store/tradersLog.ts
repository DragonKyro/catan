import type { Action, GameState, PlayerId, ResourceBank } from '@/game/types';
import { riversFishingLogLines } from './riversFishingLog';
import { merchantTrainsAndEventLogLines } from './tradersVariantsLog';

// Traders & Barbarians log lines (plain "player + text" entries, rendered
// like the Seafarers lines): Rivers of Catan / Fishing on Catan from
// riversFishingLog.ts, the Merchant Trains voting round and Catan Event
// Cards from tradersVariantsLog.ts. Barbarian Attack has its own
// barbarianAttackLog.ts.
export interface TradersLogLine {
  player: PlayerId | null;
  text: string;
  gained?: Partial<ResourceBank>;
}

export function tradersLogLines(
  before: GameState,
  action: Action,
  after: GameState,
): TradersLogLine[] {
  return [
    ...riversFishingLogLines(before, action, after),
    ...merchantTrainsAndEventLogLines(before, action, after),
  ];
}
