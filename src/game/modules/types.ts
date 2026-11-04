import type {
  GameState,
  Action,
  ActionType,
  MoveRobberAction,
  PlayerId,
} from '../types';

export type ActionHandler<A extends Action = Action> = (
  state: GameState,
  action: A,
) => GameState;

// Module-level validators. Each entry returns an error message to reject the
// action, or `null` to allow it. Validators run AFTER the dispatching
// module's preconditions and BEFORE the action mutates state, so they're
// the right hook for variant rules that just narrow legality (e.g. T&B's
// Friendly Robber, which forbids targeting a 2-VP-only hex).
export interface ModuleValidators {
  moveRobber?: (state: GameState, action: MoveRobberAction) => string | null;
}

export interface RuleModule {
  id: string;
  name: string;
  handlers: Partial<Record<ActionType, ActionHandler>>;
  validators?: ModuleValidators;
  // Length of a player's Longest Road / Route. Seafarers counts roads and
  // ships (joined only at the player's buildings). The first active module
  // that provides one wins; otherwise the base road-only count applies.
  routeLength?: (state: GameState, playerId: PlayerId) => number;
  // Scenario win conditions. Called for the acting seat after every action
  // with its full VP total (hidden VP included). Return true / false to
  // decide, or undefined to fall through to the next module and finally the
  // default "VP >= victoryPointsToWin".
  hasWon?: (state: GameState, playerId: PlayerId, vp: number) => boolean | undefined;
}
