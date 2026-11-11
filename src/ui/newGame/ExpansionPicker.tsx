import {
  SCENARIO_ORDER,
  DEFAULT_SCENARIO_ID,
  getScenario,
} from '@/game/modules/seafarers/board/scenarios';
import {
  BASE_SCENARIO_ORDER,
  DEFAULT_BASE_SCENARIO_ID,
  baseScenarioAllowed,
  getBaseScenario,
} from '@/game/modules/base/scenarios';
import {
  TRADERS_SCENARIO_ORDER,
  getTradersScenario,
} from '@/game/modules/traders/board/scenarios';
import {
  CITIES_AND_KNIGHTS_DEFAULT_VP,
  CITIES_AND_KNIGHTS_EXPANSION_ID,
  CITIES_AND_KNIGHTS_MAX_PLAYERS,
} from '@/game/modules/citiesAndKnights/constants';
import { TRADERS_EXPANSION_ID } from '@/game/modules/traders/constants';
import {
  EP_DEFAULT_VP,
  EP_MAX_PLAYERS,
  EP_MIN_PLAYERS,
  EXPLORERS_PIRATES_EXPANSION_ID,
} from '@/game/modules/explorersPirates/constants';
import './ExpansionPicker.css';
import { RULE_SET_COLORS } from '@/ui/menu/ruleSets';

export interface ExpansionPickerValue {
  seafarers: boolean;
  // Cities & Knights — mutually exclusive with Seafarers in Phase 1.
  citiesKnights: boolean;
  // Traders & Barbarians — mutually exclusive with Seafarers and C&K in this
  // commit (board-merging and rule-combos are deferred).
  traders: boolean;
  // Explorers & Pirates: its own map and turn; combines with nothing else
  // (no T&B variants either).
  explorersPirates: boolean;
  scenarioId: string;
  baseScenarioId: string;
  tradersScenarioId: string;
  // T&B variants: work with any rule set (base, Seafarers, T&B scenarios).
  tradersVariants: {
    friendlyRobber: boolean;
    strongestPorts: boolean;
    eventCards: boolean;
  };
}

export const SEAFARERS_SCENARIOS = SCENARIO_ORDER;
export const BASE_SCENARIOS_LIST = BASE_SCENARIO_ORDER;
export const TRADERS_SCENARIOS_LIST = TRADERS_SCENARIO_ORDER;

// Resolve the effective scenario for the given picker state. Returns the
// Seafarers scenario when the expansion is on (no fallback to base — the two
// dropdowns are independent), otherwise the base-game scenario. The shape is
// loose because each scenario type carries its own metadata fields; callers
// read what they need.
export function activeScenario(v: ExpansionPickerValue) {
  if (v.explorersPirates) {
    return {
      kind: 'explorersPirates' as const,
      name: 'Explorers & Pirates',
      minPlayers: EP_MIN_PLAYERS,
      maxPlayers: EP_MAX_PLAYERS,
      defaultVpToWin: EP_DEFAULT_VP,
      defaultVpToWin5_6: undefined as number | undefined,
    };
  }
  if (v.traders) {
    const s = getTradersScenario(v.tradersScenarioId);
    return {
      kind: 'traders' as const,
      name: s.name,
      minPlayers: s.minPlayers,
      maxPlayers: s.maxPlayers,
      defaultVpToWin: s.defaultVpToWin ?? 10,
      defaultVpToWin5_6: undefined as number | undefined,
    };
  }
  if (v.seafarers) {
    const s = getScenario(v.scenarioId);
    return {
      kind: 'seafarers' as const,
      name: s.name,
      minPlayers: s.minPlayers,
      maxPlayers: s.maxPlayers,
      defaultVpToWin: s.defaultVpToWin,
      defaultVpToWin5_6: s.defaultVpToWin5_6,
    };
  }
  const s = getBaseScenario(v.baseScenarioId);
  // Cities & Knights: 13 VP on any map (p.2), and its own seat limit.
  if (v.citiesKnights) {
    return {
      kind: 'base' as const,
      name: s.id === 'standard' ? 'Cities & Knights' : s.name,
      minPlayers: s.minPlayers,
      maxPlayers: Math.min(s.maxPlayers, CITIES_AND_KNIGHTS_MAX_PLAYERS),
      defaultVpToWin: CITIES_AND_KNIGHTS_DEFAULT_VP,
      defaultVpToWin5_6: CITIES_AND_KNIGHTS_DEFAULT_VP as number | undefined,
    };
  }
  return {
    kind: 'base' as const,
    name: s.name,
    minPlayers: s.minPlayers,
    maxPlayers: s.maxPlayers,
    defaultVpToWin: s.defaultVpToWin ?? 10,
    defaultVpToWin5_6: s.defaultVpToWin5_6,
  };
}

