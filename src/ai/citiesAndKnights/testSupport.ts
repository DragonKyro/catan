import type { Action, GameSettings, GameState } from '@/game/types';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { chooseAction, shouldAcceptTrade } from '../index';

// All-AI Cities & Knights games for tests and tuning. Seeded end to end:
// the board / decks from `createGame`, dice from a mulberry32 stream. Every
// action goes through the real reducer, so an illegal AI move throws.

export interface SimResult {
  state: GameState;
  steps: number;
  turns: number;
  // Count per action type (and `playProgressCard:<card>` per card).
  counts: Record<string, number>;
}

export function simulateCK(
  players: number,
  seed: number,
  maxSteps = 8000,
  settings: Partial<GameSettings> = {},
): SimResult {
  const names = Array.from({ length: players }, (_, i) => `AI-${i}`);
  let s: GameState = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed,
    settings: { ...settings, expansions: [CITIES_AND_KNIGHTS_EXPANSION_ID] },
  });
  let rng = seed >>> 0;
  const die = () => {
    rng = (rng + 0x6d2b79f5) >>> 0;
    let t = rng;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return 1 + (((t ^ (t >>> 14)) >>> 0) % 6);
  };
  const counts: Record<string, number> = {};
  const bump = (k: string) => {
    counts[k] = (counts[k] ?? 0) + 1;
  };
  let steps = 0;
  let turns = 0;
  for (; steps < maxSteps && s.phase !== 'gameOver'; steps++) {
    let action: Action | null;
    if (s.pendingTrade && s.phase === 'main') {
      const pt = s.pendingTrade;
      const taker = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id));
      action = taker
        ? { type: 'acceptTrade', playerId: taker.id }
        : { type: 'cancelTrade', playerId: pt.proposerId };
    } else {
      const acting = getActingPlayerId(s);
      action = chooseAction(s, acting);
      if (action?.type === 'rollDice') action = { ...action, dice: [die(), die()] };
      action ??= { type: 'endTurn', playerId: acting };
    }
    bump(action.type);
    if (action.type === 'playProgressCard') bump(`playProgressCard:${action.card}`);
    if (action.type === 'endTurn') turns++;
    const before = s;
    try {
      s = applyAction(s, action);
      if (action.type === 'rollDice' && (s.barbarian?.attacksResolved ?? 0) > (before.barbarian?.attacksResolved ?? 0)) {
        bump('barbarianAttack');
        let lost = 0;
        for (const p of before.players) lost += Math.max(0, p.cities.length - s.players.find((q) => q.id === p.id)!.cities.length);
        if (lost > 0) { bump('attackLost'); counts.citiesPillaged = (counts.citiesPillaged ?? 0) + lost; }
      }
    } catch (e) {
      throw new Error(
        `C&K ${players}p seed ${seed} step ${steps} phase ${s.phase}: ${JSON.stringify(action)} -> ${(e as Error).message}`,
      );
    }
  }
  return { state: s, steps, turns, counts };
}
