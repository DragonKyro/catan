// A batch of independent base-game Catan matches for a learner to drive.
//
// Every seat of a match has a role: 'learner' (the network being trained),
// 'opponent' (a frozen network the learner process also runs) or 'heuristic'
// (src/ai, played right here). Each env runs on its own — heuristic moves,
// trade answers — until a network seat has a decision, then reports that
// seat's encoded observation, its legal mask and its role (0 = learner,
// 1 = opponent). The learner process answers every env with one slot.
// Multi-part answers (discard, robber victim, Road Building) are several
// decisions; the parts before the last change no game state, so the env
// asks the same seat again with its draft. Finished matches auto-reset:
// `done[i]` marks that env i's match ended during the last advance, and the
// row returned is already its next match's first decision. With `quota`
// set, an env stops after that many matches and reports role −1 (an empty
// mask; any slot is ignored) — evals use this to play a fixed set of deals.
//
// Seat roles come from `seats`, rotated one place per match (and per env),
// so a lone learner visits every seat; turn order is shuffled by createGame
// anyway. Dice come from each env's own seeded RNG, whoever rolls.
//
// Rewards are per seat (numEnvs × players) and accrue between consecutive
// batches: credit `reward[i·P + s]` to seat s's latest decision in env i.
//   - match end: reward.ts terminalRewards (win + placement + VP, centred;
//     a match cut off at maxTurns / maxSteps pays the truncation penalty)
//   - optional shaping, potential-based on own VP: vpShaping × ΔVP / target
//     whenever a seat's VP changes, and −vpShaping × VP / target at the end,
//     so the shaping sums to zero over a match.
//
// Pending trade offers are answered seat by seat in turn order after the
// offerer (heuristic seats via shouldAcceptTrade) until someone accepts or
// everyone has rejected.

import type { Action, GameState, PlayerId } from '@/game/types';
import { RESOURCES } from '@/game/types';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { rollDice } from '@/game/rng';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { chooseAction, shouldAcceptTrade } from '@/ai/index';
import { initialKnowledge, observeTransition, type CatanKnowledge } from '@/ai/nn/knowledge';
import { observe, type CatanDraft, type CatanObservation } from '@/ai/nn/observation';
import { EDGE_DIM, GLOBAL_DIM, HEX_DIM, VERTEX_DIM, analyseBoard, encodeObservation } from '@/ai/nn/encode';
import { decodeSlot, legalMask, slotLayout } from '@/ai/nn/actions';
import { DEFAULT_REWARD_WEIGHTS, finalStandings, terminalRewards, type RewardWeights } from '@/ai/nn/reward';

export type SeatRole = 'learner' | 'opponent' | 'heuristic';
const ROLE_CODE: Record<SeatRole, number> = { learner: 0, opponent: 1, heuristic: 2 };

export interface VecEnvOptions {
  numEnvs: number;
  seed: number;
  players: number;
  /** Role per seat for matches that start from now on (rotated per match). */
  seats: SeatRole[];
  /** Dice rolls before a match is cut off. */
  maxTurns: number;
  /** Actions (any seat) before a match is cut off. */
  maxSteps: number;
  vpShaping: number;
  victoryPoints: number;
  reward: RewardWeights;
  /** Matches each env plays before going idle (0 = forever). */
  quota: number;
}

export const DEFAULT_VEC_ENV_OPTIONS: VecEnvOptions = {
  numEnvs: 16,
  seed: 1,
  players: 4,
  seats: ['learner', 'learner', 'learner', 'learner'],
  maxTurns: 200,
  maxSteps: 4000,
  vpShaping: 0,
  victoryPoints: 10,
  reward: DEFAULT_REWARD_WEIGHTS,
  quota: 0,
};

export interface Episode {
  env: number;
  seed: number;
  /** Role per seat (state.players order). */
  roles: SeatRole[];
  winnerSeat: number | null;
  vp: number[];
  rank: number[];
  reward: number[];
  turns: number;
  steps: number;
  truncated: boolean;
}

/** Buffers are reused by the next reset / step — copy anything you keep. */
export interface VecBatch {
  /** state.players index of the seat deciding row i. */
  seat: Int8Array;
  /** 0 learner, 1 opponent, −1 idle (quota reached). */
  role: Int8Array;
  hexes: Float32Array;
  vertices: Float32Array;
  edges: Float32Array;
  global: Float32Array;
  /** numEnvs × numSlots, 1 = legal. */
  mask: Uint8Array;
  /** numEnvs × players. */
  reward: Float32Array;
  done: Uint8Array;
  episodes: Episode[];
}

interface EnvSlot {
  state: GameState;
  seed: number;
  episode: number;
  roles: SeatRole[];
  knowledge: Array<CatanKnowledge | null>;
  dice: number;
  vp: number[];
  steps: number;
  turns: number;
  /** Seat whose decision is pending, its draft, and what it was shown (decoded against on the next step). */
  seat: number;
  draft: CatanDraft | null;
  shown: { obs: CatanObservation; mask: Uint8Array } | null;
  idle: boolean;
}

