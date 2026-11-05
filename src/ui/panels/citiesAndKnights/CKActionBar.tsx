import type { GameState, Player, PlayerId } from '@/game/types';
import { COSTS } from '@/game/types';
import type { UIMode } from '@/store/gameStore';
import { useGameStore } from '@/store/gameStore';
import { Button } from '@/ui/shared/Button';
import { canAfford } from '@/game/resources';
import { cityWallSites } from '@/game/modules/citiesAndKnights/actions/buildCityWall';
import { progressCardBlocker } from '@/game/modules/citiesAndKnights/actions/playProgressCard';
import { commercialHarborTargets } from '@/game/modules/citiesAndKnights/actions/commercialHarborOffer';
import { hasKnightAction } from '@/game/modules/citiesAndKnights/knights/legal';
import { MAX_CITY_WALLS, PROGRESS_CARD_HAND_LIMIT } from '@/game/modules/citiesAndKnights/constants';
import { progressHandSize } from '@/game/modules/citiesAndKnights/progress/hand';
import { playerName } from '@/ui/dialogs/citiesAndKnights/common';

// Cities & Knights pieces of the ActionBar, kept here so the shared bar only
// calls in at a few points.

// Roll Dice phase: Alchemy may be played before rolling (p.6).
export function CKRollExtras({ game, acting }: { game: GameState; acting: PlayerId }) {
  const { openDialog } = useGameStore();
  if (game.pendingAlchemy) {
    const [r, y] = game.pendingAlchemy;
    return (
      <div className="actionbar-hint actionbar-slot-wide">
        ⚗ Alchemy: the dice will show {r} (red) + {y} = {r + y}; the event die still rolls.
      </div>
    );
  }
  if (progressCardBlocker(game, acting, 'alchemy')) return null;
  return (
    <div className="actionbar-slot actionbar-slot-wide">
      <Button fullWidth onClick={() => openDialog('alchemy')} title="Alchemy: set the production dice before you roll">
        ⚗ Alchemy
      </Button>
    </div>
  );
}

// Action phase buttons (after Road / Settlement / City).
export function CKMainButtons({ game, acting, player }: { game: GameState; acting: PlayerId; player: Player }) {
  const { openDialog, setMode } = useGameStore();
  const cards = progressHandSize(player);
  const harborLeft = game.commercialHarbor?.offererId === acting ? commercialHarborTargets(game).length : 0;
  const knightsBusy = hasKnightAction(game, acting);
  const walls = player.cityWalls ?? 0;
  const wallReason =
    walls >= MAX_CITY_WALLS
      ? `You have the maximum ${MAX_CITY_WALLS} walls`
      : cityWallSites(game, acting).length === 0
        ? 'Walls go under your cities (one each)'
        : !game.engineeringActive && !canAfford(player.resources, COSTS.cityWall)
          ? 'Needs 2 brick'
          : null;
  return (
    <>
      <Button
        disabled={!!wallReason}
        onClick={() => setMode({ kind: 'buildCityWall' })}
        title={wallReason ?? `City wall (2🧱${game.engineeringActive ? ' — free: Engineering' : ''}) — hold 2 more cards on a 7`}
      >
        🧱 Wall{game.engineeringActive ? ' (free)' : ''}
      </Button>
      <Button
        onClick={() => openDialog('knights')}
        title="Knights: recruit (1🐑 1🪨), activate (1🌾), promote (1🐑 1🪨), move, displace, chase the robber"
      >
        ⚔ Knights{knightsBusy ? ' •' : ''}
      </Button>
      <Button onClick={() => openDialog('cityImprovements')} title="City improvements (paper / cloth / coin)">
        🏛 Improve
      </Button>
      <Button
        onClick={() => openDialog('progressCards')}
        title={`Progress cards (${cards} in hand, limit ${PROGRESS_CARD_HAND_LIMIT})`}
      >
        🃏 Cards ({cards})
      </Button>
      {harborLeft > 0 && (
        <Button onClick={() => openDialog('commercialHarbor')} title="Commercial Harbor: offers left this turn">
          ⚓ Harbor ({harborLeft})
        </Button>
      )}
      {game.diplomacyFreeRoad && (
        <Button variant="primary" onClick={() => setMode({ kind: 'buildRoad' })} title="Diplomacy: build 1 road for free">
          🛣 Free road
        </Button>
      )}
      {game.medicineActive && (
        <Button onClick={() => setMode({ kind: 'buildCity' })} title="Medicine: your next city costs 1 wheat + 2 ore">
          💊 City (1🌾 2🪨)
        </Button>
      )}
      {game.merchantFleetActive && (
        <Button
          onClick={() => openDialog('bankTrade')}
          title={`Merchant Fleet: 2:1 ${game.merchantFleetActive.which} with the supply this turn`}
        >
          ⛵ 2:1 {game.merchantFleetActive.which}
        </Button>
      )}
    </>
  );
}

