# Rule modules

Each rule set lives here as a self-contained module: base game, Seafarers, Cities & Knights, Traders & Barbarians, Explorers & Pirates.

A module exports:

- `id` and `name`
- Initial-state contributions (the fields it adds to `GameState`)
- Action handlers (validators and applicators)
- Optionally, board generation overrides

The engine composes the active modules at game start based on the player-selected expansions.

**Why this shape:** no `if (expansion === 'cities')` conditionals scattered through the engine. Adding a new expansion means adding a file here, not editing every action handler.