// Expansion ids the picker value turns on (for map compatibility checks).
function expansionIds(v: ExpansionPickerValue): string[] {
  const out: string[] = [];
  if (v.seafarers) out.push('seafarers');
  if (v.citiesKnights) out.push(CITIES_AND_KNIGHTS_EXPANSION_ID);
  if (v.traders) out.push(TRADERS_EXPANSION_ID);
  if (v.explorersPirates) out.push(EXPLORERS_PIRATES_EXPANSION_ID);
  return out;
}

// Keep the base map valid for the chosen expansions: the C&K first-game
// board needs C&K, and Gold Rush / Volcano can't be played with it.
export function withValidBaseMap(v: ExpansionPickerValue): ExpansionPickerValue {
  const map = getBaseScenario(v.baseScenarioId);
  return baseScenarioAllowed(map, expansionIds(v))
    ? v
    : { ...v, baseScenarioId: DEFAULT_BASE_SCENARIO_ID };
}

export const DEFAULT_EXPANSIONS: ExpansionPickerValue = {
  seafarers: false,
  citiesKnights: false,
  traders: false,
  explorersPirates: false,
  scenarioId: DEFAULT_SCENARIO_ID,
  baseScenarioId: DEFAULT_BASE_SCENARIO_ID,
  tradersScenarioId: 'riversOfCatan',
  tradersVariants: { friendlyRobber: false, strongestPorts: false, eventCards: false },
};

interface Props {
  value: ExpansionPickerValue;
  onChange: (next: ExpansionPickerValue) => void;
}

