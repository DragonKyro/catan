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
//   - optional: refusedOfferPenalty, charged to a seat whose trade offer
//     everyone rejected (a tiny cost, so hopeless offers stop being free).
//
// Pending trade offers are answered seat by seat in turn order after the
// offerer (heuristic seats via shouldAcceptTrade) until someone accepts or
// everyone has rejected.
//
// With `teacher` on, every learner row also carries the slot the heuristic AI
// would pick for that decision (teacher.ts; −1 where it has none) — the
// imitation target for the trainer's warm start.
//
// Fault tolerance (a training run is hours of matches; one bad move must not
// end it): a heuristic move the engine rejects is replaced by a random legal
// move for that seat (`Episode.fallbacks`); any other error abandons just
// that match (`Episode.aborted`, no terminal reward) and starts a new one.
// Both are reported on stderr, throttled.

import type { Action, GameState, PlayerId } from '@/game/types';
import { createGame } from '@/game/createGame';
import { applyAction } from '@/game/engine';
import { getActingPlayerId } from '@/game/helpers';
import { nextRng, rollDice } from '@/game/rng';
import { calculateVictoryPoints } from '@/game/scoring/points';
import { initialKnowledge, observeTransition, type CatanKnowledge } from '@/ai/nn/knowledge';
import { observe, type CatanDraft, type CatanObservation } from '@/ai/nn/observation';
import { EDGE_DIM, GLOBAL_DIM, HEX_DIM, VERTEX_DIM, analyseBoard, encodeObservation } from '@/ai/nn/encode';
import { decodeSlot, legalMask, slotLayout } from '@/ai/nn/actions';
import { actWithPolicy } from '@/ai/nn/agent';
import type { CatanPolicyNet } from '@/ai/nn/runtime';
import { DEFAULT_REWARD_WEIGHTS, finalStandings, terminalRewards, type RewardWeights } from '@/ai/nn/reward';
import { heuristicAction, teacherSlot } from './teacher';

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
  /** Label learner rows with the heuristic's choice (`VecBatch.teacher`). */
  teacher: boolean;
  /** Charged to a seat whenever an offer of theirs is rejected by everyone. */
  refusedOfferPenalty: number;
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
  teacher: false,
  refusedOfferPenalty: 0,
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
  /** Heuristic moves the engine rejected, replaced by a random legal move. */
  fallbacks: number;
  /** The match was abandoned after an error (no terminal reward). */
  aborted: boolean;
  /** Per seat, how often each action type was played, plus `tradeDone`
   *  (player trades completed, either side) and `offerTaken` (own offers accepted). */
  actions: Record<string, number[]>;
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
  /** The heuristic's slot for learner row i, or −1 (always −1 unless `teacher` is on). */
  teacher: Int16Array;
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
  /** Every seat's knowledge (heuristic seats need theirs for a fallback move). */
  knowledge: CatanKnowledge[];
  dice: number;
  /** RNG for fallback moves. */
  rng: number;
  vp: number[];
  steps: number;
  turns: number;
  fallbacks: number;
  actions: Record<string, number[]>;
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

