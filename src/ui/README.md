# UI layer

React + SVG. Reads state from `@/store`, dispatches actions through `@/net`.

## Layout (planned)

- `lobby/` — room create/join, game settings (expansion picker, victory points, player count).
- `game/` — `Board`, `Hex`, `Vertex`, `Edge`, `Port`, `Robber` SVG components.
- `panels/` — player panels, current player's hand, action bar, dice log.
- `dialogs/` — trade, discard (on 7), robber-steal target, dev card play.
- `hooks/` — `useGameState`, `useDispatch`, `useNet`.

## Rules of this layer

- The board is hand-rolled SVG, rendered inside React. No Canvas.
- Components are read-only with respect to `GameState` — all mutations go through `useDispatch`.
- Visual style: clean and minimal. No animation library yet.
