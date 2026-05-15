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
          Each scenario is a different map shape with its own islands, gold
          hexes, and bonus VP layout. Pick one from the New Game screen.
        </p>
        <ul>
          <li>
            <strong>Heading for New Shores</strong> — the intro scenario.
            A familiar main island plus a few small outer islands with two
            gold hexes.
          </li>
          <li>
            <strong>Four Islands</strong> — no dominant island. Ships are
            mandatory from turn one.
          </li>
          <li>
            <strong>Fog Island</strong> — a small home island and a
            resource-rich distant island.
          </li>
          <li>
            <strong>Through the Desert</strong> — a long island bisected by
            a desert strip you must route around or through.
          </li>
          <li>
            <strong>New World</strong> — a procedurally-laid-out map for
            variety.
          </li>
          <li>
            <strong>Pirate Islands</strong> — a thin coastline and a chain
            of small pirate-claimed isles to the east.
          </li>
          <li>
            <strong>The Forgotten Tribe</strong> — main island plus several
            small inhabited islets with rich tokens.
          </li>
          <li>
            <strong>Cloth for Catan</strong> — outer islands worth more VP
            than usual.
          </li>
          <li>
            <strong>The Wonders of Catan</strong> — a single large island
            ringed by extra ports.
          </li>
        </ul>
        <p className="rb-muted">
          Some scenarios in the official rulebook include additional
          mechanics (cloth tokens, fog reveal, wonder construction). The
          v1 of this implementation focuses on the map; those extra
          mini-systems aren't yet wired up.
        </p>
      </>
    ),
  },
];
