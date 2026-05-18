import type { Topic } from '../topics';

// Traders & Barbarians expansion rulebook entries. This commit covers the
// Rivers of Catan scenario plus the Friendly Robber and Strongest Ports
// variants. Future commits add Fishing on Catan, Merchant Trains, Barbarian
// Attack, the Traders & Barbarians combo scenario, and the remaining
// variants.

export const TRADERS_TOPICS: Topic[] = [
  {
    id: 'traders-overview',
    title: 'Traders & Barbarians — overview',
    body: (
      <>
        <p>
          The Traders & Barbarians expansion is a collection of mini-scenarios
          and rule tweaks that each highlight a different facet of Catan: trade,
          travel, defence, and luck. This build ships <strong>Rivers of
          Catan</strong> plus two small variants — Friendly Robber and Strongest
          Ports — that work with any base game.
        </p>
        <p>
          More scenarios are on the way. The architecture for gold (coins),
          bridges, and bonus VP tiles lands first so the rest can build on top
          without rewriting state shape.
        </p>
      </>
    ),
  },
  {
    id: 'traders-rivers',
    title: 'Rivers of Catan',
    body: (
      <>
        <p>
          Two rivers cut through the island. To reach the far side of each
          river you must build <strong>bridges</strong> on the marked river
          edges. Every river-build pays in <strong>gold</strong>, and the
          player with the most gold at any moment wears the
          {' '}<strong>Wealthiest Catanian</strong> tile.
        </p>
        <ul>
          <li>
            <strong>Swamp hexes</strong> are non-producing. The robber starts
            on one of them; it can move between swamps and other hexes
            normally.
          </li>
          <li>
            <strong>River edges</strong> are reserved for bridges — roads
            cannot be built on them, and the Road Building dev card cannot
            place bridges.
          </li>
          <li>
            <strong>Building rewards.</strong> Each road or settlement built
            on a river tile (i.e. touching a swamp) earns
            {' '}<strong>1 gold</strong>. Each bridge earns
            {' '}<strong>3 gold</strong>.
          </li>
        </ul>
        <p>
          Bridges count as roads for Longest Road. They occupy the river edge
          and block opponents from building one of their own.
        </p>
      </>
    ),
  },
  {
    id: 'traders-bridges',
    title: 'Bridges',
    body: (
      <>
        <p>
          A bridge spans a river edge (a "bridge site"). It costs the same as
          a road — <strong>1 wood + 1 brick</strong> — and connects to your
          network exactly like a road or ship:
        </p>
        <ul>
          <li>Adjacent to one of your settlements or cities, OR</li>
          <li>Connected to one of your roads or bridges at a vertex, OR</li>
          <li>
            On a vertex not blocked by an opponent's settlement / city.
          </li>
        </ul>
        <p>
          You start with 3 bridges in your supply. Bridges count toward Longest
          Road. The <em>Road Building</em> dev card may not be used to place
          bridges (rulebook).
        </p>
      </>
    ),
  },
  {
    id: 'traders-coins',
    title: 'Coins & gold',
    body: (
      <>
        <p>
          Gold is a separate currency from the resource hand:
        </p>
        <ul>
          <li>
            <strong>Earned by</strong> building on a river tile (1 gold per
            road/settlement) or a bridge (3 gold).
          </li>
          <li>
            <strong>Spendable</strong> 2-for-1 to take any resource from the
            bank, up to 2 times per turn.
          </li>
          <li>
            <strong>Safe</strong> from the robber and the 7-roll discard
            threshold — gold doesn't count as a resource card.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'traders-wealth-tiles',
    title: 'Wealthiest / Poor Catanian',
    body: (
      <>
        <p>
          Two VP tiles change hands as gold totals shift:
        </p>
        <ul>
          <li>
            <strong>Wealthiest Catanian</strong> (+1 VP). Held by the unique
            player with the most gold (≥ 1 gold). On a tie, no-one holds it.
          </li>
          <li>
            <strong>Poor Catanian</strong> (-2 VP). Held by every player tied
            at the lowest gold count, as long as someone else is ahead.
            Multiple players can be Poor at once.
          </li>
        </ul>
        <p>
          Both tiles recalculate every time anyone's gold total changes, so
          building a single bridge can flip the leaderboard.
        </p>
      </>
    ),
  },
  {
    id: 'traders-friendly-robber',
    title: 'Friendly Robber (variant)',
    body: (
      <>
        <p>
          When the variant is active, you may <strong>not</strong> place the
          robber on a hex whose only adjacent buildings belong to players with
          {' '}<strong>2 or fewer visible victory points</strong>. The robber
          targets the rich, not the new.
        </p>
        <p>
          The desert remains a legal target — if no other hex qualifies, you
          must move the robber there.
        </p>
      </>
    ),
  },
  {
    id: 'traders-strongest-ports',
    title: 'Strongest Ports (variant)',
    body: (
      <>
        <p>
          The first player to hold <strong>3 victory points worth of
          port-buildings</strong> (1 per settlement-on-port, 2 per
          city-on-port) takes the <strong>Strongest Ports</strong> bonus tile,
          worth <strong>+2 VP</strong>. If anyone later exceeds that total,
          the tile moves to them. Ties leave it unclaimed.
        </p>
        <p>
          To balance the bonus, the game's victory-point target is increased
          by 1 (e.g. 10 → 11). Combine with any base or scenario game.
        </p>
      </>
    ),
  },
  {
    id: 'traders-fishing',
    title: 'Fishing on Catan',
    body: (
      <>
        <p>
          A <strong>lake</strong> replaces the desert at the centre of the
          board, and six <strong>fishing grounds</strong> sit on the frame at
          coastal vertices. Both produce fish tokens when their number is
          rolled. Fish are not resources — they're a separate currency you
          spend for special actions.
        </p>
        <ul>
          <li>
            <strong>Production.</strong> When the lake's number rolls,
            settlements and cities <em>adjacent</em> to the lake catch fish
            (1 per settlement, 2 per city). When a fishing ground's number
            rolls, only the building <em>at the anchor vertex</em> catches.
          </li>
          <li>
            <strong>Drawing.</strong> Tokens come from a face-down bag of
            29 fish (11×1, 10×2, 8×3) plus 1 old boot. The active player
            draws first, then clockwise. Draw order matters when the boot is
            still in the bag.
          </li>
          <li>
            <strong>Cap.</strong> You may not hold more than 7 fish tokens
            (the boot doesn't count). Excess draws are forfeit.
          </li>
          <li>
            <strong>Robber.</strong> The robber starts off-board and enters
            on the first 7 or Knight. You may place it on the lake to block
            lake production. You cannot place it on a fishing ground.
          </li>
        </ul>
        <p className="rb-muted">
          The setup round 2 settlement adjacent to the lake or a fishing
          ground draws 1 starting fish token (in addition to the usual
          resources).
        </p>
      </>
    ),
  },
  {
    id: 'traders-fish-spending',
    title: 'Spending fish tokens',
    body: (
      <>
        <p>
          Discard fish tokens summing to at least the cost to take the
          action. Excess fish on spent tokens is lost.
        </p>
        <ul>
          <li><strong>2 fish</strong> — Drive off the robber (returns next 7 / Knight).</li>
          <li><strong>3 fish</strong> — Steal 1 random resource from any player.</li>
          <li><strong>4 fish</strong> — Take 1 resource of your choice from the supply.</li>
          <li><strong>5 fish</strong> — Build a free road.</li>
          <li><strong>7 fish</strong> — Build a free development card.</li>
        </ul>
        <p className="rb-muted">
          Fish never count toward the 7-card discard threshold, can't be
          stolen, and can't be traded. (UI for the higher-tier spends —
          steal, free road, free dev card — lands in a follow-up.)
        </p>
      </>
    ),
  },
  {
    id: 'traders-old-boot',
    title: 'The old boot',
    body: (
      <>
        <p>
          The old boot is one of the 30 tokens in the fishing bag. The
          player who draws it keeps it face-up — they now need
          {' '}<strong>+1 VP</strong> to win (so 11 VP on the standard 10-VP
          game).
        </p>
        <p>
          On your turn you may pass the boot to any other player whose
          {' '}<strong>visible VPs ≥ yours</strong>. Hidden Victory Point
          dev cards don't count in that comparison.
        </p>
      </>
    ),
  },
];
