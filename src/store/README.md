# Store

Zustand-based state container.

Holds the canonical `GameState` (the same shape on every peer thanks to full state replication) plus UI-only state such as open dialogs and hover targets.

The store is the single source of truth for React. The net layer writes to it on remote actions; `useDispatch` writes to it on local actions while simultaneously broadcasting.
