// `?preview=<kind>:<id>&…` — the scenario preview's URL, parsed without
// loading the preview itself (App reads it on start; ScenarioPreview.tsx
// renders it).

import { BASE_SCENARIO_ORDER } from '@/game/modules/base/scenarios';
import { SCENARIO_ORDER } from '@/game/modules/seafarers/board/scenarios';
import { TRADERS_SCENARIO_ORDER } from '@/game/modules/traders/board/scenarios';
import { EXPLORERS_PIRATES_SCENARIO_ID } from '@/game/modules/explorersPirates/constants';

export type PreviewKind = 'base' | 'seafarers' | 'traders' | 'ck' | 'ep';

// Explorers & Pirates ships one scenario (the Rulebook's complete one).
const EP_PREVIEW_OPTIONS = [{ id: EXPLORERS_PIRATES_SCENARIO_ID, label: 'Explorers & Pirates' }];

export interface PreviewSpec {
  kind: PreviewKind;
  id: string;
  players: number;
  seed: number;
  coords: boolean;
  // Heuristic-AI moves to play before rendering (0 = the fresh board).
  steps?: number;
  // 'game' loads the position into the real game screen (seat 1 human, the
  // rest AI) instead of drawing the bare board — for checking panels and
  // dialogs. Default 'board'.
  view?: 'board' | 'game';
  // T&B variants to switch on (`variants=eventCards,friendlyRobber,…`).
  variants?: string[];
  // Board view only: magnify the board `zoom`× around `at` (fractions of
  // its width / height), to check small pieces in a screenshot.
  zoom?: { scale: number; x: number; y: number };
  // Game view only: keep playing (AIs for every seat) until seat 1 acts in
  // this phase, e.g. `stopAt=epMovement` for the Movement phase bar.
  stopAt?: string;
}

export function previewOptions(kind: PreviewKind): { id: string; label: string }[] {
  switch (kind) {
    case 'base':
    case 'ck':
      return BASE_SCENARIO_ORDER;
    case 'seafarers':
      return SCENARIO_ORDER;
    case 'traders':
      return TRADERS_SCENARIO_ORDER;
    case 'ep':
      return EP_PREVIEW_OPTIONS;
  }
}

// Parse `?preview=...` from a query string. Returns null when absent.
export function parsePreviewQuery(search: string): PreviewSpec | null {
  const params = new URLSearchParams(search);
  const raw = params.get('preview');
  if (!raw) return null;
  const [kindRaw, idRaw] = raw.split(':');
  const kind = (['base', 'seafarers', 'traders', 'ck', 'ep'] as const).find((k) => k === kindRaw) ?? 'base';
  const id = idRaw || previewOptions(kind)[0]?.id || 'standard';
  const players = Number(params.get('players') ?? 4) || 4;
  const seed = Number(params.get('seed') ?? 1) || 1;
  const coords = params.get('coords') === '1';
  const steps = Number(params.get('steps') ?? 0) || 0;
  const view = params.get('view') === 'game' ? 'game' : 'board';
  const variants = (params.get('variants') ?? '').split(',').filter(Boolean);
  const scale = Number(params.get('zoom') ?? 0);
  const [zx, zy] = (params.get('at') ?? '0.5,0.5').split(',').map(Number);
  const zoom = scale > 1 ? { scale, x: zx ?? 0.5, y: zy ?? 0.5 } : undefined;
  const stopAt = params.get('stopAt') ?? undefined;
  return { kind, id, players, seed, coords, steps, view, variants, ...(zoom ? { zoom } : {}), ...(stopAt ? { stopAt } : {}) };
}
