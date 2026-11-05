import type { EdgeId, EpShip, GameState, VertexId } from '@/game/types';

// Where Explorers & Pirates pieces sit on the board, shared by the board
// art and the click overlay so a click target always lands on its piece.

export interface Pt {
  x: number;
  y: number;
}

export function edgeEnds(game: GameState, edge: EdgeId): [Pt, Pt] {
  const e = game.board.edges[edge]!;
  return [game.board.vertices[e.vertices[0]]!.position, game.board.vertices[e.vertices[1]]!.position];
}

export function edgeMid(game: GameState, edge: EdgeId): Pt {
  const [a, b] = edgeEnds(game, edge);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// A ship's spot on its edge: alone in the middle; with company spread along
// the edge (up to 2 ships share an edge, 3 while one passes through), with
// a slight sideways nudge so the hulls don't stack.
export function epShipSpot(game: GameState, ship: EpShip): Pt {
  const ships = game.explorersPirates?.ships.filter((s) => s.edge === ship.edge) ?? [ship];
  const n = Math.max(1, ships.length);
  const i = Math.max(0, ships.findIndex((s) => s.id === ship.id));
  const [a, b] = edgeEnds(game, ship.edge);
  const t = n === 1 ? 0.5 : (i + 1) / (n + 1);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const side = n === 1 ? 0 : i % 2 === 0 ? -3 : 3;
  return {
    x: a.x + dx * t + (-dy / len) * side,
    y: a.y + dy * t + (dx / len) * side,
  };
}

// Unit vector from an intersection out to sea (the mean of its sea hexes'
// centres), for the little dock that shows a harbor settlement's pieces.
export function seaward(game: GameState, vertex: VertexId): Pt {
  const v = game.board.vertices[vertex]!;
  const p = v.position;
  let sx = 0;
  let sy = 0;
  let land = { x: 0, y: 0 };
  let nLand = 0;
  for (const h of v.hexes) {
    const hex = game.board.hexes[h]!;
    if (hex.terrain === 'sea') {
      sx += hex.center.x - p.x;
      sy += hex.center.y - p.y;
    } else {
      land = { x: land.x + hex.center.x, y: land.y + hex.center.y };
      nLand++;
    }
  }
  if (sx === 0 && sy === 0 && nLand > 0) {
    sx = p.x - land.x / nLand;
    sy = p.y - land.y / nLand;
  }
  const len = Math.hypot(sx, sy) || 1;
  return { x: sx / len, y: sy / len };
}