export function ExpansionPicker({ value, onChange: rawOnChange }: Props) {
  const onChange = (next: ExpansionPickerValue) => rawOnChange(withValidBaseMap(next));
  const maps = BASE_SCENARIOS_LIST.filter((s) =>
    baseScenarioAllowed(getBaseScenario(s.id), expansionIds(value)),
  );
  return (
    <div className="expansion-picker">
      <span className="expansion-picker-label">Expansions</span>

      {/* Base game scenario dropdown — always visible. The "Standard" entry
          falls through to the legacy 19/30/37-hex generator; the other entries
          are colonist.io-style Fun Maps. Hidden when Seafarers or T&B is on
          because those expansions supply their own board shapes. */}
      {!value.seafarers && !value.traders && !value.explorersPirates && (
        <label className="expansion-picker-scenario">
          <span>Base map</span>
          <select
            value={value.baseScenarioId}
            onChange={(e) =>
              onChange({ ...value, baseScenarioId: e.target.value })
            }
          >
            {maps.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label
        className="expansion-picker-row"
        title={
          value.citiesKnights || value.traders || value.explorersPirates
            ? "Disable the other expansion first — Seafarers can't yet be combined with another expansion."
            : undefined
        }
      >
        <input
          type="checkbox"
          checked={value.seafarers}
          disabled={value.citiesKnights || value.traders || value.explorersPirates}
          onChange={(e) => onChange({ ...value, seafarers: e.target.checked })}
        />
        <span>Seafarers</span>
        <SetMark color={RULE_SET_COLORS.seafarers} />
      </label>
      {value.seafarers && (
        <label className="expansion-picker-scenario">
          <span>Scenario</span>
          <select
            value={value.scenarioId}
            onChange={(e) => onChange({ ...value, scenarioId: e.target.value })}
          >
            {/* Numbered by canonical rulebook order, which is roughly
                introductory → advanced. Helps players pick a "next
                hardest" scenario without reading them all. */}
            {SEAFARERS_SCENARIOS.map((s, i) => (
              <option key={s.id} value={s.id}>
                {i + 1}. {s.label}
              </option>
            ))}
          </select>
        </label>
      )}

      <label
        className="expansion-picker-row"
        title={
          value.seafarers || value.traders || value.explorersPirates
            ? "Disable the other expansion first — C&K can't yet be combined with another expansion."
            : undefined
        }
      >
        <input
          type="checkbox"
          checked={value.citiesKnights}
          disabled={value.seafarers || value.traders || value.explorersPirates}
          onChange={(e) =>
            onChange({ ...value, citiesKnights: e.target.checked })
          }
        />
        <span>Cities &amp; Knights</span>
        <SetMark color={RULE_SET_COLORS.citiesKnights} />
      </label>

      <label
        className="expansion-picker-row"
        title={
          value.seafarers || value.citiesKnights || value.explorersPirates
            ? "Disable the other expansion first — Traders & Barbarians can't yet be combined."
            : undefined
        }
      >
        <input
          type="checkbox"
          checked={value.traders}
          disabled={value.seafarers || value.citiesKnights || value.explorersPirates}
          onChange={(e) => onChange({ ...value, traders: e.target.checked })}
        />
        <span>Traders &amp; Barbarians</span>
        <SetMark color={RULE_SET_COLORS.traders} />
      </label>
      {value.traders && (
        <>
          <label className="expansion-picker-scenario">
            <span>Scenario</span>
            <select
              value={value.tradersScenarioId}
              onChange={(e) =>
                onChange({ ...value, tradersScenarioId: e.target.value })
              }
            >
              {TRADERS_SCENARIOS_LIST.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      <label
        className="expansion-picker-row"
        title={
          value.seafarers || value.citiesKnights || value.traders
            ? "Disable the other expansion first — Explorers & Pirates can't be combined."
            : 'The complete Explorers & Pirates scenario (3-4 players, 17 VP): explore, pirate lairs, fish and spices'
        }
      >
        <input
          type="checkbox"
          checked={value.explorersPirates}
          disabled={value.seafarers || value.citiesKnights || value.traders}
          onChange={(e) => onChange({ ...value, explorersPirates: e.target.checked })}
        />
        <span>Explorers &amp; Pirates</span>
        <SetMark color={RULE_SET_COLORS.explorersPirates} />
      </label>

      {/* T&B variants combine with any game (rulebook p. 4-6) except
          Explorers & Pirates (no robber, harbors or plain dice roll). */}
      <span className="expansion-picker-label">Traders &amp; Barbarians variants</span>
      <VariantToggle
        value={value}
        onChange={onChange}
        flag="friendlyRobber"
        label="Friendly Robber"
        title={
          value.explorersPirates
            ? EP_NO_VARIANTS
            : 'The robber may not go to a hex with a building of a player who has only 2 VPs'
        }
        disabled={value.explorersPirates}
      />
      <VariantToggle
        value={value}
        onChange={onChange}
        flag="strongestPorts"
        label="Strongest Ports (+1 VP target)"
        title={
          value.explorersPirates
            ? EP_NO_VARIANTS
            : '3+ VPs in buildings on harbors takes a 2 VP tile; a player with more takes it over'
        }
        disabled={value.explorersPirates}
      />
      <VariantToggle
        value={value}
        onChange={onChange}
        flag="eventCards"
        label="Catan Event Cards (deck replaces dice)"
        title={
          value.explorersPirates
            ? EP_NO_VARIANTS
            : value.citiesKnights
              ? "Can't be combined with Cities & Knights yet"
              : 'Flip an event card each turn instead of rolling: resolve its event, then produce for its number'
        }
        disabled={value.citiesKnights || value.explorersPirates}
      />
    </div>
  );
}

function VariantToggle({
  value,
  onChange,
  flag,
  label,
  title,
  disabled,
}: Props & {
  flag: keyof ExpansionPickerValue['tradersVariants'];
  label: string;
  title: string;
  disabled?: boolean;
}) {
  return (
    <label className="expansion-picker-row" title={title}>
      <input
        type="checkbox"
        checked={value.tradersVariants[flag] && !disabled}
        disabled={disabled}
        onChange={(e) =>
          onChange({
            ...value,
            tradersVariants: { ...value.tradersVariants, [flag]: e.target.checked },
          })
        }
      />
      <span>{label}</span>
    </label>
  );
}

/** The rule set's colour (as on the home screen's chips). */
function SetMark({ color }: { color: string }) {
  return <span className="expansion-picker-mark" style={{ background: color }} aria-hidden />;
}

export function expansionListFrom(v: ExpansionPickerValue): string[] {
  return expansionIds(v);
}

const EP_NO_VARIANTS = "Can't be combined with Explorers & Pirates";

// The T&B variants the picker value really turns on: none with Explorers &
// Pirates, no Event Cards with Cities & Knights.
export function activeVariants(
  v: ExpansionPickerValue,
): ExpansionPickerValue['tradersVariants'] | undefined {
  if (v.explorersPirates) return undefined;
  return { ...v.tradersVariants, eventCards: v.tradersVariants.eventCards && !v.citiesKnights };
}
