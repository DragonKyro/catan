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
import { PirateFleetMarker } from './seafarers/PirateFleetMarker';
import { ClothHexMarker } from './seafarers/ClothHexMarker';
import { VolcanoMarker } from './base/VolcanoMarker';
import { CityWallMarker } from './citiesAndKnights/CityWallMarker';
import { KnightPiece } from './citiesAndKnights/KnightPiece';
import { MetropolisMarker } from './citiesAndKnights/MetropolisMarker';
import { MerchantMarker } from './citiesAndKnights/MerchantMarker';
import { Bridge } from './traders/Bridge';
import { RiverEdgeMarker } from './traders/RiverEdgeMarker';
import { FishingGroundMarker } from './traders/FishingGroundMarker';
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
              const isRobbed =
                board.robberHex === hid && (game.robberActive ?? true);
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

        {game.riverEdges && (
          <g className="river-edges">
            {game.riverEdges.map((eid) => {
              // Hide the river decoration once a bridge spans the edge.
              const hasBridge = game.players.some((p) =>
                p.bridges?.includes(eid),
              );
              if (hasBridge) return null;
              return <RiverEdgeMarker key={eid} board={board} edge={eid} />;
            })}
          </g>
        )}

        <g className="roads">
          {game.players.flatMap((player) =>
            player.roads.map((eid) => (
              <Road key={eid} board={board} edge={eid} color={player.color} />
            )),
          )}
        </g>

        <g className="bridges">
          {game.players.flatMap((player) =>
            (player.bridges ?? []).map((eid) => (
              <Bridge key={eid} board={board} edge={eid} color={player.color} />
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

        <CityWallMarker game={game} />

        {/* Cities & Knights: knights on intersections + metropolis flags +
            merchant pawn. */}
        <g className="knights">
          {Object.entries(game.knights ?? {}).map(([vid, k]) => {
            const p = game.players.find((pl) => pl.id === k.playerId);
            if (!p) return null;
            return (
              <KnightPiece
                key={vid}
                board={board}
                vertex={vid}
                color={p.color}
                strength={k.strength}
                active={k.active}
              />
            );
          })}
        </g>
        <MetropolisMarker game={game} />
        <MerchantMarker game={game} />

        {/* Interactive ghosts render on top of pieces so the full circle is
            clickable — especially important for city upgrade, where the
            settlement icon would otherwise block clicks at the center. */}
        {overlay}

        {game.fishingGrounds && (
          <g className="fishing-grounds">
            {game.fishingGrounds.map((fg) => (
              <FishingGroundMarker
                key={fg.vertex}
                board={board}
                fg={fg}
                pulse={pulseToken != null && fg.token === pulseToken}
              />
            ))}
          </g>
        )}

        <Robber board={board} active={game.robberActive ?? true} />
        <PirateMarker board={board} />
        <PirateFleetMarker game={game} />
        <TribeTokenMarker game={game} />
        <ClothHexMarker game={game} />
        <VolcanoMarker board={board} />
      </svg>
    </div>
  );
}
