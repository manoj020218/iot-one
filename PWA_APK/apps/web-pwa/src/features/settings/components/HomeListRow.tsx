import type { HomeRecord } from "@jenix/shared";
import { FiChevronRight, FiHome } from "react-icons/fi";

export interface HomeListRowProps {
  home: HomeRecord;
  onClick: () => void;
}

export function HomeListRow({ home, onClick }: HomeListRowProps) {
  return (
    <article className="panel home-list-item">
      <button className="home-list-item-row" onClick={onClick} type="button">
        <span className="home-list-item-icon">
          <FiHome size={18} />
        </span>
        <span className="home-list-item-body">
          <strong>{home.name}</strong>
          <span className="hint-text">
            {home.locationLabel ?? "No address set"} · {home.timezone ?? "Asia/Kolkata"}
          </span>
        </span>
        <span className="role-pill" data-role={home.role}>
          {home.role}
        </span>
        <FiChevronRight size={18} />
      </button>
    </article>
  );
}