export interface BoardShape {
  hexes: number;
  vertices: number;
  edges: number;
  slots: number;
}

export function boardShape(players: number): BoardShape {
  const s = createGame({ playerNames: Array.from({ length: players }, (_, i) => `p${i}`), seed: 1 });
  const obs = observe(s, 'p0', initialKnowledge(s, 'p0'));
  const L = slotLayout(obs);
  return { hexes: L.hexes, vertices: L.vertices, edges: L.edges, slots: L.total };
}

export class CatanVecEnv {
  readonly opts: VecEnvOptions;
  readonly shape: BoardShape;
  private readonly envs: EnvSlot[] = [];
  private batch: VecBatch;

  constructor(options: Partial<VecEnvOptions> = {}) {
    this.opts = { ...DEFAULT_VEC_ENV_OPTIONS, ...options };
    const { numEnvs: n, players, seats } = this.opts;
    if (!(Number.isInteger(n) && n >= 1)) throw new Error('numEnvs must be a positive integer');
    validateSeats(seats, players);
    this.shape = boardShape(players);
    const sh = this.shape;
    this.batch = {
      seat: new Int8Array(n),
      role: new Int8Array(n),
      hexes: new Float32Array(n * sh.hexes * HEX_DIM),
      vertices: new Float32Array(n * sh.vertices * VERTEX_DIM),
      edges: new Float32Array(n * sh.edges * EDGE_DIM),
      global: new Float32Array(n * GLOBAL_DIM),
      mask: new Uint8Array(n * sh.slots),
      reward: new Float32Array(n * players),
      done: new Uint8Array(n),
      episodes: [],
    };
  }

  /** Change the seat roles for matches that start from now on. */
  configure(update: { seats?: SeatRole[] }): void {
    if (update.seats) {
      validateSeats(update.seats, this.opts.players);
      this.opts.seats = update.seats.slice();
    }
  }

  reset(): VecBatch {
    this.beginBatch();
    this.envs.length = 0;
    for (let i = 0; i < this.opts.numEnvs; i++) {
      this.envs.push(this.startMatch(i, 0));
      this.advance(i);
    }
    return this.finishBatch();
  }

  /** One slot per env, for the seat reported in the previous batch (ignored for idle envs). */
  step(slots: ArrayLike<number>): VecBatch {
    if (this.envs.length === 0) throw new Error('step before reset');
    if (slots.length !== this.envs.length) throw new Error(`expected ${this.envs.length} actions, got ${slots.length}`);
    this.beginBatch();
    for (let i = 0; i < this.envs.length; i++) {
      const env = this.envs[i]!;
      if (env.idle) continue;
      const { obs, mask } = env.shown!;
      const decoded = decodeSlot(obs, slots[i]!, () => [1, 1], mask);
      if (decoded.kind === 'draft') {
        env.draft = decoded.draft;
        continue;
      }
      env.draft = null;
      this.apply(i, decoded.action);
      this.advance(i);
    }
    return this.finishBatch();
  }

  private startMatch(i: number, episode: number): EnvSlot {
    const { players, seats } = this.opts;
    const seed = (Math.imul(this.opts.seed, 1_000_003) + Math.imul(i, 7919) + Math.imul(episode, 104_729)) >>> 0;
    const state = createGame({
      playerNames: Array.from({ length: players }, (_, k) => `p${k}`),
      playerTypes: Array.from({ length: players }, () => 'ai' as const),
      seed,
      settings: { victoryPointsToWin: this.opts.victoryPoints },
    });
    const shift = (i + episode) % players;
    const roles = state.players.map((_, k) => seats[(k + shift) % players]!);
    return {
      state,
      seed,
      episode,
      roles,
      knowledge: state.players.map((p, k) => (roles[k] === 'heuristic' ? null : initialKnowledge(state, p.id))),
      dice: (seed ^ 0x9e3779b9) >>> 0,
      vp: state.players.map(() => 0),
      steps: 0,
      turns: 0,
      seat: 0,
      draft: null,
      shown: null,
      idle: false,
    };
  }

  private apply(i: number, action: Action): void {
    const env = this.envs[i]!;
    if (action.type === 'rollDice') {
      const [dice, next] = rollDice(env.dice);
      env.dice = next;
      action = { ...action, dice };
      env.turns++;
    }
    const before = env.state;
    const after = applyAction(before, action);
    env.knowledge = env.knowledge.map((k) => (k ? observeTransition(k, before, action, after) : null));
    if (this.opts.vpShaping !== 0) {
      const P = this.opts.players;
      after.players.forEach((p, s) => {
        const vp = calculateVictoryPoints(after, p.id, true);
        if (vp !== env.vp[s]) {
          this.batch.reward[i * P + s]! += (this.opts.vpShaping * (vp - env.vp[s]!)) / this.opts.victoryPoints;
          env.vp[s] = vp;
        }
      });
    }
    env.state = after;
    env.steps++;
  }

