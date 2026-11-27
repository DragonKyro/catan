// What each optional rule does, in one place for the New Game screen and the
// online lobby (the ⓘ next to each checkbox).

export type RuleOptionId = 'friendlyRobber' | 'balancedDice' | 'strongestPorts' | 'eventCards';

export const RULE_OPTION_TEXT: Record<RuleOptionId, { label: string; info: string }> = {
  friendlyRobber: {
    label: 'Friendly Robber',
    info:
      "The robber can't go on a hex next to a player with 2 or fewer visible points, and nobody with 2 or fewer " +
      "can be robbed. If no hex is left, it goes to the desert. Keeps the robber off whoever's behind early on.",
  },
  balancedDice: {
    label: 'Balanced dice',
    info:
      'Past rolls bias the next roll: a number that has come up more than its share becomes less likely and an ' +
      "overdue one more likely, a 7 is less likely straight after a 7, and a player who's rolled more than their " +
      'share of 7s rolls fewer. Over a game each number comes up close to how often it should.',
  },
  strongestPorts: {
    label: 'Strongest Ports (+1 VP target)',
    info:
      'The first player with 3 points in buildings on harbors (settlement 1, city 2) takes a 2 VP tile; a player ' +
      'with more takes it over. The points needed to win go up by 1.',
  },
  eventCards: {
    label: 'Catan Event Cards',
    info:
      'Flip an event card each turn instead of rolling the dice: resolve its event, then everyone produces for ' +
      'its number. The deck follows the dice odds.',
  },
};

export const TWO_PLAYER_INFO =
  "Two players play colonist.io's 1v1 rules: 15 points to win, a 7 only makes hands of 10 or more cards " +
  'discard, and Friendly Robber and Balanced dice are on unless you turn them off.';
