# Seafarers scenario migration to modular layouts

## Status

All 9 scenarios are now on the modular `ScenarioLayout` schema (frame + pools).
The migration was **structural**: hex positions, terrain mix, token list, and
port anchors were carried over from the pre-migration legacy data. Pool counts
match what the legacy code shipped, not the rulebook exactly — tightening to
official component counts (see "Per-scenario component counts" below) is a
follow-up after visual verification against [docs/.scenario-renders/].

| Scenario | Migrated? | 3p frame | 4p frame | 5-6p frame |
|---|---|---|---|---|
| Heading for New Shores | ✅ (approximate) | ✅ | ✅ | ✅ |
| Four Islands → Six Islands | ✅ (approximate) | ✅ | ✅ (= 3p) | ✅ |
| Fog Islands | ✅ (approximate) | ✅ | ✅ (= 3p) | ✅ |
| Through the Desert | ✅ (approximate) | ✅ | ✅ (= 3p) | ✅ |
| Forgotten Tribe | ✅ (approximate) | ✅ | ✅ (= 3p) | ✅ |
| Cloth for Catan | ✅ (approximate) | ✅ | ✅ (= 3p) | ✅ |
| Pirate Islands | ✅ (approximate) | ✅ | ✅ (= 3p) | ✅ |
| Wonders of Catan | ✅ (approximate) | ✅ | ✅ (= 3p) | ✅ |
| New World | ✅ (approximate) | ✅ | ✅ (= 3p) | ✅ |

All 9 scenarios now support 3-6 players. Per the 5-6p rulebook, Four Islands
at 5-6p is actually the distinct scenario "The Six Islands" (6 clusters
instead of 4, no gold, no desert) — our `fourIslands` entry swaps geometry
internally at 5-6p so the lobby still shows a single scenario name.

Most scenarios share the same frame for 3p and 4p (the legacy data didn't
distinguish them — `pickLayout` falls back to `layout3p` for 4p). Only
Heading for New Shores ships explicit 3p and 4p frames as printed in the
rulebook. All 5-6p frames fit within the radius-4 hex disk (61 hexes total);
rulebook component counts are matched exactly even when the rulebook total
hex count differs (e.g. Through the Desert is 63 hexes in the rulebook;
ours is 61 with the same 43 land hexes and 38 tokens).

## Token distribution rule

Number tokens are **symmetric around 7** in every layout: `count(N) == count(14-N)`.
This mirrors the natural symmetry of two-die rolls (P(2) = P(12), P(3) = P(11),
etc.). For odd-total layouts where strict symmetry is impossible, the
smallest possible asymmetry (1) is placed on the rarest pair (2/12 or 3/11)
so the most-common 6/8 always stay balanced.

## What "migrated" means

The scenario file:
- Defines a `ScenarioLayout` per supported player count (`layout3p`, optional `layout4p`, optional `layout5_6p`).
- Each layout is a **frame** (which `(q, r)` positions are land vs sea vs desert) plus three **pools** (terrain counts, token list, port-type list).
- The generator picks the layout matching the player count, draws terrain / tokens / ports from the pools using the seeded RNG, and respects the no-adjacent-6/8 rule.
- The board **shape** is deterministic per scenario × player count; the **contents** are randomized per game.

See `headingForNewShores.ts` for the canonical example.

## Per-scenario component counts (from the 2025 rulebook)

These need to be encoded as pools when migrating. Counts are `Sea | Gold | Hills(brick) | Forests(wood) | Pastures(sheep) | Fields(wheat) | Mountains(ore) | Deserts | TOTAL`, then number-disc counts `2,3,4,5,6,8,9,10,11,12`.

### Heading for New Shores (migrated)
- 3p: 13 / 2 / 4 / 3 / 5 / 4 / 4 / 0 / **35**. Tokens: 1,2,3,3,2,3,2,3,2,1 (=22). Ports: 5×2:1 + 3×3:1 = 8.
- 4p: 14 / 2 / 5 / 5 / 5 / 5 / 5 / 1 / **42**. Tokens: 2,3,3,3,3,3,3,3,3,1 (=27). Ports: 5×2:1 + 4×3:1 = 9.
- 5-6p: Phase 7.

### Four Islands
- 3p: 15 / 0 / 4 / 4 / 4 / 4 / 4 / 0 / **35**. Tokens: 1,2,2,3,2,2,3,2,2,1 (=20). Ports: 5×2:1 + 4×3:1 = 9.
- 4p: 12 / 0 / 4 / 5 / 5 / 5 / 4 / 0 / **35**. Tokens: 1,2,3,3,2,2,3,3,3,1 (=23). Ports: 9.
- 5-6p: separate scenario "The Six Islands" in the extension.

