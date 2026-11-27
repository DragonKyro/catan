// Balanced dice (`settings.balancedDice`, any rule set): the rolls so far
// bias the next one, the way colonist.io's balanced dice do, so a game's
// numbers come up close to how often they should and nobody suffers a run
// of 7s. ASSUMPTION: colonist.io doesn't publish its exact numbers; these
// are ours.
//
// Each total t gets a weight before the roll:
//
//   - past rolls: as if drawn from a pool that holds every roll so far plus
//     POOL more, in the normal 2-dice proportions, minus the rolls already
//     taken out — weight = ways(t) · (n + POOL) / 36 − count(t) after n
//     rolls. A number that has come up more than its share gets rarer, an
//     overdue one commoner; with no rolls yet it's the plain 2-dice odds.
//     A number never drops below FLOOR of its normal weight.
//   - 7 streaks: × SEVEN_STREAK for each 7 among the last two rolls.
//   - 7s per player: × (1 − SEVEN_SHARE × the 7s the roller has rolled above
//     the table's average), kept within [SEVEN_SHARE_MIN, SEVEN_SHARE_MAX] —
//     a player who has rolled more than their share of 7s rolls fewer, one
//     who has rolled fewer rolls more.
//
// The engine draws the total from these weights with the seeded
// `state.rngState`, then one of its dice pairs at random (the pair matters
// for C&K's red die and the Pirate Islands fleet): the action's own dice are
// ignored, so every device reduces the same roll. A roll the dice don't
// decide (C&K Alchemy's chosen dice) passes through untouched and isn't
// counted.

import type { BalancedDiceState, GameState, PlayerId, RollDiceAction } from '../../types';
import type { RuleModule } from '../types';
import { applyNextModuleHandler } from '../../engine';
import { nextRng, rngInt } from '../../rng';

export const BALANCED_DICE_MODULE_ID = 'balancedDice';

/** Ways to roll each total with two dice (index = total). */
const WAYS = [0, 0, 1, 2, 3, 4, 5, 6, 5, 4, 3, 2, 1];
/** Extra rolls in the virtual pool: higher = closer to plain dice. */
export const POOL = 36;
const FLOOR = 0.15;
const SEVEN_STREAK = 0.5;
const SEVEN_SHARE = 0.25;
const SEVEN_SHARE_MIN = 0.4;
const SEVEN_SHARE_MAX = 1.6;
/** How many recent totals the state keeps (for the 7 streak). */
const RECENT = 2;

export function initialBalancedDice(): BalancedDiceState {
  return { counts: new Array<number>(13).fill(0), recent: [], sevens: {} };
}

/** The weight of each total (index = total; 0 and 1 are 0) for `rollerId`'s next roll. */
export function balancedDiceWeights(
  bd: BalancedDiceState,
  rollerId: PlayerId,
  playerIds: readonly PlayerId[],
): number[] {
  const n = bd.counts.reduce((a, b) => a + b, 0);
  const w = WAYS.map((ways, t) => {
    if (ways === 0) return 0;
    const normal = (ways * POOL) / 36;
    return Math.max(FLOOR * normal, (ways * (n + POOL)) / 36 - (bd.counts[t] ?? 0));
  });
  const streak = bd.recent.slice(-2).filter((t) => t === 7).length;
  w[7]! *= SEVEN_STREAK ** streak;
  if (playerIds.length > 0) {
    const total = playerIds.reduce((a, id) => a + (bd.sevens[id] ?? 0), 0);
    const excess = (bd.sevens[rollerId] ?? 0) - total / playerIds.length;
    w[7]! *= Math.min(SEVEN_SHARE_MAX, Math.max(SEVEN_SHARE_MIN, 1 - SEVEN_SHARE * excess));
  }
  return w;
}

/** The chance of each total (index = total) for `rollerId`'s next roll. */
export function balancedDiceOdds(state: GameState, rollerId: PlayerId): number[] {
  const bd = state.balancedDice ?? initialBalancedDice();
  const w = balancedDiceWeights(bd, rollerId, state.playerOrder);
  const sum = w.reduce((a, b) => a + b, 0);
  return w.map((x) => x / sum);
}

/** Draw `rollerId`'s roll: the dice, the next rng state and the updated history. */
export function drawBalancedDice(
  state: GameState,
  rollerId: PlayerId,
): { dice: [number, number]; rngState: number; balancedDice: BalancedDiceState } {
  const bd = state.balancedDice ?? initialBalancedDice();
  const w = balancedDiceWeights(bd, rollerId, state.playerOrder);
  const sum = w.reduce((a, b) => a + b, 0);
  const [u, s1] = nextRng(state.rngState);
  let x = u * sum;
  let total = 12;
  for (let t = 2; t <= 12; t++) {
    x -= w[t]!;
    if (x < 0) {
      total = t;
      break;
    }
  }
  // One of the total's dice pairs, each as likely as with real dice.
  const lo = Math.max(1, total - 6);
  const hi = Math.min(6, total - 1);
  const [k, s2] = rngInt(s1, hi - lo + 1);
  const d1 = lo + k;
  const counts = bd.counts.slice();
  counts[total] = (counts[total] ?? 0) + 1;
  return {
    dice: [d1, total - d1],
    rngState: s2,
    balancedDice: {
      counts,
      recent: [...bd.recent, total].slice(-RECENT),
      sevens: total === 7 ? { ...bd.sevens, [rollerId]: (bd.sevens[rollerId] ?? 0) + 1 } : bd.sevens,
    },
  };
}

function handleRollDiceBalanced(state: GameState, action: RollDiceAction): GameState {
  // Dice chosen by a card (C&K Alchemy) aren't the dice's to decide.
  if (state.pendingAlchemy) return applyNextModuleHandler(state, action, BALANCED_DICE_MODULE_ID);
  const draw = drawBalancedDice(state, action.playerId);
  // The next handler checks the roll is legal; if it throws, none of this sticks.
  return applyNextModuleHandler(
    { ...state, rngState: draw.rngState, balancedDice: draw.balancedDice },
    { ...action, dice: draw.dice },
    BALANCED_DICE_MODULE_ID,
  );
}

export const balancedDiceModule: RuleModule = {
  id: BALANCED_DICE_MODULE_ID,
  name: 'Balanced dice',
  handlers: {
    rollDice: handleRollDiceBalanced as never,
  },
};
