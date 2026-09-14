import type { CalendarRule, ScheduleProfile } from "../services/schoolBellTypes";

export interface CalendarRuleRowProps {
  rule: CalendarRule;
  profiles: ScheduleProfile[];
}

export function CalendarRuleRow({ rule, profiles }: CalendarRuleRowProps) {
  const targetName = profiles.find((profile) => profile.id === rule.profile_id)?.name ?? rule.profile_id;

  return (
    <div className="sb-rule">
      <div className="t1">
        <span>
          {rule.name} → {targetName}
        </span>
        <span className="sb-pri">Priority {rule.priority}</span>
      </div>
      <div className="t2">
        {rule.start_date ?? "?"} – {rule.end_date ?? "?"} · {rule.repeat_yearly ? "repeats yearly" : "one-time"}
      </div>
    </div>
  );
}
