import type { GameState } from '@/game/types';
import type { ReactNode } from 'react';
import { getViewBox } from './boardLayout';
import { HexTile } from './HexTile';
import { PortMarker } from './PortMarker';
import { Robber } from './Robber';
import { Settlement } from './Settlement';
import { City } from './City';
import { Road } from './Road';
import { Ship } from './seafarers/Ship';
import { PirateMarker } from './seafarers/PirateMarker';
import { TribeTokenMarker } from './seafarers/TribeTokenMarker';
import './Board.css';

interface Props {
  game: GameState;
  // Optional content rendered above pieces but below the robber — used by
  // the live Board to overlay PlacementOverlay (interactive ghosts). Replay
  // omits this since it's read-only.
  overlay?: ReactNode;
  // Class on the outer wrapper. Replay can use a smaller variant.
  className?: string;
  // When set, hexes whose token matches this number get a production
  // pulse animation (live Board only; replay leaves this undefined).
  pulseToken?: number | null;
}

// Pure presentational board renderer. Takes the full game state and draws
// hexes, ports, roads, ships, settlements, cities, and the robber/pirate.
// All sub-components are prop-driven so this can be reused for end-game
// replay against any historical GameState.
export function BoardSVG({ game, overlay, className, pulseToken }: Props) {
  const board = game.board;
  const vb = getViewBox(board);

  return (
    <div className={className ?? 'board-wrap'}>
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
          {(() => {
            const foggySet = new Set(game.unrevealedFogHexes ?? []);
            return board.hexIds.map((hid) => {
              const hex = board.hexes[hid]!;
              const isRobbed = board.robberHex === hid;
              const isFoggy = foggySet.has(hid);
              const shouldPulse =
                pulseToken != null && hex.numberToken === pulseToken && !isRobbed && !isFoggy;
              return (
                <HexTile
                  key={hid}
                  board={board}
                  hex={hex}
                  isRobberOnHex={isRobbed}
                  clickable={false}
                  pulse={shouldPulse}
                  foggy={isFoggy}
                />
              );
            });
          })()}
        </g>

        <g className="ports">
          {board.ports.map((p) => (
            <PortMarker key={p.edge} board={board} port={p} />
          ))}
        </g>

        <g className="roads">
          {game.players.flatMap((player) =>
            player.roads.map((eid) => (
              <Road key={eid} board={board} edge={eid} color={player.color} />
            )),
          )}
        </g>

        <g className="ships">
          {game.players.flatMap((player) =>
            player.ships.map((eid) => (
              <Ship key={eid} board={board} edge={eid} color={player.color} />
            )),
          )}
        </g>

        <g className="settlements">
          {game.players.flatMap((player) =>
            player.settlements.map((vid) => (
              <Settlement key={vid} board={board} vertex={vid} color={player.color} />
            )),
          )}
        </g>

        <g className="cities">
          {game.players.flatMap((player) =>
            player.cities.map((vid) => (
              <City key={`${player.id}-${vid}`} board={board} vertex={vid} color={player.color} />
            )),
          )}
        </g>

        {/* Interactive ghosts render on top of pieces so the full circle is
            clickable — especially important for city upgrade, where the
            settlement icon would otherwise block clicks at the center. */}
        {overlay}

        <Robber board={board} />
        <PirateMarker board={board} />
        <TribeTokenMarker game={game} />
      </svg>
    </div>
  );
}
