import { describe, it } from 'vitest';
import { generateSeafarersBoard } from './generator';
import { getScenario } from './scenarios';

describe('direction debug', () => {
  it('prints all 6 directions for several anchors', () => {
    const { board } = generateSeafarersBoard('headingForNewShores', 1, 3);
    const scenario = getScenario('headingForNewShores');
    const layout = scenario.layout3p!;

    // Test a few central hexes
    const testAnchors = [
      { q: 0, r: 0 },
      { q: 1, r: -1 },
      { q: -2, r: 2 },
      { q: 3, r: 0 },
    ];

    for (const a of testAnchors) {
      const hexId = `${a.q},${a.r}`;
      const hex = board.hexes[hexId];
      if (!hex) {
        console.log(`Anchor (${a.q},${a.r}): not in board`);
        continue;
      }
      console.log(`\n=== Anchor (${a.q},${a.r}) ===`);
      for (let d = 0; d < 6; d++) {
        const v1 = hex.corners[d]!;
        const v2 = hex.corners[(d + 1) % 6]!;
        const edge = Object.values(board.edges).find(
          (e) =>
            (e.vertices[0] === v1 && e.vertices[1] === v2) ||
            (e.vertices[0] === v2 && e.vertices[1] === v1),
        );
        if (!edge) {
          console.log(`  dir ${d}: NO EDGE`);
          continue;
        }
        const otherHexIds = edge.hexes.filter((h) => h !== hexId);
        const others = otherHexIds.length === 0
          ? 'OFF-FRAME'
          : otherHexIds.map((h) => {
              const coord = board.hexes[h]!.coord;
              return `(${coord.q},${coord.r}=${board.hexes[h]!.terrain})`;
            }).join(', ');
        console.log(`  dir ${d}: ${others}`);
      }
    }
    // Also dump layout positions for reference
    console.log('\n=== layout3p positions ===');
    for (const p of layout.positions) {
      console.log(`  (${p.q},${p.r}) ${p.kind}`);
    }
  });
});
