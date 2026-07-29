import { useState } from "react";
import { FiGrid } from "react-icons/fi";

import {
  deviceCatalog,
  deviceCategories,
  type DeviceCategoryFilter
} from "../deviceCatalog";

export interface DeviceCatalogGridProps {
  onSelect: (pid: string) => void;
}

export function DeviceCatalogGrid({ onSelect }: DeviceCatalogGridProps) {
  const [activeCategory, setActiveCategory] = useState<DeviceCategoryFilter>("all");
  const visible =
    activeCategory === "all"
      ? deviceCatalog
      : deviceCatalog.filter((entry) => entry.category === activeCategory);

  return (
    <section className="device-catalog">
      <p className="hint-text device-catalog-note">
        Supported devices you can add to this home.
      </p>
      <div className="device-catalog-layout">
        <nav className="device-catalog-categories">
          <button
            className="device-catalog-category"
            data-active={activeCategory === "all"}
            onClick={() => setActiveCategory("all")}
            type="button"
          >
            <FiGrid size={16} />
            All
          </button>
          {deviceCategories.map((category) => (
            <button
              className="device-catalog-category"
              data-active={activeCategory === category.id}
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              type="button"
            >
              <category.icon size={16} />
              {category.label}
            </button>
          ))}
        </nav>
        <div className="device-catalog-grid">
          {visible.map((entry) => (
            <button
              className="device-catalog-tile"
              key={entry.pid}
              onClick={() => onSelect(entry.pid)}
              type="button"
            >
              <span className="device-catalog-tile-icon">
                <entry.icon size={26} />
              </span>
              <span>{entry.name}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
