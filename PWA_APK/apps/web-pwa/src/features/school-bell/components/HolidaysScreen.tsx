import type { HomeAccessRole } from "@jenix/shared";
import { useEffect, useState } from "react";
import { FiArrowLeft, FiPlus, FiTrash2 } from "react-icons/fi";

import { getHolidays, replaceHolidays } from "../services/schoolBellLocalApi";
import { canManageSchedule } from "../services/schoolBellRoles";
import type { Holiday } from "../services/schoolBellTypes";
import { AddHolidaySheet } from "./AddHolidaySheet";

export interface HolidaysScreenProps {
  role: HomeAccessRole;
  baseUrl: string | null;
  onBack: () => void;
}

export function HolidaysScreen({ role, baseUrl, onBack }: HolidaysScreenProps) {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const canEdit = canManageSchedule(role) && Boolean(baseUrl);

  function reload() {
    if (!baseUrl) return;
    setLoading(true);
    getHolidays(baseUrl)
      .then((result) => setHolidays(result.holidays))
      .finally(() => setLoading(false));
  }

  useEffect(reload, [baseUrl]);

  async function save(next: Holiday[]) {
    if (!baseUrl) return;
    await replaceHolidays(baseUrl, next);
    setHolidays(next);
  }

  return (
    <div className="sb-page">
      <div className="sb-back">
        <button className="sb-iconbtn" onClick={onBack} type="button">
          <FiArrowLeft size={15} />
        </button>
        <h2>Holidays</h2>
        <div className="sp" />
        {canEdit ? (
          <button className="sb-iconbtn" onClick={() => setAddOpen(true)} type="button">
            <FiPlus size={14} />
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="sb-empty">Loading…</div>
      ) : holidays.length === 0 ? (
        <div className="sb-empty">No holidays added yet.</div>
      ) : (
        <div className="sb-card">
          {holidays
            .slice()
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((holiday) => (
              <div className="sb-row" key={holiday.date + holiday.name}>
                <div className="swatch">{holiday.date.slice(5).replace("-", "/")}</div>
                <div className="body">
                  <div className="t">{holiday.name}</div>
                  <div className="s">Auto bells suppressed · manual ring still works</div>
                </div>
                {canEdit ? (
                  <div className="r">
                    <button
                      className="sb-iconbtn"
                      onClick={() => save(holidays.filter((h) => h !== holiday))}
                      style={{ color: "var(--danger)" }}
                      type="button"
                    >
                      <FiTrash2 size={13} />
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
        </div>
      )}

      <AddHolidaySheet
        onAdd={(holiday) => {
          void save([...holidays, holiday]);
          setAddOpen(false);
        }}
        onClose={() => setAddOpen(false)}
        open={addOpen}
      />
    </div>
  );
}
