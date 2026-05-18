// In Cities & Knights the regular dev card system is removed entirely —
// the rulebook says to return all dev cards (and the Largest Army tile)
// to the box. Progress cards (drawn on the event die) replace them.
// We intercept the five dev card actions here so any stale UI dispatch
// fails loud instead of silently mutating C&K state.
import type { GameState, Action } from '../../../types';

function refuse(): never {
  throw new Error(
    'Dev cards are removed under Cities & Knights — use progress cards instead.',
  );
}

export const handleBuyDevCardCK = (_state: GameState, _action: Action): GameState =>
  refuse();
export const handlePlayKnightCK = (_state: GameState, _action: Action): GameState =>
  refuse();
export const handlePlayRoadBuildingCK = (
  _state: GameState,
  _action: Action,
): GameState => refuse();
export const handlePlayYearOfPlentyCK = (
  _state: GameState,
  _action: Action,
): GameState => refuse();
export const handlePlayMonopolyCK = (
  _state: GameState,
  _action: Action,
): GameState => refuse();
