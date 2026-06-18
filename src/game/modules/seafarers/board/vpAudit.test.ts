import { describe, it } from 'vitest';
import { SCENARIO_ORDER, getScenario } from './scenarios';
import { generateSeafarersBoard } from './generator';

// Diagnostic — not an assertion test. Prints a chart of VP target vs
// available chip VP per scenario so a reviewer can sanity-check that the
// VP target is reachable given the chips. Run with:
//   npx vitest run src/game/modules/seafarers/board/vpAudit.test.ts
describe('seafarers scenario VP audit', () => {
  it('prints VP target + chip totals for every scenario', () => {
    const lines: string[] = [];
    for (const { id, label } of SCENARIO_ORDER) {
      const s = getScenario(id);
      for (const np of [3, 5] as const) {
        if (np === 5 && s.maxPlayers < 5) continue;
        try {
          const r = generateSeafarersBoard(id, 42, np);
          const target =
            np >= 5 && s.defaultVpToWin5_6 != null
              ? s.defaultVpToWin5_6
              : s.defaultVpToWin;
          const chipsTotal = r.islandChips.reduce((a, c) => a + c.vp, 0);
          lines.push(
            `${label.padEnd(28)} ${np}p · target=${String(target).padStart(2)}VP · chips=${r.islandChips.length}×${s.defaultIslandBonusVp}=${chipsTotal}VP · hexes=${r.board.hexIds.length}`,
          );
        } catch (e) {
          lines.push(`${label} ${np}p — ERROR: ${(e as Error).message}`);
        }
      }
    }
    // eslint-disable-next-line no-console
    console.log('\n' + lines.join('\n') + '\n');
  });
});
