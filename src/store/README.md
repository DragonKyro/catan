# Store

Zustand-based state container.

Holds the canonical `GameState` (the same on every device in an online game: each rebuilds it from the room's action log) plus UI-only state such as open dialogs and hover targets.

The store is the single source of truth for React. `dispatch` applies local actions and hands them to the network layer; `networkStore` applies the room's actions with `applyLocal`, and `actionSync.ts` rolls back and replays this device's own moves when another device's move lands first.
