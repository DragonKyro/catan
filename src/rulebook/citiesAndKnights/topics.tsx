import type { Topic } from '../topics';

// Cities & Knights — Phase 1 rulebook topics. These cover the framework
// pieces that are wired up in Phase 1: commodities, the third event die,
// the barbarian track, city walls, and the new 13-VP target. The deeper
// expansion mechanics (knights, city improvements, progress cards) land
// in later phases and will get their own topics.

export const CITIES_AND_KNIGHTS_TOPICS: Topic[] = [
  {
    id: 'ck-overview',
    title: 'Cities & Knights — overview',
    body: (
      <>
        <p>
          Cities & Knights is the largest expansion to Catan. It introduces
          commodities, city improvements, knights, and the looming threat of
          barbarian invaders that arrive periodically and pillage the
          island's cities if they aren't defended.
        </p>
        <p>
          Most base rules still apply, but you'll notice these big changes:
        </p>
        <ul>
          <li>
            <strong>13 victory points</strong> to win, instead of 10.
          </li>
          <li>
            Three new <strong>commodities</strong> — paper, cloth, and coin —
            produced by cities adjacent to wood, sheep, and ore hexes.
          </li>
          <li>
            A third <strong>event die</strong> is rolled with the two
            production dice. Half its faces advance the barbarian ship.
          </li>
          <li>
            <strong>City walls</strong> protect against the 7-roll discard.
          </li>
          <li>
            The classic <strong>dev cards</strong> and the{' '}
            <strong>Largest Army</strong> tile are out — progress cards
            replace them (and arrive in a later phase of this build).
          </li>
        </ul>
        <p className="rb-muted">
          Phase 1 of the implementation ships the framework: commodities,
          barbarian track, city walls, and the 13-VP target. Knights, city
          improvements, and the 54-card progress deck are still on the way.
        </p>
      </>
    ),
  },
  {
    id: 'ck-commodities',
    title: 'Commodities',
    body: (
      <>
        <p>
          A <strong>commodity</strong> is a special resource produced by{' '}
          <em>cities</em> on certain terrains:
        </p>
        <ul>
          <li>City on a wood hex → 1 wood <strong>+ 1 paper 📜</strong></li>
          <li>City on a sheep hex → 1 wool <strong>+ 1 cloth 🧵</strong></li>
          <li>City on an ore hex → 1 ore <strong>+ 1 coin 🪙</strong></li>
          <li>City on a wheat hex → 2 wheat (no commodity)</li>
          <li>City on a brick hex → 2 brick (no commodity)</li>
          <li>Settlements always yield 1 resource as in the base game.</li>
        </ul>
        <p>
          Commodities count toward your hand size for the 7-roll discard
          and can be stolen by the robber, but they aren't spent on any
          builds in Phase 1 — they will be used to buy{' '}
          <em>city improvements</em> when those land.
        </p>
        <p className="rb-muted">
          The commodity bank starts with 12 of each. Like resources, if more
          than one player would draw the last of a commodity the bank goes
          empty and no one gets it.
        </p>
      </>
    ),
  },
  {
    id: 'ck-event-die',
    title: 'The event die',
    body: (
      <>
        <p>
          Cities & Knights adds a third die. Roll it with the two production
          dice every turn. Resolve the event die <em>first</em>, before
          production.
        </p>
        <ul>
          <li>
            <strong>🚢 Barbarian ship</strong> (3 sides): the ship advances
            one space along the barbarian track. When it reaches the end the
            barbarians attack.
          </li>
          <li>
            <strong>📚 Science</strong> / <strong>⚖️ Trade</strong> /{' '}
            <strong>🤝 Politics</strong> (1 side each): when these land, you
            may draw a matching progress card if your city-improvement track
            allows it. Phase 1 doesn't yet ship city improvements, so these
            faces simply pass for now.
          </li>
        </ul>
        <p>
          The two production dice are also distinct now — the{' '}
          <strong>red die</strong> alone (not the sum) determines whether
          you draw a progress card.
        </p>
      </>
    ),
  },
  {
    id: 'ck-barbarians',
    title: 'Barbarians',
    body: (
      <>
        <p>
          The barbarian ship sails closer to Catan one space at a time, once
          per barbarian die roll. When it reaches the final space all islands
          are attacked at once.
        </p>
        <p>
          The barbarians' strength equals the total number of cities on the
          board. The defenders' strength equals the sum of all{' '}
          <em>active knights</em>. Knights aren't yet implemented (Phase 1),
          so for now every attack ends with the barbarians winning. Each
          player with at least one city loses one (chosen at random, walls
          first).
        </p>
        <p>
          The first time the barbarians attack, the robber arrives on the
          desert. Until then, rolling a 7 still forces hand discards but
          the robber doesn't move.
        </p>
        <p className="rb-muted">
          Once knights ship in Phase 8e, defenders may win the attack — the
          top contributor gets a victory-point token, and ties draw a
          progress card each.
        </p>
      </>
    ),
  },
  {
    id: 'ck-city-walls',
    title: 'City walls',
    body: (
      <>
        <p>
          A <strong>city wall</strong> sits under one of your cities and
          raises your 7-roll hand-size threshold by 2. Build up to 3 walls
          (max threshold = 13 cards before you discard).
        </p>
        <p>
          Cost: <strong>2 brick</strong>. The wall is destroyed if a
          barbarian attack pillages that city (along with the city itself,
          which reverts to a settlement).
        </p>
      </>
    ),
  },
  {
    id: 'ck-knights',
    title: 'Knights',
    body: (
      <>
        <p>
          Knights are your defence against the barbarians. Each player has 2
          basic (level 1), 2 strong (level 2), and 2 mighty (level 3)
          knights in supply.
        </p>
        <ul>
          <li>
            <strong>Recruit</strong> (1🐑 1🪨) — place a basic knight on an
            empty intersection connected to one of your roads. Knights don't
            obey the distance rule. New knights start inactive.
          </li>
          <li>
            <strong>Activate</strong> (1🌾) — stand up a knight so it can
            take an action next turn. A knight may not act on the turn it
            was activated.
          </li>
          <li>
            <strong>Promote</strong> (1🐑 1🪨) — upgrade strength. Once per
            turn. Strong → Mighty requires politics level 3 (Fortress).
          </li>
        </ul>
        <p>
          Knights act like buildings: opposing knights break opposing roads
          for Longest Route, block enemy settlement placement, and stop a
          road from being extended through them.
        </p>
      </>
    ),
  },
  {
    id: 'ck-knight-actions',
    title: 'Knight actions',
    body: (
      <>
        <p>
          An active knight may take one of three actions; after acting it
          becomes inactive (laid down).
        </p>
        <ul>
          <li>
            <strong>Move</strong> — move along your continuous routes to an
            empty intersection. You may pass over your own pieces but not
            opposing pieces.
          </li>
          <li>
            <strong>Displace</strong> — push a weaker opposing knight off
            its intersection. Your knight takes its place; the displaced
            piece's owner must move it along their own network to a free
            intersection, or it returns to their supply.
          </li>
          <li>
            <strong>Chase the Robber</strong> — a knight adjacent to the
            robber may move and steal as if a knight card had been played.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ck-improvements',
    title: 'City improvements',
    body: (
      <>
        <p>
          Three commodity-fed tracks let your cities specialise. Each track
          has 5 levels. To buy level N, discard N commodities of the
          matching kind:
        </p>
        <ul>
          <li>📚 <strong>Science</strong> — pay paper.</li>
          <li>⚖️ <strong>Trade</strong> — pay cloth.</li>
          <li>🤝 <strong>Politics</strong> — pay coin.</li>
        </ul>
        <p>You need at least one city on the board to buy improvements.</p>
        <p>
          <strong>Level 3 abilities</strong>:
        </p>
        <ul>
          <li>
            <em>Aqueduct</em> (science 3) — if a roll gives you no
            production, take 1 resource of your choice.
          </li>
          <li>
            <em>Merchant Guild</em> (trade 3) — trade commodities 2:1 with
            the bank.
          </li>
          <li>
            <em>Fortress</em> (politics 3) — you may promote knights to
            mighty.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ck-metropolises',
    title: 'Metropolises',
    body: (
      <>
        <p>
          The first player to reach <strong>level 4</strong> on a track
          claims that track's metropolis (a piece placed on one of their
          cities) and earns <strong>+2 VP</strong>. A second player
          reaching level 4 on the same track does NOT take it — only level
          5 can steal a metropolis.
        </p>
        <p>
          Reaching <strong>level 5</strong> locks the metropolis: it
          becomes <em>permanent</em> and can no longer change hands.
        </p>
        <p>
          Each metropolis on the board also contributes <strong>+1 to
          barbarian strength</strong>. Metropolis cities cannot be pillaged
          when the barbarians win.
        </p>
      </>
    ),
  },
  {
    id: 'ck-barbarian-defence',
    title: 'Barbarian defence',
    body: (
      <>
        <p>
          When the barbarian ship reaches Catan, the barbarians' strength
          equals the number of cities on the board (plus +1 per
          metropolis). The defenders' strength is the sum of all{' '}
          <em>active</em> knights.
        </p>
        <ul>
          <li>
            <strong>Defenders win</strong> (ties go to defenders) — the top
            contributor receives a Defender of Catan token (+1 VP). If
            multiple players tied for the top, each draws a progress card
            of their chosen deck.
          </li>
          <li>
            <strong>Barbarians win</strong> — each player tied for the
            lowest defender contribution loses one city to a pillage
            (walls drop first; the city becomes a settlement). Metropolis
            cities are immune.
          </li>
        </ul>
        <p>
          After every attack the ship resets, all knights are laid down
          (inactive), and — on the very first attack — the robber arrives
          on the desert.
        </p>
      </>
    ),
  },
  {
    id: 'ck-progress-cards',
    title: 'Progress cards',
    body: (
      <>
        <p>
          Progress cards replace the base-game dev cards entirely. Three
          decks of 18 cards each (science, trade, politics) sit face-down
          beside the board. You draw on the event die's improvement faces:
          if the red production die's value is ≤ your level on the
          matching track, you draw the top card of that deck.
        </p>
        <p>
          Hand limit: <strong>4</strong> progress cards (VP cards don't
          count). If a draw puts you over the cap, you must discard down
          immediately. The current player has until end-of-turn to
          discard.
        </p>
        <p>
          You may play any number of progress cards per turn, in any
          order, except <em>Alchemy</em>, which must be played before
          rolling. Victory Point cards (Printing / Constitution) flip
          face-up the moment they're drawn.
        </p>
      </>
    ),
  },
  {
    id: 'ck-cards-science',
    title: 'Card reference — Science',
    body: (
      <>
        <ul>
          <li>
            <strong>Alchemy</strong> (×2) — set both production dice before
            rolling.
          </li>
          <li>
            <strong>Crane</strong> (×2) — next city improvement costs 1
            fewer commodity.
          </li>
          <li>
            <strong>Engineering</strong> (×1) — build a city wall at no
            cost.
          </li>
          <li>
            <strong>Invention</strong> (×2) — swap two number tokens
            (except 2, 6, 8, 12).
          </li>
          <li>
            <strong>Irrigation</strong> (×2) — take 2 wheat for each wheat
            hex adjacent to one of your buildings.
          </li>
          <li>
            <strong>Medicine</strong> (×2) — your next city upgrade costs
            1 wheat + 2 ore.
          </li>
          <li>
            <strong>Mining</strong> (×2) — take 2 ore for each ore hex
            adjacent to one of your buildings.
          </li>
          <li>
            <strong>Road Building</strong> (×2) — build 2 roads at no cost.
          </li>
          <li>
            <strong>Smithing</strong> (×2) — promote up to 2 of your
            knights for free.
          </li>
          <li>
            <strong>Printing</strong> (×1) — +1 VP (face-up).
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ck-cards-trade',
    title: 'Card reference — Trade',
    body: (
      <>
        <ul>
          <li>
            <strong>Commercial Harbor</strong> (×2) — offer each opponent
            one of your resources for one commodity of their choice.
          </li>
          <li>
            <strong>Guild Dues</strong> (×2) — take 2 cards (resource or
            commodity) from a player with more VPs than you.
          </li>
          <li>
            <strong>Merchant</strong> (×6) — place the merchant adjacent
            to one of your buildings. +1 VP and 2:1 on that hex.
          </li>
          <li>
            <strong>Merchant Fleet</strong> (×2) — pick a resource or
            commodity; trade it 2:1 with the bank this turn.
          </li>
          <li>
            <strong>Resource Monopoly</strong> (×4) — take 2 of a named
            resource from each player (1 if they only have 1).
          </li>
          <li>
            <strong>Trade Monopoly</strong> (×2) — take 1 of a named
            commodity from each player.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: 'ck-cards-politics',
    title: 'Card reference — Politics',
    body: (
      <>
        <ul>
          <li>
            <strong>Diplomacy</strong> (×2) — remove an "open" road. If
            you removed your own, build a free road immediately.
          </li>
          <li>
            <strong>Encouragement</strong> (×2) — activate all your
            knights at no cost.
          </li>
          <li>
            <strong>Espionage</strong> (×3) — look at another player's
            progress cards and take one (not VP).
          </li>
          <li>
            <strong>Intrigue</strong> (×2) — displace an opposing knight
            without using one of your own.
          </li>
          <li>
            <strong>Sabotage</strong> (×2) — every player with as many or
            more VPs as you discards half their hand.
          </li>
          <li>
            <strong>Taxation</strong> (×2) — move the robber, steal 1 card
            from EVERY player adjacent to the hex.
          </li>
          <li>
            <strong>Treason</strong> (×2) — force an opponent to remove a
            knight; place one of yours of the same strength or lower.
          </li>
          <li>
            <strong>Constitution</strong> (×1) — +1 VP (face-up).
          </li>
          <li>
            <strong>Wedding</strong> (×2) — every player with more VPs
            than you gives you 2 cards (their choice).
          </li>
        </ul>
      </>
    ),
  },
];
