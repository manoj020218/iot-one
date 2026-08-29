import { AppShell, StatusPill } from "@jenix/ui";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { getHomes } from "../dashboard/services/dashboardApi";
import { deviceCatalog } from "../devices/deviceCatalog";

const provisioningOptions = [
  {
    method: "BLE Guided",
    route: "/provisioning/ble",
    title: "Fast setup for BLE-capable devices",
    description:
      "Use Bluetooth discovery to identify nearby Jenix hardware, then send Wi-Fi credentials and cloud enrollment in one flow.",
    checkpoints: "Best for ESP32-C3 class products with BLE commissioning."
  },
  {
    method: "AP Fallback",
    route: "/provisioning/ap",
    title: "Fallback setup through device hotspot",
    description:
      "Use AP mode when Bluetooth is unavailable or when installers need a manual path from captive portal to cloud registration.",
    checkpoints: "Best for field recovery, browser limitations, or hotspot-only firmware."
  }
] as const;

export function ProvisioningHomePage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const targetPid = searchParams.get("pid") ?? undefined;
  const targetProduct = targetPid
    ? deviceCatalog.find((entry) => entry.pid === targetPid)
    : undefined;

  if (!session) {
    throw new Error("ProvisioningHomePage requires an authenticated session");
  }

  const currentHome = getHomes(session)[0]!;

  function routeFor(route: string) {
    return targetPid ? `${route}?pid=${encodeURIComponent(targetPid)}` : route;
  }

  return (
    <AppShell
      eyebrow="Provisioning"
      title={
        targetProduct ? `Set up: ${targetProduct.name}` : "Choose a provisioning path"
      }
      description={
        targetProduct
          ? `Add a ${targetProduct.name} to this home using Bluetooth, or fall back to Wi-Fi hotspot mode if needed.`
          : "Add a new device using Bluetooth, or fall back to Wi-Fi hotspot mode if needed."
      }
      aside={<StatusPill label={currentHome.name} tone="neutral" />}
    >
      <section className="provisioning-method-grid">
        {provisioningOptions.map((option) => (
          <article className="panel provisioning-method-card" key={option.route}>
            <StatusPill label={option.method} tone="warning" />
            <h2>{option.title}</h2>
            <p>{option.description}</p>
            <p className="provisioning-note">{option.checkpoints}</p>
            <button
              className="primary-button"
              onClick={() => navigate(routeFor(option.route))}
              type="button"
            >
              Open {option.method}
            </button>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
