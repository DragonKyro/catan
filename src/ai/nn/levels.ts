// Catan learned agent — the game's AI difficulty levels.
//
// Frozen checkpoints (training/README.md), scored as one seat against three
// heuristic AIs at 4 players (25% = as strong as each heuristic seat):
//
//   easy    runs/catan/main  update 100     29.5% (at freezing)  about the heuristic AI's strength
//   normal  runs/catan/main  update 1,000   61.0% (at freezing)
//   hard    runs/catan/big   update 2,300   84.2% vs all-rounders, 78.6% vs persona tables,
//           31.8% vs three copies of the previous Hard (adapt u12300) — fresh deals,
//           docs/ai-strength.md §6. The larger network (128 wide x 4 rounds,
//           1.89M parameters, 3.8 MB file): ~4x the work per move of Easy / Normal
//           (64 x 4) — about 70 ms on a desktop, ~450 ms at 4x CPU throttling.
//
// Each policy file is a packed binary (training/catan/pack_policy.py: float16
// weights, ~1 MB; Hard ~3.8 MB), a hashed asset (a `?url` import, never part
// of a JS chunk), fetched once per page the first time a game uses it.
// Policy files carry the encoder and action-space versions they were trained
// with; the runtime refuses a mismatch (levels.test.ts catches it) — retrain
// and re-freeze after changing either.

import type { AiLevel } from '@/game/types';
import easyUrl from './policies/easy-update100.bin?url';
import normalUrl from './policies/normal-update1000.bin?url';
import hardUrl from './policies/hard-big-update2300.bin?url';
import { CatanPolicyNet, decodePolicyBinary } from './runtime';

export const AI_LEVEL_IDS: readonly AiLevel[] = ['easy', 'normal', 'hard'];
export const DEFAULT_AI_LEVEL: AiLevel = 'normal';

export const AI_LEVELS: Record<AiLevel, { label: string; url: string; file: string }> = {
  easy: { label: 'Easy', url: easyUrl, file: 'easy-update100.bin' },
  normal: { label: 'Normal', url: normalUrl, file: 'normal-update1000.bin' },
  hard: { label: 'Hard', url: hardUrl, file: 'hard-big-update2300.bin' },
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
        return res.arrayBuffer();
      })
      .then((buf) => {
        const net = new CatanPolicyNet(decodePolicyBinary(buf));
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