  /** Run env i forward to the next network decision, resetting finished matches. */
  private advance(i: number): void {
    for (;;) {
      const env = this.envs[i]!;
      if (env.idle) return;
      const s = env.state;
      const over = s.phase === 'gameOver';
      if (over || env.turns >= this.opts.maxTurns || env.steps >= this.opts.maxSteps) {
        this.endMatch(i, !over);
        if (this.opts.quota > 0 && env.episode + 1 >= this.opts.quota) {
          env.idle = true;
          return;
        }
        this.envs[i] = this.startMatch(i, env.episode + 1);
        continue;
      }
      const id = decidingSeat(s);
      const seat = s.players.findIndex((p) => p.id === id);
      if (env.roles[seat] !== 'heuristic') {
        env.seat = seat;
        return;
      }
      this.apply(i, heuristicAction(s, id));
    }
  }

  private endMatch(i: number, truncated: boolean): void {
    const env = this.envs[i]!;
    const s = truncated ? { ...env.state, winner: null } : env.state;
    const P = this.opts.players;
    const rewards = terminalRewards(s, this.opts.reward);
    const standings = finalStandings(s);
    const r = this.batch.reward;
    s.players.forEach((p, k) => {
      r[i * P + k]! += rewards[p.id]!;
      if (this.opts.vpShaping !== 0) r[i * P + k]! -= (this.opts.vpShaping * env.vp[k]!) / this.opts.victoryPoints;
    });
    this.batch.done[i] = 1;
    this.batch.episodes.push({
      env: i,
      seed: env.seed,
      roles: env.roles.slice(),
      winnerSeat: truncated ? null : s.players.findIndex((p) => p.id === s.winner),
      vp: standings.map((x) => x.vp),
      rank: standings.map((x) => x.rank),
      reward: s.players.map((p) => rewards[p.id]!),
      turns: env.turns,
      steps: env.steps,
      truncated,
    });
  }

  private beginBatch(): void {
    this.batch.reward.fill(0);
    this.batch.done.fill(0);
    this.batch.episodes = [];
  }

  private finishBatch(): VecBatch {
    const b = this.batch;
    const sh = this.shape;
    this.envs.forEach((env, i) => {
      b.seat[i] = env.seat;
      if (env.idle) {
        b.role[i] = -1;
        b.mask.fill(0, i * sh.slots, (i + 1) * sh.slots);
        return;
      }
      const id = env.state.players[env.seat]!.id;
      const obs = observe(env.state, id, env.knowledge[env.seat]!, { draft: env.draft });
      const facts = analyseBoard(obs);
      const mask = legalMask(obs, facts);
      if (!mask.some((x) => x === 1)) {
        throw new Error(`env ${i}: ${id} has no legal slot (phase ${env.state.phase}, decision ${JSON.stringify(obs.decision)})`);
      }
      env.shown = { obs, mask };
      const f = encodeObservation(obs, facts);
      if (f.numHexes !== sh.hexes || f.numVertices !== sh.vertices || f.numEdges !== sh.edges) {
        throw new Error(`env ${i}: board shape changed`);
      }
      b.role[i] = ROLE_CODE[env.roles[env.seat]!];
      b.hexes.set(f.hexes, i * sh.hexes * HEX_DIM);
      b.vertices.set(f.vertices, i * sh.vertices * VERTEX_DIM);
      b.edges.set(f.edges, i * sh.edges * EDGE_DIM);
      b.global.set(f.global, i * GLOBAL_DIM);
      b.mask.set(mask, i * sh.slots);
    });
    return b;
  }
}

function validateSeats(seats: SeatRole[], players: number): void {
  if (seats.length !== players) throw new Error(`seats lists ${seats.length} roles for ${players} players`);
  for (const r of seats) if (!(r in ROLE_CODE)) throw new Error(`unknown seat role ${JSON.stringify(r)}`);
  if (!seats.some((r) => r !== 'heuristic')) throw new Error('at least one seat must be a network');
}

/** Who must act next: a trade answer comes before anything else. */
function decidingSeat(s: GameState): PlayerId {
  const pt = s.pendingTrade;
  if (pt) {
    const acting = s.playerOrder[s.currentPlayerIndex]!;
    if (pt.proposerId !== acting) return acting; // a counter-offer: the turn player answers
    const n = s.playerOrder.length;
    const at = s.playerOrder.indexOf(pt.proposerId);
    for (let k = 1; k < n; k++) {
      const id = s.playerOrder[(at + k) % n]!;
      if (!pt.rejectedBy.includes(id)) return id;
    }
  }
  return getActingPlayerId(s);
}

function heuristicAction(s: GameState, id: PlayerId): Action {
  const pt = s.pendingTrade;
  if (pt) {
    const me = s.players.find((p) => p.id === id)!;
    const canPay = RESOURCES.every((r) => me.resources[r] >= (pt.receive[r] ?? 0));
    if (canPay && shouldAcceptTrade(s, id)) return { type: 'acceptTrade', playerId: id };
    return pt.proposerId !== s.playerOrder[s.currentPlayerIndex] ? { type: 'cancelTrade', playerId: id } : { type: 'rejectTrade', playerId: id };
  }
  return chooseAction(s, id) ?? { type: 'endTurn', playerId: id };
}
