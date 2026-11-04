import type { Topic } from '../topics';
import {
  ShipDiagram,
  GoldHexDiagram,
  PirateDiagram,
  IslandBonusDiagram,
  TradeRouteDiagram,
} from './diagrams';

// Seafarers expansion rulebook entries (2025 edition). Imported into the
// master TOPICS array (in src/rulebook/topics.tsx) and rendered after the
// base-game topics, separated by a divider in the table of contents.

export const SEAFARERS_TOPICS: Topic[] = [
  {
    id: 'seafarers-overview',
    title: 'Seafarers — overview',
    body: (
      <>
        <p>
          Seafarers turns Catan into an island-hopping game. Each scenario has its own map,
          setup, extra rules and way to win. Everything else is base Catan: dice, trading,
          building and development cards.
        </p>
        <p>
          The new pieces and rules are ships, gold fields, the pirate, the Longest Route
          (roads <em>and</em> ships), and new ways to score — island bonuses, the tribe's
          gifts, cloth, pirate fortresses and wonders.
        </p>
        <p className="rb-muted">
          You win when you reach the scenario's goal <strong>during your turn</strong>.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-setup',
    title: 'Starting pieces',
    body: (
      <>
        <p>
          Place your starting settlements as in Catan, on the islands the scenario allows (the
          board only highlights legal spots).{' '}
          <strong>
            If a starting settlement is on the coast, you may place a ship on an adjacent sea
            edge instead of the road.
          </strong>{' '}
          Tap the small ⛵ button on a coastal edge to pick the ship.
        </p>
        <p className="rb-muted">
          A starting settlement next to a gold field takes a resource of your choice for it.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-ships',
    title: 'Building ships',
    body: (
      <>
        <p>
          A ship costs <strong>1 wood + 1 wool</strong>. Ships go on empty edges of sea hexes
          (including along the sea frame). A ship and a road can never share an edge.
        </p>
        <ul>
          <li>
            A new ship must connect to <strong>one of your ships or buildings — not a road</strong>.
            Roads and ships only meet at your settlements and cities.
          </li>
          <li>Like roads, you can't build a ship past an opponent's building.</li>
          <li>No new ship may be placed on an edge of the hex the pirate is on.</li>
        </ul>
        <ShipDiagram />
        <p className="rb-muted">
          You have 15 ships. Ships are worth 0 VP but count for the Longest Route.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-moving-ships',
    title: 'Moving a ship',
    body: (
      <>
        <p>
          Once during your turn you may move <strong>one</strong> ship (⛵ Move ship): lift it
          and place it anywhere a new ship could go. Restrictions:
        </p>
        <ul>
          <li>Not a ship you built this turn.</li>
          <li>
            One of its two ends must be <strong>open</strong> — not next to another of your ships
            or one of your buildings. (So a ship that's part of a line between two of your
            buildings can't move, even if an opponent built on that line.)
          </li>
          <li>You can't move a ship to or from an edge of the pirate's hex.</li>
        </ul>
      </>
    ),
  },
  {
    id: 'seafarers-gold',
    title: 'Gold fields',
    body: (
      <>
        <GoldHexDiagram />
        <p>
          When a gold field's number is rolled, each adjacent settlement takes{' '}
          <strong>1 resource of its owner's choice</strong>, and each city <strong>2</strong>{' '}
          (any combination). Players pick in turn order.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-pirate',
    title: 'The pirate',
    body: (
      <>
        <PirateDiagram />
        <p>
          On a 7 (after discards) or a Knight, you choose to move the robber <em>or</em> the
          pirate. Move the pirate to another sea hex and steal 1 random card from a player
          with a ship on one of its edges.
        </p>
        <p className="rb-muted">
          While the pirate sits on a hex, nobody may build ships on its edges or move ships to
          or from them.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-road-building',
    title: 'Road Building & Knights',
    body: (
      <>
        <p>
          <strong>Road Building</strong> builds 2 roads, 2 ships, or 1 road and 1 ship for free.
          A <strong>Knight</strong> lets you move the robber or the pirate.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-trade-route',
    title: 'Longest Route',
    body: (
      <>
        <p>
          The <strong>Longest Route</strong> tile (2 VP) goes to the first player with 5
          continuous roads and/or ships, and passes to anyone who builds a longer one.
        </p>
        <TradeRouteDiagram />
        <p>
          Roads and ships only count as one route where they meet at one of your own
          settlements or cities. An opponent's building breaks a route.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-island-bonus',
    title: 'Island bonus',
    body: (
      <>
        <IslandBonusDiagram />
        <p>
          In several scenarios, <strong>each</strong> time you build your first settlement on
          a new island you earn bonus VP — 2 VP in Heading for New Shores, The Four Islands
          and Through the Desert; 1 VP in The Wonders of Catan and New World.{' '}
          <strong>It doesn't matter if other players settled there first</strong>: every
          player can earn every island's bonus once.
        </p>
        <p className="rb-muted">
          The islands your starting settlements are on are your home islands and pay you no
          bonus. In scenarios that start you on the main island, only the other islands count.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-scenarios',
    title: 'Scenarios',
    body: (
      <>
        <p>
          Pick a scenario on the New Game screen; the VP target follows the rulebook (5-6
          players use the same target).
        </p>
        <h4>Heading for New Shores — 14 VP</h4>
        <p>
          Start on the main island. +2 VP for your first settlement on each small island.
        </p>
        <h4>The Four Islands (The Six Islands at 5-6) — 13 VP</h4>
        <p>
          Start on one or two islands (your home islands). +2 VP for your first settlement on
          each other island.
        </p>
        <h4>The Fog Islands — 12 VP</h4>
        <p>
          Start on one or two islands. Placing a road or ship next to a corner of an
          unexplored space discovers it: a land hex pays you 1 of its resource (gold: your
          choice); sea pays nothing. Unexplored spaces don't produce and can't be built on.
        </p>
        <h4>Through the Desert — 14 VP</h4>
        <p>
          Start on the main island. The desert cuts off a strip of land; the strip and each
          small island are unexplored regions worth +2 VP for your first settlement there.
        </p>
        <h4>The Forgotten Tribe — 13 VP</h4>
        <ul>
          <li>
            Settlements and the robber only go on hexes <strong>with a number disc</strong>, so
            the tribe's islands can't be settled.
          </li>
          <li>
            Build or move a ship onto an edge with one of the tribe's gifts to take it:{' '}
            <strong>★ VP token</strong> (+1 VP), <strong>🂠 development card</strong> (as if bought
            this turn; a VP card counts at once), or a <strong>port</strong>, which you place
            next to one of your coastal settlements (one edge away from other ports) — or keep
            until you can.
          </li>
        </ul>
        <h4>Cloth for Catan — 14 VP</h4>
        <ul>
          <li>
            Place <strong>3</strong> starting settlements on the large islands; only the third
            collects starting resources. No Longest Route. No settlements or robber on the small
            islands.
          </li>
          <li>
            The numbers on the small islands' corners are <strong>villages</strong> (5 cloth
            each). A route of your ships/roads from your building to a village opens trade: take
            1 cloth at once, and 1 whenever its number rolls (topped up from the general supply;
            an empty village stops producing). Ships on such a route can't move.
          </li>
          <li>
            Each pair of cloth is 1 VP. You may move the pirate only once you trade with a
            village; it can steal a card or a cloth token.
          </li>
          <li>
            The game also ends when <strong>5+ villages are empty</strong> at the end of a turn:
            most VP wins (ties: most cloth).
          </li>
        </ul>
        <h4>The Pirate Islands — fortress + 10 VP</h4>
        <ul>
          <li>
            Everyone starts with a settlement and ship on the eastern main island, plus two
            starting settlements there. No robber, no Longest Route, no Largest Army.
          </li>
          <li>
            After each roll the <strong>pirate fleet</strong> sails its loop as many hexes as the
            lower die and attacks every player with a building on its hex: its strength is that
            die, yours is your number of warships. Lose: discard 1 random card + 1 per city
            there. Win: take 1 resource of your choice. Tie: nothing. (5-6: no attack from the
            "!" hex.)
          </li>
          <li>On a 7, discard as usual, then you may steal 1 card from any player.</li>
          <li>
            Build <strong>one line of ships, no branches, by the shortest path</strong> from a
            coastal building to your beachhead, then on to your fortress. You may settle at your
            beachhead once your line reaches it.
          </li>
          <li>
            Knights (and VP cards at 4+ players) only turn your normal ship nearest the start of
            your route into a <strong>warship</strong>.
          </li>
          <li>
            While your line reaches your fortress, ending your turn attacks it: roll a die. More
            warships than the die removes a lair token (3 recapture it — it becomes your
            settlement); fewer loses the 2 ships nearest the fortress; a tie loses 1.
          </li>
          <li>
            <strong>Win:</strong> recapture your fortress and have 10 VP during your turn.
          </li>
        </ul>
        <h4>The Wonders of Catan</h4>
        <ul>
          <li>
            No pirate. +1 VP for your first settlement on each small island. Starting settlements
            can't go on Great Wall / Great Bridge markers or the ✕ markers.
          </li>
          <li>
            Claim <strong>one</strong> wonder when you meet its requirement (nobody else may
            then claim it), then build its 4 levels, each costing the 5 resources on its tile.
            Wonder levels are worth no VP.
          </li>
          <li>
            <strong>Win:</strong> finish your wonder, or have 10 VP and a higher wonder level than
            every other player.
          </li>
        </ul>
        <h4>New World — 12 VP</h4>
        <p>
          A random map. Start on one or two islands; +1 VP for your first settlement on each
          other island.
        </p>
      </>
    ),
  },
];
