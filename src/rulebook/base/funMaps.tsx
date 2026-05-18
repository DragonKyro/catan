import type { Topic } from '../topics';

// Base-game "Fun Maps" — colonist.io-style variants that reuse standard
// Catan rules but ship custom board shapes (and, in Volcano's case, a new
// mechanic). Rendered after the base-game core topics, before Seafarers.

export const FUN_MAPS_TOPICS: Topic[] = [
  {
    id: 'fun-maps-overview',
    title: 'Fun Maps — overview',
    body: (
      <>
        <p>
          Fun Maps are colonist.io-style variants of the base game. They keep
          standard Catan rules — roads, settlements, cities, dev cards, robber,
          trading — but change the board's shape, what terrain shows up, or
          (in one case) add a new mechanic.
        </p>
        <p>
          Pick one from the <strong>Base map</strong> dropdown on the New
          Game screen. The default is <em>Standard</em>, which produces the
          regular 19/30/37-hex board you'd expect.
        </p>
        <ul>
          <li>
            <strong>Gold Rush</strong> — two or three gold fields are mixed
            into the normal terrain pool. A settlement on a gold field
            <em> picks any resource </em> on every production roll (cities
            get two picks).
          </li>
          <li>
            <strong>Volcano</strong> — see the next page.
          </li>
          <li>
            <strong>Black Forest</strong> — five interior wood hexes are
            fixed in place; the rest randomize. The usual no-adjacent-6/8
            rule is OFF so a dense red cluster can land anywhere.
          </li>
          <li>
            <strong>Diamond</strong> — 16-hex rhombus. Smaller and tighter
            than standard.
          </li>
          <li>
            <strong>Gear</strong> — 13-hex gear shape with six "teeth"
            sticking out around a 7-hex core. One port per tooth.
          </li>
          <li>
            <strong>Lakes</strong> — standard outline with three interior
            lakes. Roads have to go around; the distance rule still applies
            across narrow water.
          </li>
          <li>
            <strong>Pond</strong> — single sea hex dead-center.
          </li>
          <li>
            <strong>Twirl</strong> — 21-hex spiral, the standard hexagon
            with a two-hex tail twisting off one corner.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'fun-maps-volcano',
    title: 'Volcano',
    body: (
      <>
        <p>
          The center hex of the Volcano map is an active volcano. It functions
          mechanically as a desert: the robber starts there and it produces
          no resources. But unlike a desert, the volcano gets a{' '}
          <strong>number token</strong> — pinned to 6 so it comes up often.
        </p>
        <h4>Setup restriction</h4>
        <p>
          No starting settlement may touch the volcano. The engine blocks the
          placement up front (you can't even try it during setup).
        </p>
        <h4>Eruption</h4>
        <p>
          When the volcano's number is rolled, the volcano erupts. One random
          building on the six vertices adjacent to the volcano is hit:
        </p>
        <ul>
          <li>
            A <strong>settlement</strong> is destroyed outright — removed
            from the board with no resource refund.
          </li>
          <li>
            A <strong>city</strong> is downgraded back to a settlement (the
            city piece returns to the player's supply; the settlement piece
            takes its place).
          </li>
        </ul>
        <p>
          If no buildings sit adjacent to the volcano, the eruption is
          harmless — the roll is logged and play continues. The robber
          sitting on the volcano blocks production as usual but does{' '}
          <em>not</em> stop eruptions.
        </p>
        <p>
          The destruction's randomness is seeded so all players in an online
          game see the same victim. Eruptions show up in the game log as a
          <strong> 🌋 </strong> entry.
        </p>
      </>
    ),
  },
];
