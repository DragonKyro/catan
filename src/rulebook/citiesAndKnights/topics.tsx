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
];
