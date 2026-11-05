import type { Topic } from '../topics';
import {
  EP_BONUS_TILE_NAMES,
  EP_COSTS,
  EP_DEFAULT_VP,
  EP_MISSIONS,
  EP_MISSION_NAMES,
  EP_TRACK_VP,
} from '@/game/modules/explorersPirates/constants';
import { RESOURCES, type ResourceBank } from '@/game/types';
import { RESOURCE_ICON } from '@/ui/shared/ResourceChip';
import {
  AbilityIcon,
  CargoIcon,
  EpShipIcon,
  HarborIcon,
  LairIcon,
  MissionIcon,
  PirateShipIcon,
} from '@/ui/game/explorersPirates/EpArt';

// Explorers & Pirates (2025 Rulebook): the complete "Explorers & Pirates"
// scenario at 3-4 players — setup, the three turn phases, sailing,
// exploring, the three missions, the pirate ship and scoring.

function cost(c: Partial<ResourceBank>): string {
  return RESOURCES.filter((r) => (c[r] ?? 0) > 0)
    .map((r) => `${c[r]}${RESOURCE_ICON[r]}`)
    .join(' ');
}

function TrackTable() {
  return (
    <table className="rb-table">
      <thead>
        <tr>
          <th>Mission</th>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <th key={n}>{n}</th>
          ))}
          <th>Bonus tile (+1 VP)</th>
        </tr>
      </thead>
      <tbody>
        {EP_MISSIONS.map((m) => (
          <tr key={m}>
            <td style={{ whiteSpace: 'nowrap' }}>
              <MissionIcon mission={m} size={14} /> {EP_MISSION_NAMES[m]}
            </td>
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <td key={i}>{EP_TRACK_VP[m][i] ?? '—'}</td>
            ))}
            <td>{EP_BONUS_TILE_NAMES[m]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export const EXPLORERS_PIRATES_TOPICS: Topic[] = [
  {
    id: 'ep-overview',
    title: 'Explorers & Pirates — overview',
    body: (
      <>
        <p>
          Your settlers leave the starting island in the west for the unknown sea. Two regions lie{' '}
          <strong>face down</strong>: the <strong>parrot</strong> hexes (green backs, north) and the{' '}
          <strong>goose</strong> hexes (orange backs, south). Ships turn them over as they reach them, finding new
          land, gold fields held by pirates, spice farms and fish shoals.
        </p>
        <p>
          This build plays the Rulebook’s complete <strong>Explorers &amp; Pirates</strong> scenario with 3 or 4
          players. First to <strong>{EP_DEFAULT_VP} VP</strong> during their own turn wins. There are no cities,
          development cards, robber, Longest Road or Largest Army; each player starts with 2 gold.
        </p>
        <ul>
          <li>
            <HarborIcon color="red" size={16} /> <strong>Harbor settlements</strong> (2 VP) build ships and store 2
            pieces.
          </li>
          <li>
            <EpShipIcon color="red" size={16} /> <strong>Ships</strong> carry settlers, crews, fish hauls and spice
            sacks.
          </li>
          <li>
            <LairIcon size={16} /> <MissionIcon mission="fish" size={16} /> <MissionIcon mission="spice" size={16} />{' '}
            Three <strong>missions</strong> score on their tracks.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ep-setup',
    title: 'Setup',
    body: (
      <>
        <p>Three setup rounds:</p>
        <ol>
          <li>
            <strong>Round 1</strong> (in turn order): a <strong>harbor settlement</strong> on one of the marked
            intersections (✓) of the starting island’s east coast. It collects nothing now.
          </li>
          <li>
            <strong>Round 2</strong> (reverse order): a <strong>settlement</strong> anywhere on the starting island,
            following the distance rule. It pays 1 resource for each hex around it.
          </li>
          <li>
            <strong>Round 3</strong> (in turn order): a <strong>road</strong> next to that settlement, then a{' '}
            <strong>ship carrying a settler</strong> on a sea edge next to your harbor settlement.
          </li>
        </ol>
      </>
    ),
  },
  {
    id: 'ep-turn',
    title: 'Your turn: production, action, movement',
    body: (
      <>
        <ol>
          <li>
            <strong>Production.</strong> Roll the dice. Every settlement and harbor settlement on a hex with that
            number collects 1 resource; a captured gold field pays 2 gold per building. Anyone who gets nothing takes
            1 gold instead (not on a 7). A <strong>7</strong>: players with more than 7 cards discard half, then you
            activate your <strong>pirate ship</strong>.
          </li>
          <li>
            <strong>Action phase.</strong> Build and trade in any order: roads, settlements (on your roads, explored
            land), harbor settlements, ships, settlers and crews. Trade with players, or 3:1 with the supply. Coins: 2
            gold buy a resource card (twice a turn), 3 cards buy 1 gold.
          </li>
          <li>
            <strong>Movement phase</strong> (“⛵ Movement ▸”). Move your ships, load and unload, found settlements,
            work the missions, roll for fish once. “Done” ends your turn.
          </li>
        </ol>
        <p>
          Building costs: harbor settlement {cost(EP_COSTS.harbor)} · ship {cost(EP_COSTS.ship)} · settler{' '}
          {cost(EP_COSTS.settler)} · crew {cost(EP_COSTS.crew)} · extra ship move {cost(EP_COSTS.boost)}.
        </p>
      </>
    ),
  },
  {
    id: 'ep-building',
    title: 'Harbor settlements, ships, settlers and crews',
    body: (
      <>
        <ul>
          <li>
            <HarborIcon color="blue" size={16} /> A <strong>harbor settlement</strong> replaces one of your
            settlements on the coast (it’s worth 2 VP, produces like a settlement). You have 4.
          </li>
          <li>
            <EpShipIcon color="blue" size={16} /> A <strong>ship</strong> goes on an empty sea edge next to one of your
            harbor settlements. You have 3; with all 3 out, building one brings another home first (with its cargo).
          </li>
          <li>
            <CargoIcon piece="settler" color="blue" size={16} /> <CargoIcon piece="crew" color="blue" size={16} />{' '}
            <strong>Settlers and crews</strong> go onto your harbor settlement or a ship of yours next to one. Each
            holds <strong>1 large piece</strong> (settler, fish haul) <strong>or 2 small</strong> (crews, spice
            sacks). If it’s full you may send pieces back to your supply to make room.
          </li>
          <li>
            Land rules: nothing is built next to a face-down hex, on an uncaptured gold field, or on a spice farm
            without your crew.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ep-movement',
    title: 'Sailing',
    body: (
      <>
        <ul>
          <li>
            Each ship has <strong>4 movement points</strong> (+1 per Swift Voyage farm with your crew); 1 wool gives
            one ship +2 for the turn. A step is one edge of explored sea. Moving another ship ends the first one’s
            move.
          </li>
          <li>
            Up to <strong>2 ships</strong> share an edge; a ship may pass a full edge but not stop there.
          </li>
          <li>
            <PirateShipIcon color="orange" size={18} /> Sailing onto, off or along an opponent’s{' '}
            <strong>pirate ship</strong> hex costs 1 gold tribute to its owner, once per ship a turn.
          </li>
          <li>
            Free ship actions, any time in the phase: load / unload with your harbor settlement next to it, found a
            settlement with a settler at one of the ship’s ends (distance rule, no road needed — ship and settler
            return to your supply), and the mission actions.
          </li>
        </ul>
        <p>
          On the board, click a ship to select it: the edges it can reach show the MP left after the step, a coin
          where tribute is due and a compass where it explores.
        </p>
      </>
    ),
  },
  {
    id: 'ep-exploring',
    title: 'Exploring',
    body: (
      <>
        <p>
          When either end of a ship touches a corner of a face-down hex, the hex is turned over and that ship’s move{' '}
          <strong>ends</strong>. What you may find:
        </p>
        <ul>
          <li>
            <strong>Land</strong> (forest, hills, pasture, fields, mountains): a number disc from that region’s stack;
            you take 1 matching card.
          </li>
          <li>
            <LairIcon size={16} /> A <strong>gold field</strong> with a pirate lair on it (its number stays hidden
            until the lair is captured): 2 gold.
          </li>
          <li>
            <AbilityIcon ability="swiftVoyage" size={16} /> A <strong>spice farm</strong>, with one spice sack per
            player: 2 gold.
          </li>
          <li>
            A <strong>fish shoal</strong> (parrot shoals 1-3, goose 4-6) or open sea: 2 gold.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ep-missions',
    title: 'Missions: pirate lairs, fish, spices',
    body: (
      <>
        <ul>
          <li>
            <LairIcon size={16} /> <strong>Pirate lairs.</strong> Land crews from a ship next to the gold field. The{' '}
            <strong>third crew</strong> (any players’) captures it. When that Movement phase ends, everyone with a crew
            there takes 2 gold and moves 1 space; each rolls a die + their crews and the highest is the hero (+1 more
            space, one crew home). The field then produces 2 gold per building on its number. Later you may take your
            crews back aboard.
          </li>
          <li>
            <MissionIcon mission="fish" size={16} /> <strong>Fish.</strong> Once per Movement phase, roll a die: a{' '}
            <strong>fish haul</strong> appears on the explored shoal with that number (not if it has one, the pirate
            is there, or the supply is empty). An empty ship next to it loads it; deliver it at the Council for 1
            space.
          </li>
          <li>
            <MissionIcon mission="spice" size={16} /> <strong>Spices.</strong> Land a crew on a spice farm (it stays
            for good): you gain its advantage and may build there. Then load your spice sack (one per farm) and
            deliver it for 1 space.
          </li>
          <li>
            <strong>The Council of Catan</strong> (the island in the middle): a ship with an end on one of its two
            anchors delivers all its fish hauls and spice sacks at once.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ep-spice-farms',
    title: 'Spice farm advantages',
    body: (
      <ul>
        <li>
          <AbilityIcon ability="swiftVoyage" size={18} /> <strong>Swift Voyage:</strong> +1 movement point for each
          of your ships.
        </li>
        <li>
          <AbilityIcon ability="fastGold" size={18} /> <strong>Fast Gold:</strong> once in your Action phase, trade 1
          resource card for 1 gold (twice with both farms).
        </li>
        <li>
          <AbilityIcon ability="pirateBonus" pirateNumber={5} size={18} /> <strong>Pirate Bonus:</strong> the farm’s
          number (5 parrot, 4 goose) also chases the pirate away; with both farms, 4, 5 and 6.
        </li>
      </ul>
    ),
  },
  {
    id: 'ep-pirate',
    title: 'The pirate ship',
    body: (
      <>
        <p>
          <PirateShipIcon color="purple" size={20} /> On a 7 (after discards) or a successful chase you activate your
          pirate ship: an opponent’s pirate on the board goes home; yours goes to a different explored sea hex — not
          next to the starting island, not on the frame. Then rob one player with a ship on that hex: a random card,
          or 1 gold if they have none. A fish haul on that shoal goes back to the supply.
        </p>
        <p>
          <strong>Chasing it away:</strong> in your Movement phase, a <strong>battle-ready</strong> ship (not moved
          yet this turn, an end on the pirate’s hex) rolls a die once: a 6 (or a Pirate Bonus number) chases the
          pirate off and you activate yours. The attempt ends any move under way.
        </p>
      </>
    ),
  },
  {
    id: 'ep-scoring',
    title: 'Scoring and winning',
    body: (
      <>
        <p>
          Settlement 1 VP, harbor settlement 2 VP, plus the VP printed next to your marker on each mission track and 1
          VP for each bonus tile you hold (the furthest marker; on a tie the one that got there first keeps it).
        </p>
        <TrackTable />
        <p>
          Reach <strong>{EP_DEFAULT_VP} VP</strong> during your own turn to win — a lair resolved at the end of your
          Movement phase still counts.
        </p>
      </>
    ),
  },
];
