# Network layer

The room transport for online play: Firebase Realtime Database (project `github-games-e7c7d`, shared with other web apps), behind an interface so the stores can run against an in-memory server in tests. Everything this app stores lives under `/catan` (`DB_ROOT` in `firebaseRoom.ts`).

- `transport.ts`: the interface (`RoomTransport` → `RoomConnection` + `RoomEvents`), `ServerUnreachableError`, log-slot keys.
- `firebaseRoom.ts`: the Firebase implementation (anonymous sign-in, room layout, transactions, presence). Loaded lazily by `networkStore`, so the SDK only downloads when someone goes online.
- `fakeTransport.ts`: test-only in-memory server with the same semantics, for multi-device store tests.
- `types.ts`: lobby, chat, and room record types. `identity.ts`: persistent UUID, display name, room codes. `roomLink.ts`: `?room=CODE` in the URL (reload / invite links).
- Security rules: `database.rules.json` at the repo root, covering only the `catan` key. The database has one rules set for every app, so deploys go through `scripts/merge-db-rules.mjs` (the predeploy hook in `firebase.json`), which swaps this app's key into the live rules and keeps the other apps' keys.

## Multiplayer model

- Every device holds the full `GameState`, rebuilt from the room's `start` record plus its action log, applied in slot order. Moves, not state diffs, go to the server.
- Randomness (dice rolls, dev card draws) is decided by the acting player and included in the action payload, so every device reduces to the same state.
- Ordering, rollback and replay of this device's own moves live in `src/store/actionSync.ts`; this layer only reads and writes the room.

## Rules of this layer

- No imports from `@/ui` or `@/store`.
- May import from `@/game` for types.
- Keep this layer thin — no game rules belong here.