export function ckModeHint(mode: UIMode): string | null {
  switch (mode.kind) {
    case 'buildCityWall':
      return 'Pick one of your cities for the wall.';
    case 'engineering':
      return 'Engineering: pick a city for the free wall.';
    case 'medicine':
      return 'Medicine: pick a settlement to upgrade for 1 wheat + 2 ore.';
    case 'recruitKnight':
      return 'Pick an empty intersection on one of your roads for the new (inactive) knight.';
    case 'activateKnight':
      return 'Pick an inactive knight to stand up (1 wheat). It can act from your next turn.';
    case 'promoteKnight':
      return 'Pick a knight to promote (1 wool + 1 ore).';
    case 'moveKnight':
      return mode.sourceVertex
        ? 'Pick where it goes: an empty spot along your roads, a weaker enemy knight (red), or the robber.'
        : 'Pick one of your acting knights.';
    case 'displaceKnight':
      return mode.sourceVertex ? 'Pick the weaker knight to displace.' : 'Pick one of your acting knights.';
    case 'chaseRobber':
      return 'Pick an acting knight next to the robber.';
    case 'smithing':
      return `Smithing: pick up to 2 knights to promote for free (${mode.selected.length} picked).`;
    case 'intrigue':
      return 'Intrigue: pick an opposing knight on one of your roads to displace.';
    case 'swapTokens':
      return mode.firstHex ? 'Invention: pick the second disc.' : 'Invention: pick the first number disc (not 2, 6, 8, 12).';
    case 'progressRoadBuilding':
      return mode.first ? 'Road Building: place the second road (or finish with one).' : 'Road Building: place 2 free roads.';
    default:
      return null;
  }
}

// Extra buttons while a C&K card mode is open.
export function CKModeExtras({ acting, uiMode }: { acting: PlayerId; uiMode: UIMode }) {
  const { dispatch, setMode } = useGameStore();
  if (uiMode.kind === 'smithing') {
    return (
      <Button
        variant="primary"
        disabled={uiMode.selected.length === 0}
        onClick={() => {
          dispatch({ type: 'playProgressCard', playerId: acting, card: 'smithing', knightVertices: uiMode.selected });
          setMode({ kind: 'idle' });
        }}
      >
        Promote {uiMode.selected.length}
      </Button>
    );
  }
  if (uiMode.kind === 'progressRoadBuilding' && uiMode.first) {
    return (
      <Button
        onClick={() => {
          dispatch({ type: 'playProgressCard', playerId: acting, card: 'progressRoadBuilding', edges: [uiMode.first!] });
          setMode({ kind: 'idle' });
        }}
      >
        Done (1 road)
      </Button>
    );
  }
  return null;
}

// What the decider is asked to do in a board-driven C&K sub-phase.
export function ckPhaseHint(game: GameState, pid: PlayerId): string | null {
  switch (game.phase) {
    case 'choosePillage':
      return 'The barbarians won! Pick one of your cities (without a metropolis) to be pillaged.';
    case 'placeMetropolis':
      return 'You won a metropolis! Pick one of your cities to place it on.';
    case 'displacedKnightMove':
      return 'Your knight was displaced: move it to an empty intersection along your roads.';
    case 'placeMerchant':
      return 'Merchant: pick a land hex next to one of your buildings.';
    case 'removeRoad':
      return 'Diplomacy: pick an open road to remove (yours lets you build one for free).';
    case 'treasonRemoveKnight':
      return `Treason by ${playerName(game, game.pendingTreason?.attackerId ?? pid)}: pick one of your knights to remove.`;
    case 'moveRobber':
      return game.pendingRobberMove?.reason === 'taxation'
        ? 'Taxation: move the robber — you steal 1 card from every player there.'
        : null;
    default:
      return null;
  }
}
