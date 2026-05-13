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
        <rect x={vb.x} y={vb.y} width={vb.width} height={vb.height} fill="var(--ocean)" />

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

        <PlacementOverlay />

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

        <Robber />
      </svg>
    </div>
  );
}
