import type {
  GameState,
  Action,
  ActionType,
  MoveRobberAction,
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
}
