import { AppShell, StatusPill } from "@jenix/ui";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/hooks/useAuth";
import { getHomes } from "../dashboard/services/dashboardApi";
import { deviceCatalog } from "../devices/deviceCatalog";
import "./theme/provisioning.css";

/**
 * "Smart Mode" is BLE under the hood (BleProvisioningPage) -- the user is
 * never shown that word, matching Tuya's own convention of naming the
 * setup path by outcome, not transport. AP Mode is demoted to a small
 * fallback row: BLE is genuinely the primary path (see
 * BleProvisioningPage.tsx's own "Primary Flow" pill), and Wi-Fi hotspot
 * setup is meaningfully more manual for the installer. Generic across
 * every product in deviceCatalog.ts, not QRunlock-specific -- the product
 * header renders whichever pid the catalog grid was tapped with.
 */
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

  const ProductIcon = targetProduct?.icon;

  return (
    <AppShell
      eyebrow="Provisioning"
      title="Add a device"
      aside={<StatusPill label={currentHome.name} tone="neutral" />}
    >
      {targetProduct ? (
        <div className="prov-product-head">
          <span className="prov-product-icon" aria-hidden="true">
            {ProductIcon ? <ProductIcon size={24} /> : null}
          </span>
          <div>
            <h2>Set up {targetProduct.name}</h2>
            <p>Into {currentHome.name}</p>
          </div>
        </div>
      ) : null}

      <article className="prov-smart-card">
        <div className="prov-smart-top">
          <span className="prov-smart-icon" aria-hidden="true">
            <svg fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22">
              <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
            </svg>
          </span>
          <div className="prov-smart-title-row">
            <span className="prov-smart-title">Smart Mode</span>
            <span className="prov-badge">Recommended</span>
          </div>
        </div>
        <p className="prov-smart-sub">
          Just tap start — we&apos;ll find your device nearby and connect it to Wi-Fi
          automatically.
        </p>
        <button
          className="prov-smart-cta"
          onClick={() => navigate(routeFor("/provisioning/ble"))}
          type="button"
        >
          Start Smart Mode
        </button>
      </article>

      <div className="prov-divider-label">Having trouble?</div>
      <button
        className="prov-ap-row"
        onClick={() => navigate(routeFor("/provisioning/ap"))}
        type="button"
      >
        <span className="prov-ap-icon" aria-hidden="true">
          <svg fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
            <path d="M5 13a10 10 0 0 1 14 0" />
            <path d="M8.5 16.5a5 5 0 0 1 7 0" />
            <circle cx="12" cy="20" fill="currentColor" r="1" stroke="none" />
          </svg>
        </span>
        <span className="prov-ap-text">
          <span className="prov-ap-title">AP Mode</span>
          <span className="prov-ap-sub">Connect via the device&apos;s own Wi-Fi hotspot instead</span>
        </span>
        <span className="prov-ap-chevron" aria-hidden="true">
          <svg fill="none" height="15" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="15">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>
      </button>
    </AppShell>
  );
}
