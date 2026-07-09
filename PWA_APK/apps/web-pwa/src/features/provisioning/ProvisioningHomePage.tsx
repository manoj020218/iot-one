import { AppShell, StatusPill } from "@jenix/ui";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { getHomes } from "../dashboard/services/dashboardApi";

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

  if (!session) {
    throw new Error("ProvisioningHomePage requires an authenticated session");
  }

  const currentHome = getHomes(session)[0]!;

  return (
    <AppShell
      eyebrow="Provisioning"
      title="Choose a provisioning path"
      description="Phase 6 adds an operator-grade onboarding flow for new devices, with BLE as the primary path and AP mode as the recovery path."
      aside={<StatusPill label={currentHome.name} tone="neutral" />}
    >
      <section className="top-bar">
        <div>
          <span className="eyebrow">Active HOME</span>
          <h2>{currentHome.name}</h2>
          <p>Signed in as {session.user.name}</p>
        </div>
        <button
          className="text-button"
          onClick={() => navigate("/home")}
          type="button"
        >
          Back to Dashboard
        </button>
      </section>
      <section className="provisioning-method-grid">
        {provisioningOptions.map((option) => (
          <article className="panel provisioning-method-card" key={option.route}>
            <StatusPill label={option.method} tone="warning" />
            <h2>{option.title}</h2>
            <p>{option.description}</p>
            <p className="provisioning-note">{option.checkpoints}</p>
            <button
              className="primary-button"
              onClick={() => navigate(option.route)}
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
