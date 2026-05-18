import {
  SCENARIO_ORDER,
  DEFAULT_SCENARIO_ID,
  getScenario,
} from '@/game/modules/seafarers/board/scenarios';
import './ExpansionPicker.css';

export interface ExpansionPickerValue {
  seafarers: boolean;
  scenarioId: string;
}

export const SEAFARERS_SCENARIOS = SCENARIO_ORDER;

// Resolve the effective scenario for the given picker state, or null if
// Seafarers is off. Used by the lobby/new-game screens to read scenario
// constraints (min/max players, default VP).
export function activeScenario(v: ExpansionPickerValue) {
  return v.seafarers ? getScenario(v.scenarioId) : null;
}

export const DEFAULT_EXPANSIONS: ExpansionPickerValue = {
  seafarers: false,
  scenarioId: DEFAULT_SCENARIO_ID,
};

interface Props {
  value: ExpansionPickerValue;
  onChange: (next: ExpansionPickerValue) => void;
}

export function ExpansionPicker({ value, onChange }: Props) {
  return (
    <div className="expansion-picker">
      <span className="expansion-picker-label">Expansions</span>
      <label className="expansion-picker-row">
        <input
          type="checkbox"
          checked={value.seafarers}
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
    </div>
  );
}

export function expansionListFrom(v: ExpansionPickerValue): string[] {
  const out: string[] = [];
  if (v.seafarers) out.push('seafarers');
  return out;
}
