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

All three are seeded, so a rerun on unchanged code gives the same numbers.
