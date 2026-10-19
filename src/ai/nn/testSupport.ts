// Test-only: seeded headless games between heuristic AIs with every seat's
// knowledge folded forward, plus a scrambler for hidden information. Used by
// the nn/ tests; not imported by production code.

import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { nextRng, rollDice, shuffle } from '@/game/rng';
import type { Action, DevCardType, GameState, PlayerId, ResourceBank } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { chooseAction, shouldAcceptTrade } from '../index';
import { initialKnowledge, observeTransition, type CatanKnowledge } from './knowledge';

export interface Sample {
  state: GameState;
  knowledge: Record<PlayerId, CatanKnowledge>;
}

export interface SimOptions {
  players: number;
  seed: number;
  vpTarget?: number;
  /** Keep every `every`-th state (default 1). */
  every?: number;
  maxSteps?: number;
}

export interface SimResult {
  final: GameState;
  knowledge: Record<PlayerId, CatanKnowledge>;
  samples: Sample[];
}

/** One seeded heuristic-vs-heuristic game. `onStep` sees every transition. */
export function playGame(
  opts: SimOptions,
  onStep?: (before: GameState, action: Action, after: GameState, knowledge: Record<PlayerId, CatanKnowledge>) => void,
): SimResult {
  const names = Array.from({ length: opts.players }, (_, i) => `p${i}`);
  let s = createGame({
    playerNames: names,
    playerTypes: names.map(() => 'ai' as const),
    seed: opts.seed,
    settings: { victoryPointsToWin: opts.vpTarget ?? 10 },
  });
  let dice = (opts.seed * 2654435761) >>> 0;
  let knowledge: Record<PlayerId, CatanKnowledge> = {};
  for (const p of s.players) knowledge[p.id] = initialKnowledge(s, p.id);
  const samples: Sample[] = [];
  const every = opts.every ?? 1;
  const maxSteps = opts.maxSteps ?? 6000;

  const step = (action: Action) => {
    if (action.type === 'rollDice') {
      const [d, next] = rollDice(dice);
      dice = next;
      action = { ...action, dice: d };
    }
    const after = applyAction(s, action);
    const k: Record<PlayerId, CatanKnowledge> = {};
    for (const id of Object.keys(knowledge)) k[id] = observeTransition(knowledge[id]!, s, action, after);
    onStep?.(s, action, after, k);
    knowledge = k;
    s = after;
  };

  for (let n = 0; s.phase !== 'gameOver' && n < maxSteps; n++) {
    if (n % every === 0) samples.push({ state: s, knowledge });
    const pt = s.pendingTrade;
    if (pt) {
      const acceptor = s.players.find((p) => p.id !== pt.proposerId && shouldAcceptTrade(s, p.id));
      step(acceptor ? { type: 'acceptTrade', playerId: acceptor.id } : { type: 'cancelTrade', playerId: pt.proposerId });
      continue;
    }
    const acting = getActingPlayerId(s);
    step(chooseAction(s, acting) ?? { type: 'endTurn', playerId: acting });
  }
  return { final: s, knowledge, samples };
}

export function sampleGames(opts: SimOptions & { games: number }): Sample[] {
  const out: Sample[] = [];
  for (let g = 0; g < opts.games; g++) out.push(...playGame({ ...opts, seed: opts.seed + g }).samples);
  return out;
}

/** A copy of `state` with everything `viewerId` can't see re-drawn: each
 *  opponent's resources (hand sizes kept), the dev cards in opponents' hands
 *  and the deck (each opponent's card count kept), the deck order, the RNG. */
export function scrambleHidden(state: GameState, viewerId: PlayerId, seed: number): { state: GameState; changes: number } {
  let rng = seed >>> 0;
  const draw = (n: number) => {
    const [u, next] = nextRng(rng);
    rng = next;
    return Math.floor(u * n);
  };
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  let changes = 0;
  const opponents = s.players.filter((p) => p.id !== viewerId);

  for (const p of opponents) {
    const total = RESOURCES.reduce((n, r) => n + p.resources[r], 0);
    const hand: ResourceBank = { wood: 0, brick: 0, sheep: 0, wheat: 0, ore: 0 };
    for (let i = 0; i < total; i++) hand[RESOURCES[draw(RESOURCES.length)]!] += 1;
    if (RESOURCES.some((r) => hand[r] !== p.resources[r])) changes++;
    p.resources = hand;
  }

  const pool: DevCardType[] = [...s.devCardDeck];
  const held = opponents.map((p) => {
    const n = p.devCards.unplayed.length + p.devCards.boughtThisTurn.length + p.devCards.victoryPoints;
    pool.push(...p.devCards.unplayed, ...p.devCards.boughtThisTurn);
    for (let i = 0; i < p.devCards.victoryPoints; i++) pool.push('victoryPoint');
    return n;
  });
  const [shuffled, next] = shuffle(rng, pool);
  rng = next;
  opponents.forEach((p, i) => {
    const cards = shuffled.splice(0, held[i]!);
    const before = JSON.stringify(p.devCards);
    const nonVp = cards.filter((c) => c !== 'victoryPoint');
    const cut = draw(nonVp.length + 1);
    p.devCards = {
      ...p.devCards,
      unplayed: nonVp.slice(0, cut),
      boughtThisTurn: nonVp.slice(cut),
      victoryPoints: cards.length - nonVp.length,
    };
    if (JSON.stringify(p.devCards) !== before) changes++;
  });
  if (shuffled.join() !== s.devCardDeck.join()) changes++;
  s.devCardDeck = shuffled;
  s.rngState = draw(2 ** 31);
  return { state: s, changes };
}
