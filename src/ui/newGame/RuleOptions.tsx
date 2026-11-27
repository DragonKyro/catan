import { InfoTip } from '@/ui/shared/InfoTip';
import { RULE_OPTION_TEXT } from '@/ui/shared/ruleOptions';
import './ExpansionPicker.css';

/** Optional rules that work with any game (each with an ⓘ explaining it). */
export interface RuleOptionsValue {
  friendlyRobber: boolean;
  balancedDice: boolean;
}

interface Props {
  value: RuleOptionsValue;
  onChange: (id: keyof RuleOptionsValue, on: boolean) => void;
  /** Why an option can't be used with the chosen game (shown, and the box off), if it can't. */
  blocked: Partial<Record<keyof RuleOptionsValue, string>>;
}

export function RuleOptions({ value, onChange, blocked }: Props) {
  return (
    <div className="expansion-picker" role="group" aria-label="Rule options">
      <span className="expansion-picker-label">Rule options</span>
      {(['friendlyRobber', 'balancedDice'] as const).map((id) => {
        const text = RULE_OPTION_TEXT[id];
        const why = blocked[id];
        return (
          <label key={id} className="expansion-picker-row" title={why}>
            <input
              type="checkbox"
              aria-label={text.label}
              checked={value[id] && !why}
              disabled={!!why}
              onChange={(e) => onChange(id, e.target.checked)}
            />
            <span>{text.label}</span>
            <InfoTip text={why ? `${why}. ${text.info}` : text.info} label={text.label} />
          </label>
        );
      })}
    </div>
  );
}
