import { useGameStore } from '@/store/gameStore';
import { getViewBox } from './boardLayout';
import { HexTile } from './HexTile';
import { PortMarker } from './PortMarker';
import { Robber } from './Robber';
import { Settlement } from './Settlement';
import { City } from './City';
import { Road } from './Road';
import { PlacementOverlay } from './PlacementOverlay';
import './Board.css';

export function Board() {
  const game = useGameStore((s) => s.game!);
  const board = game.board;
  const vb = getViewBox(board);

  return (
    <div className="board-wrap">
      <svg
        className="board-svg"
        viewBox={`${vb.x} ${vb.y} ${vb.width} ${vb.height}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Subtle wave pattern for the ocean. Two-row offset crests at
              low opacity so the board doesn't compete with the hexes. */}
          <pattern
            id="ocean-waves"
            x={0}
            y={0}
            width={28}
            height={20}
            patternUnits="userSpaceOnUse"
          >
            <rect width={28} height={20} fill="var(--ocean)" />
            <path
              d="M0,8 q3,-3 6,0 t6,0 t6,0 t6,0"
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={1}
              strokeLinecap="round"
            />
            <path
              d="M-14,18 q3,-3 6,0 t6,0 t6,0 t6,0 t6,0 t6,0"
              fill="none"
              stroke="rgba(255,255,255,0.05)"
              strokeWidth={1}
              strokeLinecap="round"
            />
          </pattern>
        </defs>
        <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill="url(#ocean-waves)" />

        <g className="hexes">
          {board.hexIds.map((hid) => (
            <HexTile
              key={hid}
              hex={board.hexes[hid]!}
              isRobberOnHex={board.robberHex === hid}
              clickable={false}
            />
          ))}
        </g>

        <g className="ports">
          {board.ports.map((p) => (
            <PortMarker key={p.edge} port={p} />
          ))}
        </g>

        <g className="roads">
          {game.players.flatMap((player) =>
            player.roads.map((eid) => (
              <Road key={eid} edge={eid} color={player.color} />
            )),
          )}
        </g>

        <g className="settlements">
          {game.players.flatMap((player) =>
            player.settlements.map((vid) => (
              <Settlement key={vid} vertex={vid} color={player.color} />
            )),
          )}
        </g>

        <g className="cities">
          {game.players.flatMap((player) =>
            player.cities.map((vid) => (
              <City key={`${player.id}-${vid}`} vertex={vid} color={player.color} />
            )),
          )}
        </g>

        {/* Placement ghosts render on top of pieces so the full circle is
            clickable — especially important for city upgrade, where the
            settlement icon would otherwise block clicks at the center. */}
        <PlacementOverlay />

        <Robber />
      </svg>
    </div>
  );
}
