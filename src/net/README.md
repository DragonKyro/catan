# Network layer

Wraps Trystero (WebRTC peer-to-peer). Translates local action dispatches into network messages and applies remote actions to the local store.

## Multiplayer model

- Every peer holds the full `GameState`. Actions, not state diffs, flow over the wire.
- On any local action: pass it through `applyAction` AND broadcast it to peers.
- On any remote action: pass it through `applyAction` only.
- Randomness (dice rolls, dev card draws) is decided by the acting player and included in the action payload, so every peer reduces to the same state.
- Rejoin: the returning player enters the room with their persistent UUID; any peer in the room sends them the current `GameState` snapshot.

## Rules of this layer

- No imports from `@/ui`.
- May import from `@/game` to type-check and apply actions.
- Keep this layer thin — no game rules belong here.