/** stderr, at most a few lines per distinct problem (then every 100th). */
const reported = new Map<string, number>();
function report(kind: string, message: string): void {
  const n = (reported.get(kind) ?? 0) + 1;
  reported.set(kind, n);
  if (n <= 3 || n % 100 === 0) process.stderr.write(`[catan-env] ${kind} (×${n}): ${message}\n`);
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
      teacher: new Int16Array(n),
      reward: new Float32Array(n * players),
      done: new Uint8Array(n),
      episodes: [],
    };
  }

  /** Change the seat roles for matches that start from now on, and/or turn teacher labels on or off. */
  configure(update: { seats?: SeatRole[]; teacher?: boolean }): void {
    if (update.seats) {
      validateSeats(update.seats, this.opts.players);
      this.opts.seats = update.seats.slice();
    }
    if (update.teacher !== undefined) this.opts.teacher = update.teacher;
  }

  reset(): VecBatch {
    this.beginBatch();
    this.envs.length = 0;
    for (let i = 0; i < this.opts.numEnvs; i++) {
      this.envs.push(this.startMatch(i, 0));
      this.guarded(i, () => this.advance(i));
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
      this.guarded(i, () => {
        const { obs, mask } = env.shown!;
        const decoded = decodeSlot(obs, slots[i]!, () => [1, 1], mask);
        if (decoded.kind === 'draft') {
          env.draft = decoded.draft;
          return;
        }
        env.draft = null;
        this.apply(i, decoded.action);
        this.advance(i);
      });
    }
    return this.finishBatch();
  }

  /** The TypeScript runtime's logits for every env's pending row ([] if idle) — parity checks against PyTorch. */
  policyLogits(net: CatanPolicyNet): number[][] {
    return this.envs.map((env) => (env.idle || !env.shown
      ? [] : Array.from(net.logits(encodeObservation(env.shown.obs), env.shown.obs.index))));
  }

  /** Run `f` on env i; on an error, abandon that match, start a fresh one and
   *  run `recover` on it (by default: play it up to its first network decision). */
  private guarded(i: number, f: () => void, recover: () => void = () => this.advance(i)): void {
    for (let attempt = 0; ; attempt++) {
      try {
        f();
        return;
      } catch (e) {
        if (attempt >= 3) throw e; // a fresh match failing over and over is a real bug
        const env = this.envs[i]!;
        report('match aborted', `env ${i} seed ${env.seed} phase ${env.state.phase}: ${(e as Error).stack ?? e}`);
        this.endMatch(i, true, true);
        this.envs[i] = this.startMatch(i, env.episode + 1);
        f = recover;
      }
    }
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
      knowledge: state.players.map((p) => initialKnowledge(state, p.id)),
      dice: (seed ^ 0x9e3779b9) >>> 0,
      rng: (seed ^ 0x85ebca6b) >>> 0,
      vp: state.players.map(() => 0),
      steps: 0,
      turns: 0,
      fallbacks: 0,
      actions: {},
      seat: 0,
      draft: null,
      shown: null,
      idle: false,
    };
  }

  private apply(i: number, action: Action): void {
    const env = this.envs[i]!;
    let dice = env.dice;
    if (action.type === 'rollDice') {
      const [rolled, next] = rollDice(env.dice);
      dice = next;
      action = { ...action, dice: rolled };
    }
    const before = env.state;
    const after = applyAction(before, action);
    // Only a move the engine accepted advances the dice and counters.
    if (action.type === 'rollDice') env.turns++;
    env.dice = dice;
    env.knowledge = env.knowledge.map((k) => observeTransition(k, before, action, after));
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
    const count = (key: string, id: PlayerId) => {
      const row = (env.actions[key] ??= after.players.map(() => 0));
      row[after.players.findIndex((p) => p.id === id)]! += 1;
    };
    count(action.type, action.playerId);
    if (action.type === 'acceptTrade' && before.pendingTrade) {
      count('tradeDone', action.playerId);
      count('tradeDone', before.pendingTrade.proposerId);
      count('offerTaken', before.pendingTrade.proposerId);
    }
    if (action.type === 'rejectTrade' && before.pendingTrade && !after.pendingTrade) {
      // The last answer was a rejection too: nobody took the offer.
      const proposer = before.pendingTrade.proposerId;
      count('offerRefused', proposer);
      const s = after.players.findIndex((p) => p.id === proposer);
      this.batch.reward[i * this.opts.players + s]! -= this.opts.refusedOfferPenalty;
    }
    env.state = after;
    env.steps++;
  }

  /** A heuristic seat's move; one the engine rejects is replaced by a random legal move. */
  private heuristicMove(i: number, seat: number, id: PlayerId): void {
    const env = this.envs[i]!;
    const action = heuristicAction(env.state, id);
    try {
      this.apply(i, action);
      return;
    } catch (e) {
      report(`heuristic ${action.type} rejected`, `${(e as Error).message} — ${JSON.stringify(action)}`);
    }
    env.fallbacks++;
    const random = (_f: unknown, mask: Uint8Array) => {
      const legal: number[] = [];
      for (let k = 0; k < mask.length; k++) if (mask[k]) legal.push(k);
      const [u, next] = nextRng(env.rng);
      env.rng = next;
      return legal[Math.floor(u * legal.length)]!;
    };
    const fallback = actWithPolicy(env.state, id, env.knowledge[seat]!, random, () => [1, 1]);
    if (!fallback) throw new Error(`no fallback move for heuristic seat ${id} in ${env.state.phase}`);
    this.apply(i, fallback);
  }

  /** Run env i forward to the next network decision, resetting finished matches. */
  private advance(i: number): void {
    for (;;) {
      const env = this.envs[i]!;
      if (env.idle) return;
      const s = env.state;
      const over = s.phase === 'gameOver';
      if (over || env.turns >= this.opts.maxTurns || env.steps >= this.opts.maxSteps) {
        this.endMatch(i, !over, false);
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
      this.heuristicMove(i, seat, id);
    }
  }

  private endMatch(i: number, truncated: boolean, aborted: boolean): void {
    const env = this.envs[i]!;
    const s = truncated ? { ...env.state, winner: null } : env.state;
    const P = this.opts.players;
    const rewards = terminalRewards(s, this.opts.reward);
    const standings = finalStandings(s);
    const r = this.batch.reward;
    s.players.forEach((p, k) => {
      if (!aborted) r[i * P + k]! += rewards[p.id]!;
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
      reward: s.players.map((p) => (aborted ? 0 : rewards[p.id]!)),
      turns: env.turns,
      steps: env.steps,
      truncated,
      fallbacks: env.fallbacks,
      aborted,
      actions: env.actions,
    });
  }

  private beginBatch(): void {
    this.batch.reward.fill(0);
    this.batch.done.fill(0);
    this.batch.episodes = [];
  }

  private finishBatch(): VecBatch {
    for (let i = 0; i < this.envs.length; i++) {
      this.guarded(i, () => this.writeRow(i), () => {
        this.advance(i);
        this.writeRow(i);
      });
    }
    return this.batch;
  }

  /** Observe env i's pending decision into row i of the batch. */
  private writeRow(i: number): void {
    const b = this.batch;
    const sh = this.shape;
    const env = this.envs[i]!;
    b.seat[i] = env.seat;
    b.teacher[i] = -1;
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
      throw new Error(`${id} has no legal slot (phase ${env.state.phase}, decision ${JSON.stringify(obs.decision)})`);
    }
    env.shown = { obs, mask };
    const f = encodeObservation(obs, facts);
    if (f.numHexes !== sh.hexes || f.numVertices !== sh.vertices || f.numEdges !== sh.edges) {
      throw new Error('board shape changed');
    }
    b.role[i] = ROLE_CODE[env.roles[env.seat]!];
    if (this.opts.teacher && env.roles[env.seat] === 'learner') b.teacher[i] = teacherSlot(env.state, id, obs, mask);
    b.hexes.set(f.hexes, i * sh.hexes * HEX_DIM);
    b.vertices.set(f.vertices, i * sh.vertices * VERTEX_DIM);
    b.edges.set(f.edges, i * sh.edges * EDGE_DIM);
    b.global.set(f.global, i * GLOBAL_DIM);
    b.mask.set(mask, i * sh.slots);
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
