// Catan learned agent — the game's AI difficulty levels and the networks
// that play them.
//
// One level, Hard, played by a network trained for the table's size
// (`aiPolicyFor`; docs/ai-strength.md):
//
//   hard    4-8 players  runs/catan/v3  update 3,400 — 41.5% vs three copies
//           of the previous Hard (big u2300), 80.1% vs all-rounders — 1,600
//           fresh deals each, §8. Trained at 4 players; also plays 5-8.
//   hard3p  3 players    runs/catan/p3  update 5,200 — the 4-player Hard
//           fine-tuned at 3 players (2026-11-27): 38.9% vs two copies of it
//           (33% = as strong), 80.4% vs all-rounders (it: 77.2%), half its
//           offers and almost no counters, §9.
//   hard2p  2 players    runs/catan/p2  update 4,800 — the 4-player Hard
//           fine-tuned under colonist.io's 1v1 rules (15 VP, discard above 9,
//           Friendly Robber, balanced dice): 80.2% vs it, 87.1% vs the
//           all-rounder (it: 60.6%); 0.4 offers a game, no counters, games
//           ~12 turns shorter, §9.
//
// All three: encoder / action space v3 with its rules (meta.rules: picks its
// own trade partner, offers only what an opponent needs, counter-offers at
// most once a turn), the larger network (128 wide x 4 rounds, 1.97M
// parameters): ~70 ms a move on a desktop, ~450 ms at 4x CPU throttling.
// (Previous Hard: runs/catan/big u2300, §6; its float32 file is in the
// git-ignored training/runs/catan/shipped-json/ to re-pack if ever wanted.)
//
// Each policy file is a packed binary (training/catan/pack_policy.py: float16
// weights, 4.0 MB), a hashed asset (a `?url` import, never part of a JS
// chunk), fetched once per page the first time a game at that table size
// uses it. Policy files carry the encoder and action-space versions they were
// trained with; the runtime refuses a mismatch (levels.test.ts catches it) —
// retrain or carry over and re-freeze after changing either.

import type { AiLevel } from '@/game/types';
import hardUrl from './policies/hard-v3-update3400.bin?url';
import hard3pUrl from './policies/hard3p-p3-update5200.bin?url';
import hard2pUrl from './policies/hard2p-p2-update4800.bin?url';
import { CatanPolicyNet, decodePolicyBinary } from './runtime';

// One level since 2026-11-25: Hard. The retired Easy (main u100) and Normal
// (main u1000) policies stay in policies/ (easy-update100.bin,
// normal-update1000.bin) but aren't imported, so they don't ship; to bring
// one back, widen AiLevel, add its levelInfo entry and its networks here.
export { AI_LEVEL_IDS, AI_LEVEL_LABEL, DEFAULT_AI_LEVEL } from './levelInfo';

/** A trained network: a level at the table sizes it was trained for. */
export type AiPolicyId = 'hard' | 'hard3p' | 'hard2p';

export const AI_POLICIES: Record<AiPolicyId, { level: AiLevel; players: string; url: string; file: string }> = {
  hard: { level: 'hard', players: '4-8', url: hardUrl, file: 'hard-v3-update3400.bin' },
  hard3p: { level: 'hard', players: '3', url: hard3pUrl, file: 'hard3p-p3-update5200.bin' },
  hard2p: { level: 'hard', players: '2', url: hard2pUrl, file: 'hard2p-p2-update4800.bin' },
};
export const AI_POLICY_IDS = Object.keys(AI_POLICIES) as AiPolicyId[];

/** The network that plays `level` at a table of `players`. */
export function aiPolicyFor(level: AiLevel, players: number): AiPolicyId {
  void level; // one level: Hard
  return players === 2 ? 'hard2p' : players === 3 ? 'hard3p' : 'hard';
}

const loading = new Map<AiPolicyId, Promise<CatanPolicyNet>>();
const loaded = new Map<AiPolicyId, CatanPolicyNet>();

/** Fetch and build a network (once per page; later calls share the promise). */
export function loadAiPolicy(id: AiPolicyId): Promise<CatanPolicyNet> {
  let p = loading.get(id);
  if (!p) {
    p = fetch(AI_POLICIES[id].url)
      .then((res) => {
        if (!res.ok) throw new Error(`AI ${id}: HTTP ${res.status}`);
        return res.arrayBuffer();
      })
      .then((buf) => {
        const net = new CatanPolicyNet(decodePolicyBinary(buf));
        loaded.set(id, net);
        return net;
      });
    // A failed fetch can be retried later.
    p.catch(() => loading.delete(id));
    loading.set(id, p);
  }
  return p;
}

/** The network if it has finished loading, else null. */
export function loadedAiPolicy(id: AiPolicyId): CatanPolicyNet | null {
  return loaded.get(id) ?? null;
}

/** Install a network built elsewhere (tests and tools read the files from disk). */
export function setAiPolicyNet(id: AiPolicyId, net: CatanPolicyNet): void {
  loaded.set(id, net);
  loading.set(id, Promise.resolve(net));
}
