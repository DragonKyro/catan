import type { GameSettings, GameState } from '../../../types';
import type { RuleModule } from '../../types';
import {
  validateMoveRobberFriendlyRobber,
  validateRobberVictimFriendlyRobber,
} from './friendlyRobber';
import { recalcStrongestPorts } from '../scoring/strongestPorts';
import {
  EVENT_CARDS_MODULE_ID,
  handleRepairRoad,
  handleResolveEvent,
  handleRollDiceWithEventCards,
} from './eventCards/events';

// Traders & Barbarians variants (2025 rulebook p. 4-6). Each is a small
// rule module, switched on by `settings.tradersVariants`, that works with
// any rule set — base game, Seafarers scenarios, T&B scenarios — because
// the engine puts the active ones in front of the other modules (see
// `getActiveModules`). They never assume the T&B expansion itself is on.

// The Friendly Robber: robber targets and steals (validators only).
const friendlyRobberModule: RuleModule = {
  id: 'tradersFriendlyRobber',
  name: 'Friendly Robber',
  handlers: {},
  validators: {
    moveRobber: validateMoveRobberFriendlyRobber,
    robberVictim: validateRobberVictimFriendlyRobber,
  },
};

// Harbors of Catan / Strongest Ports: refresh the tile holder after every
// action, so any change to buildings on harbors (a build, a Volcano
// eruption, a conquest) moves the tile.
const strongestPortsModule: RuleModule = {
  id: 'tradersStrongestPorts',
  name: 'Strongest Ports',
  handlers: {},
  derive: (state: GameState): GameState => {
    if (!state.strongestPorts) return state;
    const next = recalcStrongestPorts(state);
    return next.holder === state.strongestPorts.holder ? state : { ...state, strongestPorts: next };
  },
};

// Catan Event Cards: the event deck replaces the dice.
const eventCardsModule: RuleModule = {
  id: EVENT_CARDS_MODULE_ID,
  name: 'Catan Event Cards',
  handlers: {
    rollDice: handleRollDiceWithEventCards as never,
    resolveEvent: handleResolveEvent as never,
    repairRoad: handleRepairRoad as never,
  },
};

export function tradersVariantModules(settings: GameSettings): RuleModule[] {
  const v = settings.tradersVariants;
  if (!v) return [];
  const out: RuleModule[] = [];
  if (v.eventCards) out.push(eventCardsModule);
  if (v.friendlyRobber) out.push(friendlyRobberModule);
  if (v.strongestPorts) out.push(strongestPortsModule);
  return out;
}

// Is any T&B variant switched on?
export function hasTradersVariant(settings: Pick<GameSettings, 'tradersVariants'>): boolean {
  const v = settings.tradersVariants;
  return !!(v && (v.friendlyRobber || v.strongestPorts || v.eventCards));
}
