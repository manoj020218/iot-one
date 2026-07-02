import { AddDeviceButton } from "./AddDeviceButton";
import { useNavigate } from "react-router-dom";

export function EmptyHomeState() {
  const navigate = useNavigate();

  return (
    <section className="empty-state">
      <h2>No devices in this HOME yet</h2>
      <p>Start provisioning from the dashboard and the first device will appear here.</p>
      <AddDeviceButton onPress={() => navigate("/provisioning")} />
    </section>
  );
}
