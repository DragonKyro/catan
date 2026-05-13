# Game logic layer

Pure TypeScript. No React, no DOM, no network imports.

All state mutations happen here via `applyAction(state, action) => state`. The engine is deterministic — the same input always produces the same output. This is what makes the network layer trivial: peers broadcast actions, every peer reduces to the same state.

## Layout

- `types.ts` — `GameState`, `Action`, `Player`, `Board` and related types.
- `engine.ts` — `applyAction` dispatcher; composes the active rule modules.
- `actions/` — one file per family of actions (build, trade, devcard, dice, setup).
- `board/` — hex graph, board generation, port placement (uses `honeycomb-grid`).
- `modules/` — base game + each expansion as a self-contained rule module.

## Rules of this layer

- No imports from `react`, `react-dom`, `trystero`, `@/ui`, `@/net`, or `@/store`.
- Every public function should be unit-testable without mocks.
- No `Date.now()`, `Math.random()`, or other non-determinism. Use a seeded RNG passed in via state.
- Randomness from dice rolls and dev card draws is decided by the acting player and carried in the action payload, not generated inside `applyAction`.
