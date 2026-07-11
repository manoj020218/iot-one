export type HomeFilter = "all" | "online" | "alert";

export interface HomeFilterTabsProps {
  active: HomeFilter;
  onChange: (filter: HomeFilter) => void;
}

export function HomeFilterTabs({ active, onChange }: HomeFilterTabsProps) {
  return (
    <div className="jx-seg">
      {(["all", "online", "alert"] as HomeFilter[]).map((value) => (
        <button
          className={active === value ? "on" : ""}
          key={value}
          onClick={() => onChange(value)}
          type="button"
        >
          {value === "all" ? "All" : value === "online" ? "Online" : "Alerts"}
        </button>
      ))}
    </div>
  );
}
