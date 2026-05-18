import { useGameStore, getActingPlayerId } from '@/store/gameStore';
import { useNetworkStore, getMyPlayerId } from '@/store/networkStore';
import { calculateVictoryPoints, calculateIslandChipVp } from '@/game/scoring/points';
import { calculateLongestRoad } from '@/game/scoring/longestRoad';
import { totalResources } from '@/game/resources';
import { totalCommodities } from '@/game/commodities';
import { pairedPlayer2Index, usesPairedRules } from '@/game/helpers';
import { playerColorVar } from '@/ui/shared/playerColors';
import { SEAFARERS_EXPANSION_ID } from '@/game/modules/seafarers/constants';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import './OpponentPanel.css';

// Base game piece limits per player. Engine already enforces these via the
// `length < N` checks in build handlers; surfaced here so players can see at
// a glance how much expansion runway each opponent has left.
const MAX_SETTLEMENTS = 5;
const MAX_CITIES = 4;
const MAX_ROADS = 15;
const MAX_SHIPS = 15;

export function OpponentPanel() {
  const game = useGameStore((s) => s.game!);
  const role = useNetworkStore((s) => s.role);
  const onlineUuids = useNetworkStore((s) => s.onlineUuids);
  const uuidForPlayer = useNetworkStore((s) => s.uuidForPlayer);

  // The right-panel player list shows EVERY player so the active-turn
  // highlight has a place to land (the local player's full hand still lives
  // in the bottom strip — this is just a status row).
  // Order by `playerOrder` (turn order) so adjacent rows match adjacent
  // turns — more useful than seat-creation order for "who goes after me?".
  const opponents = game.playerOrder
    .map((id) => game.players.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));
  const actingId = getActingPlayerId(game);
  const hasSeafarers = game.settings.expansions.includes(SEAFARERS_EXPANSION_ID);
  const hasCK = game.settings.expansions.includes(CITIES_AND_KNIGHTS_EXPANSION_ID);

  // 5+ player paired-player rule: identify Player 1 (the dice-roller) and
  // Player 2 (third seat to P1's left) for the current paired turn so we
  // can mark them in the panel. Returns null in 3-4p games.
  const paired = usesPairedRules(game)
    ? {
        p1: game.playerOrder[game.turnHolderIndex ?? game.currentPlayerIndex]!,
        p2: game.playerOrder[pairedPlayer2Index(game)!]!,
      }
    : null;
  // The "partner" row gets a sky-blue highlight so both paired seats are
  // visually distinct from each other and from the other 3-6 players.
  // Whichever of the pair is currently acting gets the gold .opp-acting
  // treatment; the OTHER gets .opp-partner.
  const partnerId =
    paired && (paired.p1 === actingId ? paired.p2 : paired.p1);

  // Mark "you" so the player can find themselves quickly. In solo mode we
  // call out the device-bound human; online uses the local seat.
  let localId: string | null = null;
  if (role === 'solo') {
    localId =
      game.players.find((p) => !p.isAI)?.id ?? null;
  } else if (role === 'guest' || role === 'host') {
    localId = getMyPlayerId(game);
  }

  return (
    <section className="opps">
      {opponents.map((p) => {
        const visibleVp = calculateVictoryPoints(game, p.id, false);
        const cards = p.devCards.unplayed.length + p.devCards.boughtThisTurn.length;
        const isActing = p.id === actingId;
        const isPartner = !!partnerId && p.id === partnerId;
        const uuid = uuidForPlayer(p.id);
        const onlineStatus: 'na' | 'online' | 'offline' =
          role === 'solo' || p.isAI
            ? 'na'
            : uuid && onlineUuids.has(uuid)
              ? 'online'
              : 'offline';
        return (
          <div
            key={p.id}
            className={`opp ${isActing ? 'opp-acting' : ''} ${isPartner ? 'opp-partner' : ''}`}
          >
            <div className="opp-head">
              <span
                className="opp-swatch"
                style={{ background: playerColorVar(p.color) }}
              />
              <span className="opp-name">
                {p.name}
                {p.id === localId && <span className="opp-tag">YOU</span>}
                {p.isAI && <span className="opp-tag">AI</span>}
                {paired && p.id === paired.p1 && (
                  <span className="opp-tag" title="Player 1 — rolls dice, full trade rights">P1</span>
                )}
                {paired && p.id === paired.p2 && (
                  <span className="opp-tag" title="Player 2 — paired turn, bank trades only">P2</span>
                )}
                {onlineStatus !== 'na' && (
                  <span className={`opp-dot ${onlineStatus}`} />
                )}
              </span>
              <span
                className="opp-vp"
                title={
                  cards > 0
                    ? `Visible VP — could be higher with hidden VP dev cards (first to ${game.settings.victoryPointsToWin} wins)`
                    : `Visible VP (first to ${game.settings.victoryPointsToWin} wins)`
                }
              >
                {visibleVp}
                {cards > 0 ? '+' : ''}/{game.settings.victoryPointsToWin} VP
              </span>
            </div>
            <div className="opp-stats">
              <span title="Resource cards">🂠 {totalResources(p.resources)}</span>
              <span title="Dev cards (face down)">🂡 {cards}</span>
              <span title="Knights played">⚔️ {p.devCards.playedKnights}</span>
              <span title="Longest contiguous road">
                📏 {calculateLongestRoad(game, p.id)}
              </span>
              {p.hasLongestRoad && <span title="Longest Road bonus">★ Road</span>}
              {p.hasLargestArmy && <span title="Largest Army bonus">★ Army</span>}
              {(() => {
                const chipVp = calculateIslandChipVp(game, p.id);
                return chipVp > 0 ? (
                  <span title={`Outer-island settlement bonuses (+${chipVp} VP)`}>
                    🏝 +{chipVp}
                  </span>
                ) : null;
              })()}
              {p.cloth && p.cloth > 0 && (
                <span title={`Cloth tokens — ${p.cloth} cloth = ${Math.floor(p.cloth / 2)} VP`}>
                  🧵 {p.cloth}
                </span>
              )}
              {hasCK && p.commodities && totalCommodities(p.commodities) > 0 && (
                <span title="Commodity cards (paper / cloth / coin)">
                  📜 {totalCommodities(p.commodities)}
                </span>
              )}
              {hasCK && (p.cityWalls ?? 0) > 0 && (
                <span title={`City walls (+${(p.cityWalls ?? 0) * 2} 7-roll hand limit)`}>
                  🧱 {p.cityWalls}
                </span>
              )}
              {(p.gold ?? 0) > 0 && (
                <span title={`Gold — ${p.gold} coins`}>🪙 {p.gold}</span>
              )}
              {game.wealthTiles?.wealthiest === p.id && (
                <span title="Wealthiest Catanian (+1 VP)">👑</span>
              )}
              {game.wealthTiles?.poor.includes(p.id) && (
                <span title="Poor Catanian (-2 VP)">👜</span>
              )}
              {game.strongestPorts?.holder === p.id && (
                <span title="Strongest Ports (+2 VP)">⚓</span>
              )}
              {(p.fishTokens?.length ?? 0) > 0 && (
                <span
                  title={`Fish tokens — ${p.fishTokens!.length} held`}
                >
                  🐟 {p.fishTokens!.length}
                </span>
              )}
              {game.oldBootHolder === p.id && (
                <span title="Old boot — needs +1 VP to win">👢</span>
              )}
            </div>
            <div className="opp-pieces" title="Pieces remaining (built / cap)">
              <span title={`Settlements: ${p.settlements.length}/${MAX_SETTLEMENTS}`}>
                🏠 {MAX_SETTLEMENTS - p.settlements.length}
              </span>
              <span title={`Cities: ${p.cities.length}/${MAX_CITIES}`}>
                🏛️ {MAX_CITIES - p.cities.length}
              </span>
              <span title={`Roads: ${p.roads.length}/${MAX_ROADS}`}>
                🛣️ {MAX_ROADS - p.roads.length}
              </span>
              {(hasSeafarers || p.ships.length > 0) && (
                <span title={`Ships: ${p.ships.length}/${MAX_SHIPS}`}>
                  ⛵ {MAX_SHIPS - p.ships.length}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
