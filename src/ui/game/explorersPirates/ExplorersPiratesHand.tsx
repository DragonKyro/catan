import type { GameState, Player, PlayerId } from '@/game/types';
import {
  bonusTileHolder,
  epSupply,
  harborsOf,
  isExplorersPirates,
  shipsOf,
  trackPosition,
  trackLength,
} from '@/game/modules/explorersPirates/state';
import {
  EP_BONUS_TILE_NAMES,
  EP_MISSIONS,
  EP_MISSION_NAMES,
  EP_PIECES,
} from '@/game/modules/explorersPirates/constants';
import { MAX_GOLD_SPENDS_PER_TURN } from '@/game/modules/traders/constants';
import { CoinIcon } from '@/ui/game/traders/TradersIcons';
import { CargoIcon, EpShipIcon, HarborIcon, MissionIcon, PirateShipIcon } from './EpArt';

// Explorers & Pirates rows for the HandPanel (the device's gold and the
// pieces it has left, its mission markers in the header) and the
// OpponentPanel (gold is shown there already; harbors, ships, mission
// positions and the pieces each player has left).

export function EpHandStrip({ game, player, ownTurn }: { game: GameState; player: Player; ownTurn: boolean }) {
  if (!isExplorersPirates(game)) return null;
  const s = epSupply(game, player.id);
  const harbors = harborsOf(game, player.id).length;
  const ships = shipsOf(game, player.id);
  const gold = player.gold ?? 0;
  const spendsLeft = MAX_GOLD_SPENDS_PER_TURN - (ownTurn ? game.goldSpendsThisTurn ?? 0 : 0);
  return (
    <div className="hand-traders hand-ep">
      <span
        className="hand-traders-group"
        title={`Gold: ${gold}. 2 gold buys any resource card (${spendsLeft} of ${MAX_GOLD_SPENDS_PER_TURN} left this turn); 3 cards buy 1 gold. Tributes are paid in gold; a pirate takes 1 gold from a player with no cards.`}
      >
        <CoinIcon size={17} />
        <span className="hand-traders-count">{gold}</span>
      </span>
      <span className="hand-traders-group" title={`Harbor settlements: ${harbors} built, ${s.harbors} of ${EP_PIECES.harbors} left (2 VP each)`}>
        <HarborIcon color={player.color} size={17} />
        <span className="hand-traders-count">{s.harbors}</span>
      </span>
      <span className="hand-traders-group" title={`Settlements: ${s.settlements} of ${EP_PIECES.settlements} left`}>
        🏠<span className="hand-traders-count">{s.settlements}</span>
      </span>
      <span className="hand-traders-group" title={`Roads: ${s.roads} of ${EP_PIECES.roads} left`}>
        🛣<span className="hand-traders-count">{s.roads}</span>
      </span>
      <span className="hand-traders-group" title={`Ships: ${ships.length} on the board, ${s.ships} of ${EP_PIECES.ships} left`}>
        <EpShipIcon color={player.color} size={17} />
        <span className="hand-traders-count">{s.ships}</span>
      </span>
      <span className="hand-traders-group" title={`Settlers: ${s.settlers} of ${EP_PIECES.settlers} left`}>
        <CargoIcon piece="settler" color={player.color} size={15} />
        <span className="hand-traders-count">{s.settlers}</span>
      </span>
      <span className="hand-traders-group" title={`Crews: ${s.crews} of ${EP_PIECES.crews} left`}>
        <CargoIcon piece="crew" color={player.color} size={15} />
        <span className="hand-traders-count">{s.crews}</span>
      </span>
    </div>
  );
}

// Mission track markers (position on each track, ★ = holds the bonus tile).
export function MissionChips({ game, playerId, className }: { game: GameState; playerId: PlayerId; className: string }) {
  if (!isExplorersPirates(game)) return null;
  return (
    <>
      {EP_MISSIONS.map((m) => {
        const pos = trackPosition(game, m, playerId);
        const lead = bonusTileHolder(game, m) === playerId;
        return (
          <span
            key={m}
            className={className}
            title={`${EP_MISSION_NAMES[m]}: space ${pos} of ${trackLength(m)}${lead ? ` — holds ${EP_BONUS_TILE_NAMES[m]} (+1 VP)` : ''}`}
          >
            <MissionIcon mission={m} size={14} />
            {pos}
            {lead && <span style={{ color: 'var(--accent)' }}>★</span>}
          </span>
        );
      })}
    </>
  );
}

export function EpOpponentStats({ game, player }: { game: GameState; player: Player }) {
  if (!isExplorersPirates(game)) return null;
  const harbors = harborsOf(game, player.id).length;
  const ships = shipsOf(game, player.id);
  const pirate = game.explorersPirates.pirate?.owner === player.id;
  return (
    <>
      <span className="opp-icon" title={`Harbor settlements: ${harbors} (2 VP each)`}>
        <HarborIcon color={player.color} size={15} /> {harbors}
      </span>
      <span
        className="opp-icon"
        title={`Ships on the board: ${ships.length}${ships.some((s) => s.cargo.length) ? ` (carrying ${ships.flatMap((s) => s.cargo).join(', ')})` : ''}`}
      >
        <EpShipIcon color={player.color} size={15} /> {ships.length}
      </span>
      <MissionChips game={game} playerId={player.id} className="opp-icon" />
      {pirate && (
        <span className="opp-icon" title="Their pirate ship is on the board: other ships pay them 1 gold tribute near it">
          <PirateShipIcon color={player.color} size={16} />
        </span>
      )}
    </>
  );
}

export function EpOpponentPieces({ game, player }: { game: GameState; player: Player }) {
  if (!isExplorersPirates(game)) return null;
  const s = epSupply(game, player.id);
  return (
    <div className="opp-pieces" title="Pieces left in supply">
      <span title={`Settlements left: ${s.settlements}/${EP_PIECES.settlements}`}>🏠 {s.settlements}</span>
      <span className="opp-icon" title={`Harbor settlements left: ${s.harbors}/${EP_PIECES.harbors}`}>
        <HarborIcon color={player.color} size={13} /> {s.harbors}
      </span>
      <span title={`Roads left: ${s.roads}/${EP_PIECES.roads}`}>🛣️ {s.roads}</span>
      <span className="opp-icon" title={`Ships left: ${s.ships}/${EP_PIECES.ships}`}>
        <EpShipIcon color={player.color} size={13} /> {s.ships}
      </span>
      <span className="opp-icon" title={`Settlers left: ${s.settlers}/${EP_PIECES.settlers}`}>
        <CargoIcon piece="settler" color={player.color} size={13} /> {s.settlers}
      </span>
      <span className="opp-icon" title={`Crews left: ${s.crews}/${EP_PIECES.crews}`}>
        <CargoIcon piece="crew" color={player.color} size={13} /> {s.crews}
      </span>
    </div>
  );
}
