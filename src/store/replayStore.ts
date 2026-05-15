import { create } from 'zustand';
import type { Action, GameState } from '@/game/types';

// Saved replay = the deterministic seed (initial state) + every action,
// plus a small metadata header. Loading a replay reconstructs every step
// by re-applying actions through the engine — no game state is stored
// per-step.
export interface ReplayData {
  // Bumped if the file format changes incompatibly.
  version: number;
  // ISO timestamp when the replay was exported.
  savedAt: string;
  // Optional descriptive label so the user can tell games apart in
  // their downloads folder.
  label?: string;
  // Winner's PlayerId (if the game ended), for display in the header.
  winner?: string;
  initialState: GameState;
  actions: Action[];
}

interface ReplayStore {
  // Active replay data. When non-null, App.tsx renders ReplayScreen and
  // suppresses the live GameView / HomeMenu.
  data: ReplayData | null;

  load: (data: ReplayData) => void;
  clear: () => void;
}

export const useReplayStore = create<ReplayStore>((set) => ({
  data: null,
  load: (data) => set({ data }),
  clear: () => set({ data: null }),
}));

export const REPLAY_FILE_VERSION = 1;

// Serialize an in-memory replay to a JSON string. Pretty-printed so
// users diff/share it without needing tooling.
export function serializeReplay(data: ReplayData): string {
  return JSON.stringify(data, null, 2);
}

// Parse + validate a JSON blob into ReplayData. Throws with a friendly
// message on schema mismatch so the UI can surface the failure.
export function parseReplay(json: string): ReplayData {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch (e) {
    throw new Error('File is not valid JSON.');
  }
  if (!raw || typeof raw !== 'object') {
    throw new Error('Replay file is empty or malformed.');
  }
  const r = raw as Partial<ReplayData>;
  if (typeof r.version !== 'number') {
    throw new Error('Replay missing version field.');
  }
  if (r.version > REPLAY_FILE_VERSION) {
    throw new Error(
      `Replay was created with a newer version (${r.version}); this build supports up to v${REPLAY_FILE_VERSION}.`,
    );
  }
  if (!r.initialState || typeof r.initialState !== 'object') {
    throw new Error('Replay missing initialState.');
  }
  if (!Array.isArray(r.actions)) {
    throw new Error('Replay missing actions array.');
  }
  return {
    version: r.version,
    savedAt: r.savedAt ?? new Date(0).toISOString(),
    label: r.label,
    winner: r.winner,
    initialState: r.initialState as GameState,
    actions: r.actions as Action[],
  };
}

// Trigger a browser download of `data` as a .catanrep.json file. Filename
// includes the savedAt timestamp so users don't overwrite previous saves.
export function downloadReplay(data: ReplayData): void {
  const json = serializeReplay(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const stamp = data.savedAt.replace(/[:.]/g, '-');
  const labelPart = data.label ? `-${data.label.replace(/\s+/g, '_')}` : '';
  const a = document.createElement('a');
  a.href = url;
  a.download = `catan-replay${labelPart}-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke after a tick so the click handler completes first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
