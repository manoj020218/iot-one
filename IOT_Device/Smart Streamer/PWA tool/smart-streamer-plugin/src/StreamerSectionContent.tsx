import { React } from "./host";
import { OverviewPage } from "./pages/OverviewPage";
import { DevicesPage } from "./pages/DevicesPage";
import { DeviceDetailPage } from "./pages/DeviceDetailPage";
import { CamerasPage } from "./pages/CamerasPage";
import { CameraFormPage } from "./pages/CameraFormPage";
import { DestinationsPage } from "./pages/DestinationsPage";
import { DestinationFormPage } from "./pages/DestinationFormPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { ScheduleFormPage } from "./pages/ScheduleFormPage";
import { LiveSessionsPage } from "./pages/LiveSessionsPage";
import { LiveSessionDetailPage } from "./pages/LiveSessionDetailPage";
import { DiagnosticsPage } from "./pages/DiagnosticsPage";
import { DeviceDiagnosticsPage } from "./pages/DeviceDiagnosticsPage";
import { OtaPage } from "./pages/OtaPage";
import { DeviceSettingsPage } from "./pages/DeviceSettingsPage";

// Sections with no drill-down state of their own and no props.
const SIMPLE_PAGES: Record<string, React.ComponentType> = {
  ota: OtaPage,
  settings: DeviceSettingsPage
};

function DevicesSection() {
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | null>(null);

  return selectedDeviceId ? (
    <DeviceDetailPage deviceId={selectedDeviceId} onBack={() => setSelectedDeviceId(null)} />
  ) : (
    <DevicesPage onOpenDevice={setSelectedDeviceId} />
  );
}

function CamerasSection() {
  const [selectedCameraId, setSelectedCameraId] = React.useState<string | "new" | null>(null);

  return selectedCameraId !== null ? (
    <CameraFormPage
      cameraId={selectedCameraId === "new" ? null : selectedCameraId}
      onBack={() => setSelectedCameraId(null)}
    />
  ) : (
    <CamerasPage onAddCamera={() => setSelectedCameraId("new")} onOpenCamera={setSelectedCameraId} />
  );
}

function DestinationsSection() {
  const [selectedDestinationId, setSelectedDestinationId] = React.useState<string | "new" | null>(null);

  return selectedDestinationId !== null ? (
    <DestinationFormPage
      destinationId={selectedDestinationId === "new" ? null : selectedDestinationId}
      onBack={() => setSelectedDestinationId(null)}
    />
  ) : (
    <DestinationsPage
      onAddDestination={() => setSelectedDestinationId("new")}
      onOpenDestination={setSelectedDestinationId}
    />
  );
}

function SchedulesSection() {
  const [selectedScheduleId, setSelectedScheduleId] = React.useState<string | "new" | null>(null);

  return selectedScheduleId !== null ? (
    <ScheduleFormPage
      onBack={() => setSelectedScheduleId(null)}
      scheduleId={selectedScheduleId === "new" ? null : selectedScheduleId}
    />
  ) : (
    <SchedulesPage
      onAddSchedule={() => setSelectedScheduleId("new")}
      onOpenSchedule={setSelectedScheduleId}
    />
  );
}

function SessionsSection() {
  const [selectedSessionId, setSelectedSessionId] = React.useState<string | null>(null);

  return selectedSessionId ? (
    <LiveSessionDetailPage onBack={() => setSelectedSessionId(null)} sessionId={selectedSessionId} />
  ) : (
    <LiveSessionsPage onOpenSession={setSelectedSessionId} />
  );
}

function DiagnosticsSection() {
  const [selectedDeviceId, setSelectedDeviceId] = React.useState<string | null>(null);

  return selectedDeviceId ? (
    <DeviceDiagnosticsPage deviceId={selectedDeviceId} onBack={() => setSelectedDeviceId(null)} />
  ) : (
    <DiagnosticsPage onOpenDevice={setSelectedDeviceId} />
  );
}

interface StreamerSectionContentProps {
  section: string;
  onNavigate: (section: string) => void;
}

// Mounted with key={section} by SmartStreamerApp, so switching sections
// naturally discards whatever drill-down state (selected device, camera
// being edited, ...) the previous section was holding — no manual reset
// wiring needed as more sections gain their own drill-down.
export function StreamerSectionContent({ section, onNavigate }: StreamerSectionContentProps) {
  if (section === "overview") {
    return <OverviewPage onNavigate={onNavigate} />;
  }

  if (section === "devices") {
    return <DevicesSection />;
  }

  if (section === "cameras") {
    return <CamerasSection />;
  }

  if (section === "destinations") {
    return <DestinationsSection />;
  }

  if (section === "schedules") {
    return <SchedulesSection />;
  }

  if (section === "sessions") {
    return <SessionsSection />;
  }

  if (section === "diagnostics") {
    return <DiagnosticsSection />;
  }

  const Page = SIMPLE_PAGES[section];
  return Page ? <Page /> : <OverviewPage onNavigate={onNavigate} />;
}
