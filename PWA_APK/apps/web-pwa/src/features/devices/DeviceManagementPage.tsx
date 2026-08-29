import { AppShell } from "@jenix/ui";
import { FiPlus } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { DeviceCatalogGrid } from "./components/DeviceCatalogGrid";

/**
 * Purely the "browse and add a product" catalog now -- the owned-device
 * list this page used to duplicate lived at the exact same home-scoped
 * endpoint Home already reads (listManagedDevices() called
 * getCurrentHome(session).homeId, same as HomeDashboardPage), so it was
 * showing the same devices twice for no reason. Home is the one place to
 * view/use devices you already have; this page is the one place to add
 * a new one.
 */
export function DeviceManagementPage() {
  const navigate = useNavigate();

  return (
    <AppShell
      eyebrow="Device Center"
      title="Device Management"
      aside={
        <button
          aria-label="Add device"
          className="devices-add-button"
          onClick={() => navigate("/provisioning/ble")}
          type="button"
        >
          <FiPlus size={20} />
        </button>
      }
    >
      <DeviceCatalogGrid
        onSelect={(pid) => navigate(`/provisioning?pid=${encodeURIComponent(pid)}`)}
      />
    </AppShell>
  );
}
