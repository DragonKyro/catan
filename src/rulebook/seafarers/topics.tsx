import type { Topic } from '../topics';
import {
  ShipDiagram,
  GoldHexDiagram,
  PirateDiagram,
  IslandBonusDiagram,
  TradeRouteDiagram,
} from './diagrams';

// Seafarers expansion rulebook entries. Imported into the master TOPICS
// array (in src/rulebook/topics.tsx) and rendered after the base-game
// topics, separated by a divider in the table of contents.

export const SEAFARERS_TOPICS: Topic[] = [
  {
    id: 'seafarers-overview',
    title: 'Seafarers — overview',
    body: (
      <>
        <p>
          The Seafarers expansion turns Catan into an island-hopping game.
          Each scenario uses a different map with one or more islands ringed
          by sea hexes. To expand off the starting island, you need ships.
        </p>
        <p>
          Seafarers rules are layered on top of base Catan: dice rolls,
          robbers, dev cards, and trading all work the same way. The new
          mechanics are ships, gold hexes, the pirate, settlement bonus
          chips, and Longest Trade Route.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-ships',
    title: 'Ships',
    body: (
      <>
        <p>
          Ships are built on sea or coastal edges of the board for{' '}
          <strong>1 wood + 1 sheep</strong>. Like roads, ships must connect
          to your existing network:
        </p>
        <ul>
          <li>A ship may launch from your settlement or city.</li>
          <li>A ship may extend an adjacent ship of yours.</li>
          <li>
            A ship may connect to one of your roads, but only at a coastal
            vertex (a corner touching the sea).
          </li>
        </ul>
        <ShipDiagram />
        <p className="rb-muted">
          You start with 15 ships in your supply. Ships count for the new
          Longest Trade Route bonus alongside roads.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-moving-ships',
    title: 'Moving ships',
    body: (
      <>
        <p>
          Once per turn, you may move one of your "open" ships — a ship at
          the end of a route, with no other piece of yours attached at one
          of its endpoints — to a new legal ship location. Ships at a
          settlement, city, or wedged between two other pieces cannot be
          moved.
        </p>
        <p>
          Moving a ship doesn't cost resources, but you can only do it once
          per turn, and not on the turn you build that ship. Use it to
          redirect your fleet toward a more promising landfall.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-gold',
    title: 'Gold hexes',
    body: (
      <>
        <GoldHexDiagram />
        <p>
          A gold hex pays whichever resource you want. When a roll matches
          the gold hex's number, every player adjacent to it picks{' '}
          <strong>any one resource</strong> per settlement (and{' '}
          <strong>two</strong> per city) from the bank.
        </p>
        <p className="rb-muted">
          Picks are made simultaneously — multiple players may collect from
          the same gold hex without competing for the same resource.
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
          The pirate is the robber's seafaring counterpart. On a 7 (or when
          a Knight is played), you choose to move either the robber or the
          pirate. The pirate sits on sea hexes and lets you steal from a
          player who has a ship adjacent to its new location.
        </p>
        <p className="rb-muted">
          You may only move one of the two pieces, not both, even with a
          Knight.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-island-bonus',
    title: 'Island settlement bonus',
    body: (
      <>
        <IslandBonusDiagram />
        <p>
          The first player to build a settlement on each outer island
          collects a special chip worth bonus VP. The chip stays on the
          player's player area for the rest of the game — even if their
          settlement is later upgraded to a city or destroyed.
        </p>
        <p className="rb-muted">
          The main starting island has no chip. Some scenarios award more
          than +2 VP per chip; the scenario picker shows which is in play.
        </p>
      </>
    ),
  },
  {
    id: 'seafarers-trade-route',
    title: 'Longest Trade Route',
    body: (
      <>
        <p>
          Seafarers replaces the Longest Road bonus with{' '}
          <strong>Longest Trade Route</strong>: the longest contiguous chain
          of your roads <em>and</em> ships, in any combination.
        </p>
        <TradeRouteDiagram />
        <p>
          A road and a ship can only meet at one of your own settlements or
          cities. At an unsettled vertex, an incoming road segment must
          continue as a road, and an incoming ship segment as a ship.
        </p>
        <p className="rb-muted">
          Trade routes break at an opponent's settlement or city, just like
          base-game Longest Road.
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
          Each scenario is a different map shape with its own mechanic on
          top of the standard Seafarers rules. Pick one from the New Game
          screen — the VP target and player-count cap auto-adjust per
          scenario.
        </p>
        <h4>Heading for New Shores</h4>
        <p>
          The intro scenario. A main island and three smaller outer islands
          with gold hexes. Standard rules: outer-island chips, gold picks,
          and the pirate. <strong>Win at 13 VP.</strong>
        </p>
        <h4>Four Islands</h4>
        <p>
          Four similarly-sized clusters with no main island. Setup is
          unique here: <strong>starting settlements may go on any
          island</strong>, not just the largest one. Ships are mandatory
          from turn one. <strong>Win at 12 VP.</strong>
        </p>
        <h4>Through the Desert</h4>
        <p>
          The main island is bisected by three desert hexes. The desert
          counts as an <strong>island boundary</strong> — the far side of
          the desert is treated as a separate logical island, so the first
          player to settle past the desert claims an outer-island chip
          even though the land is contiguous. <strong>Win at 14 VP.</strong>
        </p>
        <h4>New World</h4>
        <p>
          A procedurally-laid-out map for variety. Standard rules; no
          scenario-specific mechanic beyond the random layout.{' '}
          <strong>Win at 14 VP.</strong>
        </p>
        <h4>Fog Island</h4>
        <p>
          The outer-island hexes start hidden under fog. Build a
          settlement, road, or ship adjacent to a fog hex to{' '}
          <strong>reveal it and earn 1 of the revealed resource</strong>{' '}
          (gold triggers a free-pick; desert grants nothing). The fog tab
          on the right-side Scenario panel shows revealed/total.{' '}
          <strong>Win at 12 VP.</strong>
        </p>
        <h4>The Forgotten Tribe</h4>
        <p>
          Outer islets carry one-shot friendly-tribe tokens. The first
          player to settle adjacent to a token claims it. Three types:
        </p>
        <ul>
          <li>
            <strong>🃏 Dev card</strong> — draws the top of the dev deck.
          </li>
          <li>
            <strong>⭐ Victory point</strong> — visible +1 VP.
          </li>
          <li>
            <strong>⚓ Commercial harbor</strong> — caps your bank-trade
            rate at 2:1 for any resource (stronger than a generic 3:1
            port).
          </li>
        </ul>
        <p><strong>Win at 13 VP.</strong></p>
        <h4>Pirate Islands</h4>
        <p>
          An enemy pirate fleet anchors on a sea hex between the main
          island and the pirate isles. Build a ship adjacent to the fleet,
          then use the <strong>⚔️ Attack</strong> button in the action bar
          to drop the fleet's strength by 1 (once per turn). The player
          who lands the killing blow earns <strong>+2 VP</strong>.{' '}
          <strong>Win at 12 VP.</strong>
        </p>
        <h4>Cloth for Catan</h4>
        <p>
          Specific outer-island hexes produce <strong>cloth tokens</strong>{' '}
          instead of resources on roll. Each cloth-producing hex shows a
          fabric icon. Cloth is a separate currency: it can't be spent on
          builds or traded, but counts toward VP at the rate of{' '}
          <strong>2 cloth = 1 VP</strong> (rounded down). Cloth tokens are
          visible to everyone and update live in the player badges.{' '}
          <strong>Win at 14 VP.</strong>
        </p>
        <h4>The Wonders of Catan</h4>
        <p>
          Five wonders are available; click <strong>🏛️ Wonder</strong> in
          the action bar to open the build dialog. Each wonder requires a
          prerequisite (e.g. 3 cities, Longest Road) and has 4 levels.
          Each built level grants +1 VP. <strong>
          The first player to complete a wonder wins immediately
          </strong>{' '}
          — regardless of VP total. Only one player can build each wonder;
          starting it locks others out.
        </p>
      </>
    ),
  },
];
