// Catan learned agent — the game's AI difficulty levels.
//
// Three frozen checkpoints of training run runs/catan/main (training/README.md),
// each scored over 400 matches as one seat against three heuristic AIs at 4
// players (25% = as strong as each heuristic seat):
//
//   easy    update 100      29.5%   about the heuristic AI's strength
//   normal  update 1,000    61.0%
//   hard    update 10,000   83.5%   also 75% / 65% / 59% at 3 / 6 / 8 players
//
// Each policy file (~2.6 MB) is a hashed asset (a `?url` import, never part
// of a JS chunk), fetched once per page the first time a game uses it.
// Policy files carry the encoder and action-space versions they were trained
// with; the runtime refuses a mismatch (levels.test.ts catches it) — retrain
// and re-freeze after changing either.

import type { AiLevel } from '@/game/types';
import easyUrl from './policies/easy-update100.json?url';
import normalUrl from './policies/normal-update1000.json?url';
import hardUrl from './policies/hard-update10000.json?url';
import { CatanPolicyNet, type CatanPolicyFile } from './runtime';

export const AI_LEVEL_IDS: readonly AiLevel[] = ['easy', 'normal', 'hard'];
export const DEFAULT_AI_LEVEL: AiLevel = 'normal';

export const AI_LEVELS: Record<AiLevel, { label: string; url: string; file: string }> = {
  easy: { label: 'Easy', url: easyUrl, file: 'easy-update100.json' },
  normal: { label: 'Normal', url: normalUrl, file: 'normal-update1000.json' },
  hard: { label: 'Hard', url: hardUrl, file: 'hard-update10000.json' },
};

const loading = new Map<AiLevel, Promise<CatanPolicyNet>>();
const loaded = new Map<AiLevel, CatanPolicyNet>();

/** Fetch and build a level's network (once per page; later calls share the promise). */
export function loadAiLevel(level: AiLevel): Promise<CatanPolicyNet> {
  let p = loading.get(level);
  if (!p) {
    p = fetch(AI_LEVELS[level].url)
      .then((res) => {
        if (!res.ok) throw new Error(`AI ${level}: HTTP ${res.status}`);
        return res.json() as Promise<CatanPolicyFile>;
      })
      .then((file) => {
        const net = new CatanPolicyNet(file);
        loaded.set(level, net);
        return net;
      });
    // A failed fetch can be retried later.
    p.catch(() => loading.delete(level));
    loading.set(level, p);
  }
  return p;
}

/** The level's network if it has finished loading, else null. */
export function loadedAiLevel(level: AiLevel): CatanPolicyNet | null {
  return loaded.get(level) ?? null;
}

/** Install a network built elsewhere (tests and tools read the files from disk). */
export function setAiLevelNet(level: AiLevel, net: CatanPolicyNet): void {
  loaded.set(level, net);
  loading.set(level, Promise.resolve(net));
}
