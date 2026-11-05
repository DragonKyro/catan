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
import { ScenarioMarkers } from './seafarers/ScenarioMarkers';
import { VolcanoMarker } from './base/VolcanoMarker';
import { CityWallMarker } from './citiesAndKnights/CityWallMarker';
import { KnightPiece } from './citiesAndKnights/KnightPiece';
import { MetropolisMarker } from './citiesAndKnights/MetropolisMarker';
import { MerchantMarker } from './citiesAndKnights/MerchantMarker';
import { Bridge } from './traders/Bridge';
import { TradersBoardLayer } from './traders/TradersBoardLayer';
import { Wagon } from './traders/Wagon';
import { BarbarianAttackHexLayer, BarbarianAttackKnights } from './traders/BarbarianAttackBoard';
import { conqueredBuildingVertices } from '@/game/modules/traders/barbarianAttack/state';
import { WagonSpots } from './traders/WagonSpots';
import { WateringHoleMarker } from './traders/WateringHoleMarker';
import { DamagedRoadMarker } from './traders/DamagedRoadMarker';
import { TradersBarbariansHexLayer, TradersBarbariansPieces } from './traders/TradersBarbariansBoard';
import { hexRollsOn } from '@/game/board/hexNumbers';
import { isHarbor } from '@/game/modules/explorersPirates/state';
import { ExplorersPiratesHexLayer, ExplorersPiratesPieces } from './explorersPirates/ExplorersPiratesBoard';
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
  // T&B Barbarian Attack: conquered buildings are drawn tipped over.
  const conquered = conqueredBuildingVertices(game);

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
                pulseToken != null && hexRollsOn(hex, pulseToken) && !isRobbed && !isFoggy;
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

        <BarbarianAttackHexLayer game={game} />
        {/* T&B scenario: quarry / castle / glassworks with paths, plaza, X markers. */}
        <TradersBarbariansHexLayer game={game} />
        {/* T&B Merchant Trains: watering hole art + train start points. */}
        <WateringHoleMarker game={game} />
        {/* Explorers & Pirates: face-down backs, the Council, spice farms,
            pirate lairs, fish shoals. */}
        <ExplorersPiratesHexLayer game={game} />

        <g className="ports">
          {board.ports.map((p) => (
            <PortMarker key={p.edge} board={board} port={p} />
          ))}
        </g>

        {/* T&B Rivers of Catan / Fishing on Catan board art. */}
        <TradersBoardLayer game={game} pulseToken={pulseToken} />

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

        {/* T&B Catan Event Cards / Earthquake: damaged roads. */}
        {game.damagedRoads && (
          <g className="damaged-roads">
            {game.damagedRoads.map((eid) => (
              <DamagedRoadMarker key={eid} board={board} edge={eid} />
            ))}
          </g>
        )}

        {game.wagons && (
          <g className="wagons">
            {game.wagons.map((w) => (
              <Wagon key={w.edge} board={board} edge={w.edge} front={w.front} />
            ))}
          </g>
        )}
        {/* Merchant Trains voting round: the lettered places the wagon could go. */}
        <WagonSpots game={game} />

        {/* T&B / Barbarian Attack: knights on edges, above the roads. */}
        <BarbarianAttackKnights game={game} />

        <g className="ships">
          {game.players.flatMap((player) =>
            player.ships.map((eid) => (
              <Ship
                key={eid}
                board={board}
                edge={eid}
                color={player.color}
                warship={player.warships?.includes(eid)}
              />
            )),
          )}
        </g>

        <g className="settlements">
          {game.players.flatMap((player) =>
            // Explorers & Pirates harbor settlements are drawn as their own
            // piece (ExplorersPiratesPieces).
            player.settlements.filter((vid) => !isHarbor(game, vid)).map((vid) => (
              <Settlement
                key={vid}
                board={board}
                vertex={vid}
                color={player.color}
                tipped={conquered.has(vid)}
              />
            )),
          )}
        </g>

        {/* Cities & Knights walls sit UNDER their cities. */}
        <CityWallMarker game={game} />

        <g className="cities">
          {game.players.flatMap((player) =>
            player.cities.map((vid) => (
              <City
                key={`${player.id}-${vid}`}
                board={board}
                vertex={vid}
                color={player.color}
                tipped={conquered.has(vid)}
              />
            )),
          )}
        </g>

        {/* T&B scenario: barbarians on edges, players' wagons. */}
        <TradersBarbariansPieces game={game} />
        {/* Explorers & Pirates: harbor settlements, ships, the pirate ship. */}
        <ExplorersPiratesPieces game={game} />
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
        {/* Seafarers scenario markers: below the overlay so they never
            block a click on a ghost. */}
        <ScenarioMarkers game={game} />

        {/* Interactive ghosts render on top of pieces so the full circle is
            clickable — especially important for city upgrade, where the
            settlement icon would otherwise block clicks at the center. */}
        {overlay}

        <Robber board={board} active={game.robberActive ?? true} />
        <PirateMarker board={board} fleet={game.pirateIslands !== undefined} />
        <VolcanoMarker board={board} />
      </svg>
    </div>
  );
}