### Fog Islands
- 3p (start): 16 sea / 0 gold / 2 hills / 4 forests / 4 pastures / 2 fields / 2 mountains / 0 deserts (faceup) = **30** + 12 facedown. Facedown stack: 2 each of hills/forests/pastures/fields/mountains/(+2 sea) for reveal. Tokens: 14 faceup + 10 facedown.
- 4p (start): 13 / 0 / 3 / 4 / 4 / 3 / 3 / 0 + 12 facedown. Tokens: 17 faceup + 10 facedown.
- Mechanic: facedown stack draws on adjacent build (already wired via `fogHexes` + `revealAdjacentFog`). Migration needs a `facedownTerrainCounts` and `facedownTokens` pool extension.

### Through the Desert
- 3p: 10 / 2 / 3 / 5 / 4 / 4 / 4 / 3 / **35**. Tokens: 1,2,3,3,3,3,3,2,1,1 (=22). Ports: 5×2:1 + 3×3:1 = 8.
- 4p: 12 / 2 / 5 / 5 / 5 / 5 / 5 / 3 / **42**. Tokens: 1,3,3,3,3,3,3,3,3,2 (=27). Ports: 5×2:1 + 4×3:1 = 9.
- Mechanic: 3 deserts in a line bisect the main island. `desertIsBoundary: true` already wired.

### Forgotten Tribe
- 3-4p: 19 / 2 / 5 / 5 / 5 / 5 / 5 / 3 / **49**. Tokens: 1,2,2,2,2,2,2,2,2,1 (=18). Ports: 5×2:1 + 1×3:1 = 6.
- 5-6p: same scenario uses 5-6 player extension frame.
- Mechanic: tribe tokens (`tribeTokens` already wired).

### Cloth for Catan
- 3-4p: 18 / 2 / 3 / 4 / 4 / 5 / 4 / 2 / **42**. Tokens: 2,3,3,3,3,3,3,3,3,2 (=28). Ports: 5×2:1 + 4×3:1 = 9. Plus 8 cloth-village number discs on the 4 small islands.
- Mechanic: `clothHexes` already wired.

### Pirate Islands
- 3-4p: 19 / 2 / 5 / 5 / 5 / 5 / 5 / 3 / **49**. Tokens: 1,2,3,3,3,3,3,3,2,1 (=24, minus 6 hexes without tokens per the scenario rule). Ports: 5×2:1 + 3×3:1 = 8.
- Mechanic: `pirateFleet` + `attackPirateFleet` already wired.

### Wonders of Catan
- 3-4p: 19 / 2 / 5 / 5 / 5 / 5 / 5 / 3 / **49**. Tokens: 2,3,3,3,3,3,3,3,3,1 (=27). Ports: 5×2:1 + 4×3:1 = 9. Plus wonder tile placements.
- Mechanic: `state.wonders` + `buildWonder` already wired.

### New World
- 3-4p: 19 / 0 / 4 / 5 / 5 / 5 / 4 / 0 / **42**. Tokens: 1,3,3,3,2,2,3,3,2,1 (=23). Ports: 5×2:1 + 5×3:1 = 10.
- Mechanic: player-built (rulebook explicitly invites custom shaping). For our purposes pick a representative shape.

## Steps to migrate a scenario

1. Open the rendered diagram in `docs/.scenario-renders/seafarers-pXX.png` for the relevant pages.
2. Transcribe each hex position from the diagram. Mark each as `kind: 'land'`, `'sea'`, or `'desert'`.
3. For positions that must always be a specific terrain (rare — typically not needed, since rulebook randomizes terrain), set `fixedTerrain`.
4. Build `ScenarioPools` with the counts from the table above.
5. Transcribe port anchor positions. **Each anchor's `direction` must point to an explicit `kind: 'sea'` neighbor** (off-frame counts as `land` for the port-classification rule).
6. Replace the scenario's old `land` / `ports` / `landExtra5_6` / etc. fields with `layout3p` (and `layout4p` / `layout5_6p` if the rulebook has separate diagrams).
7. Verify the in-game `ScenarioPreview` shows the expected shape, then run the full test suite.

## Direction mapping (honeycomb-grid, pointy-top)

Empirically verified by inspecting `hex.corners` for known positions:

| dir | offset | name |
|---|---|---|
| 0 | (+1, 0) | E |
| 1 | (0, +1) | SE |
| 2 | (-1, +1) | SW |
| 3 | (-1, 0) | W |
| 4 | (0, -1) | NW |
| 5 | (+1, -1) | NE |

So a port `{ q, r, direction: 0 }` sits on the edge between hex `(q, r)` and hex `(q+1, r)`.

## Open verification items for Heading for New Shores

The shape was transcribed approximately from the rulebook page and counts match the rulebook component lists, but the **exact axial positions of hexes within the frame are not yet visually validated** against the diagrams in:
- `docs/.scenario-renders/seafarers-p04.png` (3p)
- `docs/.scenario-renders/seafarers-p05.png` (4p)

Once the `ScenarioPreview` component lands (next task), generate a board with a fixed seed and compare side-by-side with the rulebook diagram. Adjust positions to match.
