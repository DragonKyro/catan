// Catan learned agent — the game's AI difficulty levels.
//
// Frozen checkpoints (training/README.md), scored as one seat against three
// heuristic AIs at 4 players (25% = as strong as each heuristic seat):
//
//   easy    runs/catan/main  update 100     29.5% (at freezing)  about the heuristic AI's strength
//   normal  runs/catan/main  update 1,000   61.0% (at freezing)
//   hard    runs/catan/v3    update 3,400   41.5% vs three copies of the previous Hard
//           (big u2300), 80.1% vs all-rounders — 1,600 fresh deals each,
//           docs/ai-strength.md §8. Encoder / action space v3 with its rules
//           (meta.rules: picks its own trade partner, offers only what an
//           opponent needs, counter-offers at most once a turn). The larger
//           network (128 wide x 4 rounds, 1.97M parameters, 4.0 MB file):
//           ~4x the work per move of Easy / Normal (64 x 4) — about 70 ms on a
//           desktop, ~450 ms at 4x CPU throttling.
//   (previous Hard: runs/catan/big u2300 — 84.2% vs all-rounders,
//   docs/ai-strength.md §6; its float32 file is in the git-ignored
//   training/runs/catan/shipped-json/ to re-pack if it's ever wanted back.)
//
// Each policy file is a packed binary (training/catan/pack_policy.py: float16
// weights, ~1 MB; Hard ~3.8 MB), a hashed asset (a `?url` import, never part
// of a JS chunk), fetched once per page the first time a game uses it.
// Policy files carry the encoder and action-space versions they were trained
// with; the runtime refuses a mismatch (levels.test.ts catches it) — retrain
// and re-freeze after changing either.

import type { AiLevel } from '@/game/types';
import hardUrl from './policies/hard-v3-update3400.bin?url';
import { CatanPolicyNet, decodePolicyBinary } from './runtime';
import { AI_LEVEL_LABEL } from './levelInfo';

// One level since 2026-11-25: Hard (v3 u3400 since 2026-11-27). The retired
// Easy (main u100) and Normal (main u1000) policies stay in policies/
// (easy-update100.bin, normal-update1000.bin) but aren't imported, so they
// don't ship; to bring one back, widen AiLevel and add its entry here again.
export { AI_LEVEL_IDS, AI_LEVEL_LABEL, DEFAULT_AI_LEVEL } from './levelInfo';

export const AI_LEVELS: Record<AiLevel, { label: string; url: string; file: string }> = {
  hard: { label: AI_LEVEL_LABEL.hard, url: hardUrl, file: 'hard-v3-update3400.bin' },
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
