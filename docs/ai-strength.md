# AI strength: heuristic personas and network levels

Measured 2026-11-18 on commit `e114b1d` (the AI code is as of `68ea647`, which
added the personas and the all-rounder's "pivot when boxed in"). Base game,
4 players, 10 VP, standard board. **Rerun and update this file after any change
to the heuristic (`src/ai/*.ts`) or a new network level.** Commands are at the
end.

## The heuristics

The heuristic AI (`src/ai/`) plays as 11 personas (`src/ai/persona.ts`). Each is
the all-rounder with one dimension bent, and steers only while its objective
is open, then plays as the all-rounder.

| Persona | What it changes |
|---|---|
| `allRounder` | The heuristic as it always played (control) |
| `oreWheatSheep` | Setup: ore / wheat / sheep corners |
| `woodBrick` | Setup: wood / brick corners |
| `allFive` | Setup: all five resources |
| `highPips` | Setup: highest pip total |
| `portStack` | Setup: one resource plus its 2:1 harbor |
| `griefer` | Setup: crowd a rival, then wood / brick to cut them off |
| `longestRoad` | Play: chase Longest Road |
| `largestArmy` | Play: dev cards first, a knight every turn |
| `citiesFirst` | Play: cities before settlements |
| `expansion` | Play: settlements first |

## 1. One persona vs three all-rounders

200 seat-rotated games per persona (seeds 7000+). 25% = all-rounder strength.
At 200 games a win rate is good to about ±6 points (95%). LR / LA = share of
games it ended holding Longest Road / Largest Army.

| Persona | Win | LR | LA | Cities | Devs bought |
|---|---:|---:|---:|---:|---:|
| `longestRoad` | 33% | 60% | 12% | 1.80 | 3.3 |
| `largestArmy` | 30% | 18% | 59% | 1.33 | 7.1 |
| `citiesFirst` | 29% | 21% | 20% | 2.32 | 4.2 |
| `allRounder` (control) | 25% | 21% | 25% | 1.99 | 4.7 |
| `allFive` | 22% | 21% | 24% | 2.08 | 4.4 |
| `highPips` | 20% | 18% | 28% | 1.75 | 4.8 |
| `griefer` | 18% | 19% | 21% | 1.62 | 4.1 |
| `portStack` | 15% | 18% | 17% | 1.52 | 3.8 |
| `expansion` | 12% | 16% | 12% | 1.93 | 3.8 |
| `woodBrick` | 10% | 19% | 20% | 1.23 | 4.0 |
| `oreWheatSheep` | 9% | 11% | 12% | 1.68 | 3.6 |

## 2. Tournament: personas against each other

3,000 tables of four distinct personas drawn from the seed (seeds 20000+),
about 1,090 seats each; 2 games hit the step cap. The field average is 25% by
construction, so compare against the `allRounder` row, not 25%. Elo is
400·log10 of a Bradley-Terry strength fitted to every pair that shared a
table (who finished higher), with the all-rounder at 0; "Ahead" is the fitted
chance to finish above the all-rounder at a shared table.

| Rank | Persona | Win (95% CI) | Mean place | VP | Elo | Ahead |
|---:|---|---|---:|---:|---:|---:|
| 1 | `longestRoad` | 38.8% (36.0–41.7) | 2.11 | 7.82 | +51 | 0.57 |
| 2 | `largestArmy` | 33.4% (30.7–36.3) | 2.20 | 7.64 | +30 | 0.54 |
| 3= | `allRounder` | 29.0% (26.4–31.8) | 2.34 | 7.38 | 0 | 0.50 |
| 3= | `allFive` | 29.2% (26.5–31.9) | 2.35 | 7.38 | −2 | 0.50 |
| 3= | `highPips` | 28.1% (25.5–30.9) | 2.36 | 7.29 | −5 | 0.49 |
| 3= | `citiesFirst` | 28.5% (25.9–31.2) | 2.37 | 7.35 | −7 | 0.49 |
| 7 | `expansion` | 19.9% (17.7–22.4) | 2.59 | 6.86 | −54 | 0.42 |
| 8= | `oreWheatSheep` | 21.2% (18.9–23.7) | 2.70 | 6.60 | −78 | 0.39 |
| 8= | `griefer` | 18.5% (16.3–20.9) | 2.70 | 6.52 | −79 | 0.39 |
| 10 | `portStack` | 16.4% (14.3–18.7) | 2.83 | 6.26 | −106 | 0.35 |
| 11 | `woodBrick` | 11.4% (9.7–13.5) | 2.95 | 6.08 | −133 | 0.32 |

Pairwise: how often the row persona finished above the column persona when
they shared a table.

| | LR | LA | All | All5 | Pips | Cities | Exp | OWS | Grief | Port | WB |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `longestRoad` | – | .54 | .58 | .56 | .57 | .57 | .64 | .70 | .68 | .71 | .74 |
| `largestArmy` | .46 | – | .53 | .55 | .58 | .53 | .64 | .62 | .64 | .70 | .73 |
| `allRounder` | .42 | .47 | – | .53 | .52 | .51 | .55 | .61 | .57 | .65 | .71 |
| `allFive` | .44 | .45 | .47 | – | .53 | .50 | .57 | .61 | .62 | .65 | .67 |
| `highPips` | .43 | .42 | .48 | .47 | – | .52 | .61 | .59 | .61 | .65 | .68 |
| `citiesFirst` | .43 | .47 | .49 | .50 | .48 | – | .61 | .58 | .60 | .62 | .65 |
| `expansion` | .36 | .36 | .45 | .43 | .39 | .39 | – | .57 | .55 | .57 | .64 |
| `oreWheatSheep` | .30 | .38 | .39 | .39 | .41 | .42 | .43 | – | .50 | .56 | .55 |
| `griefer` | .32 | .36 | .43 | .38 | .39 | .40 | .45 | .50 | – | .53 | .56 |
| `portStack` | .29 | .30 | .35 | .35 | .35 | .38 | .43 | .44 | .47 | – | .55 |
| `woodBrick` | .26 | .27 | .29 | .33 | .32 | .35 | .36 | .45 | .44 | .45 | – |

## 3. Network levels vs the current heuristic

One network seat vs three all-rounders, 300 seat-rotated games per level
(seeds 5000+, the same loop as the "1 *level* + 3 heuristic" table of
`src/ai/nn/behaviour.diag.test.ts`). 25% = heuristic strength.

| Level | Checkpoint | Win now (95% CI) | Mean place | VP | Recorded at training |
|---|---|---|---:|---:|---:|
| Easy | update 100 | 24.7% (20.1–29.8) | 2.48 | 7.2 | 29.5% |
| Normal | update 1,000 | 54.3% (48.7–59.9) | 1.76 | 8.6 | 61.0% |
| Hard | update 10,000 | 77.3% (72.3–81.7) | 1.30 | 9.6 | 83.5% |

"Recorded at training" is from run `training/runs/catan/main` (Oct 2026),
measured against the heuristic of that time with `evaluate.py` on its own
deals. All three levels score 5–7 points lower now. For Normal and Hard the
old figure is outside today's interval, which fits the all-rounder having got
stronger with the Nov 12 changes.

## 4. Hard on the training tables (baseline for run `adapt`)

Measured 2026-11-18 with `evaluate.py` (greedy, 400 games, 3 workers,
the eval seed — the same deals as the run's evals). Action space v2.

| Table (Hard as one seat) | Win (95% CI) | Place | Roads | Dev cards | Knights | Bank trades | Player trades |
|---|---|---:|---:|---:|---:|---:|---:|
| vs 3 all-rounders | 74.2% (69.7–78.3) | 1.36 | 3.18 | 6.55 | 3.02 | 4.41 | 17.8 |
| vs personas (LR:3, LA:3, griefer:3 aimed at it, cities first, high pips, all five, expansion; distinct) | 70.2% (65.6–74.5) | 1.46 | 3.54 | 6.59 | 3.10 | 4.61 | 18.3 |
| lopsided opening (wood-brick / OWS / port stack) vs 3× Hard | 20.0% (16.4–24.2) | 2.67 | 4.69 | 3.24 | 1.56 | 4.87 | 6.2 |

Per game counts are the agent's. Against the persona tables Hard builds
almost exactly as against all-rounders (roads, dev cards, knights, bank
trades within a few percent), which matches it "playing the same whatever
the position": the fine-tune should move those numbers on those tables.

## 5. Run `adapt` results (fresh deals)

Fine-tune of Hard (u10000 → u12500, 2,500 updates, 4.8 h): persona tables
(LR:3, LA:3, griefer:3 aimed at the network, cities first, high pips, all
five, expansion; distinct), a quarter of openings lopsided, self-play and past
checkpoints; lr 5e-5 → 0. Re-tested on deals it was never evaluated on
(`evaluate.py --seed 777`, 800 games per table, 4 workers):

| Policy | vs personas | vs 3× current Hard | lopsided opening vs 3× Hard | vs 3 all-rounders |
|---|---|---|---|---|
| u10000 (current Hard) | 69.4% (66.1–72.5) | 25% (mirror) | 20.5% (17.8–23.4) | 78.5% (75.5–81.2) |
| u12000 | 75.5% (72.4–78.4) | 29.1% (26.1–32.4) | 24.0% (21.2–27.1) | 82.5% (79.7–85.0) |
| u12300 | 77.1% (74.1–79.9) | 31.5% (28.4–34.8) | 23.8% (20.9–26.8) | 80.4% (77.5–83.0) |
| u12500 | 74.8% (71.6–77.6) | 29.8% (26.7–33.0) | 23.5% (20.7–26.6) | 83.9% (81.2–86.3) |

Every candidate beats the current Hard on every table, head-to-head
included (all three intervals clear 25%). In-run evals (same deals every
checkpoint, 400 games) understated the head-to-head gain (~27–28%).

## 6. Run `big` results (fresh deals)

The larger network (128 wide x 4 rounds, 1,889,739 parameters, encoder v2):
300 updates imitating Hard (adapt u12300), then 2,000 PPO updates (lr 1e-4
-> 0, anchor toward the teacher fading over 500), same tables as `adapt`.
Re-tested on fresh deals (`evaluate.py --seed 777`, 800 games per table):

| Policy | vs personas | vs 3x adapt u12300 (current Hard) | lopsided opening vs 3x u12300 | vs 3 all-rounders |
|---|---|---|---|---|
| adapt u12300 (current Hard) | 77.1% | 25% (mirror; 24.5% measured) | ~24% | 80.4% |
| big u1900 | 79.9% (77.0-82.5) | 31.5% (28.4-34.8) | 27.4% (24.4-30.6) | 83.1% (80.4-85.6) |
| big u2000 | 78.2% (75.3-81.0) | 32.5% (29.3-35.8) | 26.0% (23.1-29.1) | 83.9% (81.2-86.3) |
| big u2200 | 78.0% (75.0-80.7) | 31.9% (28.7-35.2) | 28.0% (25.0-31.2) | 83.8% (81.0-86.1) |
| big u2300 | 78.6% (75.7-81.3) | 31.8% (28.6-35.1) | 28.2% (25.2-31.5) | 84.2% (81.6-86.6) |

The four are within noise of each other; all beat the current Hard on every
table. In-run (same 400 deals each checkpoint) u1900 read 35.0%: picking the
best of 20 checkpoints on the same deals overstated it.

Opening search (a look-ahead over the snake order scoring lines by the network's
value head; built and measured 2026-11-19, then removed):
Hard + search in one seat vs 3x Hard on the same 800 deals: control 24.5%,
search 8x8 **15.0%** (12.7-17.6) — worse; 1x1 (no real search) 25.1%, so
the plumbing is right and the value head's ranking of openings is the
problem (argmax over 64 noisy estimates picks the overrated ones).

## 7. Run `big2` results (in-run, 2026-11-21)

More training for the larger network from big u2300 (the shipped Hard):
3,000 PPO updates (u2300 -> u5300, lr 3e-5 -> 0, fresh optimizer, no anchor),
heavier on self-play and past checkpoints (`self=3,past=2,heuristic=2,mixed=1`,
past pool seeded with big u400-u2300), same personas / targets / lopsided
openings. 5.7 h. In-run evals, 400 games per table on the same deals each
checkpoint:

| | vs personas | vs 3x big u2300 (Hard) | lopsided opening vs 3x u2300 |
|---|---|---|---|
| mean of 29 checkpoints (u2400-u5200) | ~81% | **26.9%** | ~17.5% |
| best single reading | 84.5% (u3600, u4700) | 30.5% (u3800), 30.2% (u3500) | 20.5% (u5200) |
| last 5 (u4800-u5200) | ~81% | 28.0% | 19.4% |

No clear gain over Hard: 26.9% against 25% parity, and the best readings
are the max of 29 noisy numbers on one set of deals, so overstated (big
u1900 read 35.0% in-run and 31.5% on fresh deals). The guard fired five
times (vs-personas dips below the best, a self-play worker moved to persona
tables and back), the drift pattern of self-play-heavy mixes.

Fresh deals (2026-11-23; 800 games each; seed 777 = the deals used for §5-6,
seed 888 a second set):

| big2 checkpoint | vs 3x Hard, seed 777 | vs 3x Hard, seed 888 | other tables (seed 777) |
|---|---|---|---|
| u3500 | 24.6% (21.8-27.7) | | |
| u3800 | 24.9% (22.0-28.0) | | |
| u5000 | 27.0% (24.0-30.2) | | |
| u5200 | 28.5% (25.5-31.7) | 25.0% (22.1-28.1) | personas 79.6% (Hard on the same deals 78.0%), all-rounders 83.4%, lopsided opening vs 3x Hard 19.9% |
| u5300 | 28.9% (25.8-32.1) | 24.4% (21.5-27.5) | |

The in-run best (u3800, u3500) was luck; the late checkpoints' edge on seed
777 vanished on seed 888 (pooled ~26.7% over 1,600 games). Hard stays big
u2300. Reading: the 128x4 net is at its plateau under this PPO setup, so
more of the same won't move it — confirm any candidate on two deal sets.

## 8. Run `v3` results (fresh deals, 2026-11-27) — the shipped Hard

Encoder v3 (seat plans, win plans, build speedups, opponents' next
settlements, the opening outlook) and action space v3 with its rules
(`tradePick`, `offerNeeds`, `counter`), warm-started from big u2300 (the new
inputs at zero weight). 3,000 PPO updates (u2300 -> u5300, lr 5e-5 -> 0,
fresh optimizer, no anchor), outcome head at 0.1; persona tables of Longest
Road / Largest Army / griefer only (distinct, the griefer aimed at the
learner), mixed tables of two personas + a past checkpoint, self-play growing
as the learning rate falls (4/2/2 -> 5/2/1 at u3300 -> 6/1/1 at u4300 of 8
workers), no lopsided openings. 8.7 h.

In-run, vs 3x big u2300 (the previous Hard, 400 games on the same deals each
checkpoint): 28.7% at u2400, 37-46% from u3000 on (best 45.8% u3500, 44.5%
u3400, 44.0% u4900); vs the training personas 57-71%.

Fresh deals (800 games each; seed 777 = the deals used for §5-7, seed 888 a
second set):

| v3 checkpoint | vs 3x big u2300, seed 777 | seed 888 | pooled | vs 3 all-rounders (777 / 888) |
|---|---|---|---|---|
| u3400 (**shipped**) | 42.0% (38.6-45.5) | 41.0% (37.6-44.4) | **41.5%** | 79.1% / 81.1% |
| u3500 | 39.9% (36.5-43.3) | | | 79.6% |
| u3700 | 41.5% (38.1-44.9) | 39.6% (36.3-43.1) | 40.6% | 79.5% / 77.5% |
| u4900 | 38.5% (35.2-41.9) | | | 81.4% |
| u5200 | 41.2% (37.9-44.7) | 37.6% (34.3-41.0) | 39.4% | 82.2% / 80.5% |
| u5300 | 41.0% (37.6-44.4) | | | 80.6% |
| big u2300 (previous Hard) | 25% (mirror) | | | 84.2% / 84.9% |

Every v3 checkpoint beats the previous Hard by a wide margin head to head
(about 1.6x a parity seat's share), on both deal sets. Against plain
all-rounders it wins a little less than the previous Hard did (about 80%
against 84-85%): its training had no all-rounder tables, only personas,
mixed tables and self-play. u3400 is the best and steadiest head to head
and is now Hard (`src/ai/nn/levels.ts`); fp16 packing keeps its top move in
3,200 of 3,200 sampled positions.

## 9. 3-player and 2-player networks (runs `p3` / `p2`, fresh deals, 2026-11-27)

Hard (v3 u3400) was trained only at 4 players. Two fine-tunes from it, run
side by side (2,000 PPO updates each, u3400 -> u5400, lr 3e-5 -> 0, fresh
optimizer, 4 workers x 64 envs, ~4.6 h): `p3` at 3 players, 10 VP (2 self-play,
1 persona, 1 mixed); `p2` at 2 players under colonist.io's 1v1 rules (15 VP,
discard above 9, Friendly Robber, balanced dice; 2 self-play, 1 persona, 1 past
checkpoint). Personas: all-rounder, Longest Road, Largest Army, griefer (the
griefer aimed at the learner). Trading was taxed so it doesn't drag the game
out: every offer / counter cost 0.002 (p3) / 0.004 (p2) of reward, one nobody
took (or a counter not taken) 0.006 / 0.01 more. The 2-player heuristic now
takes a trade only when it helps it more than the proposer (`twoPlayerTradeOk`).

Fresh deals, 800 games per deal set (seeds 777 / 888), pooled = 1,600. "vs
heuristic" = plain all-rounders. Offers, counters and trades are the agent's
per game; "table offers" counts every seat's offers.

3 players (parity 33.3%):

| | vs 2x Hard | vs 2 heuristics | turns | offers (taken) | counters | trades | table offers |
|---|---|---|---|---|---|---|---|
| Hard u3400 (today) | 33.3% (mirror) | 77.2% | 66 | 25.5 (29%) | 10.7 | 9.8 | 53.5 |
| p3 u5000 | 37.2% | 78.9% | 65 | 13.4 (36%) | 0.2 | 6.6 | 41 |
| **p3 u5200** | **38.9%** (40.4 / 37.5) | **80.4%** | 65 | 13.7 (36%) | 0.1 | 7.1 | 41 |
| p3 u5400 | 36.2% | 79.2% | 65 | 13.2 (37%) | 0.1 | 7.0 | 41 |

2 players, 1v1 rules (parity 50%):

| | vs Hard | vs heuristic | turns | offers (taken) | counters | trades | table offers |
|---|---|---|---|---|---|---|---|
| Hard u3400 (today's network) | 50% (mirror) | 60.6% | 93.5 | 26.3 (15%) | 7.5 | 4.9 | 42.6 |
| **p2 u4800** | **80.2%** (80.2 / 80.2) | 87.1% | 82 | 0.4 (46%) | 0 | 1.9 | 17 |
| p2 u4900 | 78.9% | 87.9% | 82 | 0.4 | 0 | 1.9 | 17 |
| p2 u5300 | 79.0% | 86.4% | 80 | 0.4 | 0 | 2.1 | 16 |
| p2 u5400 | 78.8% | 88.5% | 81 | 0.5 | 0 | 2.2 | 16 |

p3 is a modest gain (about +5.6 points over a parity seat head to head, +3
vs heuristics) with half the offers and almost no counters; games are the same
length. p2 is a big gain: it beats Hard 4 games in 5 and the heuristic (today's
2-player AI) 7 in 8, almost never offers a trade (0.4 a game, about half taken),
never counters, and still makes ~2 player trades a game by taking offers that
suit it, plus ~10 bank trades; games are ~12 turns shorter. Its remaining
table offers are the opponent's. In-run numbers (400 games) under-read p3
here (33-36.5% in-run vs 36-39% fresh).

## What it says

- **Only the two bonus chasers beat the all-rounder**, both one-vs-three and
  in mixed tables: `longestRoad` (+51 Elo) and `largestArmy` (+30). The
  all-rounder under-invests in Longest Road and Largest Army. That is the
  clearest lead for improving the heuristic.
- **`citiesFirst`, `allFive` and `highPips` are level with the all-rounder.**
  `citiesFirst`'s 29% one-vs-three is inside the noise, and in mixed tables it
  sits at −7 Elo.
- **Skewed openings are weak.** `woodBrick` (−133), `portStack` (−106),
  `oreWheatSheep` (−78) and `griefer` (−79) are losing styles, and `expansion`
  (−54) is the weakest play style. They're useful as varied opponents in
  training, not as strong ones: the spread from best to worst is about 185 Elo.
- **The trained networks are still well above the heuristic** (Hard wins 77%
  of one-vs-three games, mean place 1.30). Easy is now about equal to the
  all-rounder rather than slightly above it.

## Reproduce

```sh
# 1. one persona vs three all-rounders (~4 min at 200)
DIAG=1 DIAG_GAMES=200 npx vitest run src/ai/personas.diag.test.ts -t "three all-rounders"
# 2. persona tournament (~4 min at 3000)
DIAG=1 DIAG_TABLES=3000 npx vitest run src/ai/personas.diag.test.ts -t "tournament"
# 3. a network level vs three heuristics (~3 s per game; run levels in parallel)
DIAG=1 DIAG_LEVEL=hard DIAG_GAMES=300 npx vitest run src/ai/nn/behaviour.diag.test.ts -t "3 heuristic"
```

1 and 2 are seeded (they replace `Math.random` with a seeded generator), so a
rerun on unchanged code gives the same numbers. 3 is not: the network's and
the heuristic's roll actions carry `Math.random` dice, so a rerun lands
elsewhere inside the interval. Training and `evaluate.py` aren't affected:
the training env always rolls its own seeded dice.

Network levels are measured on action space v1. Action space v2 (2026-11-18)
added 3:1 / 1:3 / 3:2 / 2:3 offers and stops offers the bank or a harbor
beats; the shipped levels were upgraded with the new offers frozen, so the
only change to their play is that rule.
