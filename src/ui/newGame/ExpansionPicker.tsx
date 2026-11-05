import {
  SCENARIO_ORDER,
  DEFAULT_SCENARIO_ID,
  getScenario,
} from '@/game/modules/seafarers/board/scenarios';
import {
  BASE_SCENARIO_ORDER,
  DEFAULT_BASE_SCENARIO_ID,
  getBaseScenario,
} from '@/game/modules/base/scenarios';
import {
  TRADERS_SCENARIO_ORDER,
  getTradersScenario,
} from '@/game/modules/traders/board/scenarios';
import { CITIES_AND_KNIGHTS_EXPANSION_ID } from '@/game/modules/citiesAndKnights/constants';
import { TRADERS_EXPANSION_ID } from '@/game/modules/traders/constants';
import './ExpansionPicker.css';

export interface ExpansionPickerValue {
  seafarers: boolean;
  // Cities & Knights — mutually exclusive with Seafarers in Phase 1.
  citiesKnights: boolean;
  // Traders & Barbarians — mutually exclusive with Seafarers and C&K in this
  // commit (board-merging and rule-combos are deferred).
  traders: boolean;
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
  return {
    kind: 'base' as const,
    name: s.name,
    minPlayers: s.minPlayers,
    maxPlayers: s.maxPlayers,
    defaultVpToWin: s.defaultVpToWin ?? 10,
    defaultVpToWin5_6: s.defaultVpToWin5_6,
  };
}

export const DEFAULT_EXPANSIONS: ExpansionPickerValue = {
  seafarers: false,
  citiesKnights: false,
  traders: false,
  scenarioId: DEFAULT_SCENARIO_ID,
  baseScenarioId: DEFAULT_BASE_SCENARIO_ID,
  tradersScenarioId: 'riversOfCatan',
  tradersVariants: { friendlyRobber: false, strongestPorts: false, eventCards: false },
};

interface Props {
  value: ExpansionPickerValue;
  onChange: (next: ExpansionPickerValue) => void;
}

export function ExpansionPicker({ value, onChange }: Props) {
  return (
    <div className="expansion-picker">
      <span className="expansion-picker-label">Expansions</span>

      {/* Base game scenario dropdown — always visible. The "Standard" entry
          falls through to the legacy 19/30/37-hex generator; the other entries
          are colonist.io-style Fun Maps. Hidden when Seafarers or T&B is on
          because those expansions supply their own board shapes. */}
      {!value.seafarers && !value.traders && (
        <label className="expansion-picker-scenario">
          <span>Base map</span>
          <select
            value={value.baseScenarioId}
            onChange={(e) =>
              onChange({ ...value, baseScenarioId: e.target.value })
            }
          >
            {BASE_SCENARIOS_LIST.map((s) => (
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
          value.citiesKnights || value.traders
            ? "Disable the other expansion first — Seafarers can't yet be combined with Cities & Knights or Traders & Barbarians."
            : undefined
        }
      >
        <input
          type="checkbox"
          checked={value.seafarers}
          disabled={value.citiesKnights || value.traders}
          onChange={(e) => onChange({ ...value, seafarers: e.target.checked })}
        />
        <span>Seafarers</span>
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
          value.seafarers || value.traders
            ? "Disable the other expansion first — C&K can't yet be combined with Seafarers or Traders & Barbarians."
            : undefined
        }
      >
        <input
          type="checkbox"
          checked={value.citiesKnights}
          disabled={value.seafarers || value.traders}
          onChange={(e) =>
            onChange({ ...value, citiesKnights: e.target.checked })
          }
        />
        <span>Cities &amp; Knights</span>
      </label>

      <label
        className="expansion-picker-row"
        title={
          value.seafarers || value.citiesKnights
            ? "Disable the other expansion first — Traders & Barbarians can't yet be combined."
            : undefined
        }
      >
        <input
          type="checkbox"
          checked={value.traders}
          disabled={value.seafarers || value.citiesKnights}
          onChange={(e) => onChange({ ...value, traders: e.target.checked })}
        />
        <span>Traders &amp; Barbarians</span>
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

      {/* T&B variants combine with any game (rulebook p. 4-6). */}
      <span className="expansion-picker-label">Traders &amp; Barbarians variants</span>
      <VariantToggle
        value={value}
        onChange={onChange}
        flag="friendlyRobber"
        label="Friendly Robber"
        title="The robber may not go to a hex with a building of a player who has only 2 VPs"
      />
      <VariantToggle
        value={value}
        onChange={onChange}
        flag="strongestPorts"
        label="Strongest Ports (+1 VP target)"
        title="3+ VPs in buildings on harbors takes a 2 VP tile; a player with more takes it over"
      />
      <VariantToggle
        value={value}
        onChange={onChange}
        flag="eventCards"
        label="Catan Event Cards (deck replaces dice)"
        title={
          value.citiesKnights
            ? "Can't be combined with Cities & Knights yet"
            : 'Flip an event card each turn instead of rolling: resolve its event, then produce for its number'
        }
        disabled={value.citiesKnights}
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

export function expansionListFrom(v: ExpansionPickerValue): string[] {
  const out: string[] = [];
  if (v.seafarers) out.push('seafarers');
  if (v.citiesKnights) out.push(CITIES_AND_KNIGHTS_EXPANSION_ID);
  if (v.traders) out.push(TRADERS_EXPANSION_ID);
  return out;
}
