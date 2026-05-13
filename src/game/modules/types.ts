import type { GameState, Action, ActionType } from '../types';

export type ActionHandler<A extends Action = Action> = (
  state: GameState,
  action: A,
) => GameState;

export interface RuleModule {
  id: string;
  name: string;
  handlers: Partial<Record<ActionType, ActionHandler>>;
}
