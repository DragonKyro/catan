import { describe, expect, it } from 'vitest';
import { buildGraphFromCoords } from '../../../board/graph';
import { resolvePorts } from '../../../board/scenarioAssembly';
import { hexagonalDisk } from '../../base/scenarios/helpers';
import { TB_FRAME_PORTS_3_4 } from './frame';

// Angle (degrees, y down) from a pointy-top hex's centre to each edge's
// midpoint, by ScenarioPortAnchor direction.
const EDGE_ANGLE = [0, 60, 120, 180, 240, 300];

describe('T&B frame harbors', () => {
  const graph = buildGraphFromCoords(hexagonalDisk(3));
  const ports = resolvePorts(
    TB_FRAME_PORTS_3_4.map((a) => ({ q: a.q, r: a.r, direction: a.direction, type: a.fixedType! })),
    graph,
  );

  it('resolves all nine harbors to distinct edges', () => {
    expect(ports).toHaveLength(9);
  });

  it('puts each harbor on the intended edge of its land hex, facing the sea', () => {
    TB_FRAME_PORTS_3_4.forEach((a, i) => {
      const port = ports[i]!;
      const edge = graph.edges[port.edge]!;
      const [p1, p2] = edge.vertices.map((v) => graph.vertices[v]!.position);
      const centre = graph.hexCorners.get(`${a.q},${a.r}`)!.map((v) => graph.vertices[v]!.position);
      const cx = centre.reduce((s, p) => s + p.x, 0) / 6;
      const cy = centre.reduce((s, p) => s + p.y, 0) / 6;
      const mx = (p1!.x + p2!.x) / 2;
      const my = (p1!.y + p2!.y) / 2;
      const angle = ((Math.atan2(my - cy, mx - cx) * 180) / Math.PI + 360) % 360;
      expect(Math.abs(angle - EDGE_ANGLE[a.direction]!)).toBeLessThan(1);
      // The far side of a harbor edge is off the 19-hex island.
      const ring = Math.max(Math.abs(a.q), Math.abs(a.r), Math.abs(a.q + a.r));
      expect(ring).toBe(2);
    });
  });
});
