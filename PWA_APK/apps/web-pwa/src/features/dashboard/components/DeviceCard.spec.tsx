import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DeviceCard } from "./DeviceCard";

describe("DeviceCard", () => {
  it("renders PID icon text and device display name", () => {
    render(
      <DeviceCard
        device={{
          deviceId: "JNX-TG-A7F2",
          displayName: "Main Tank",
          pid: "JNX-TG-C3-001",
          pidLabel: "Smart Tank Guard",
          pidIconText: "TC",
          online: true,
          telemetryPreview: "Last seen 10:00:00 AM"
        }}
        onRename={vi.fn().mockResolvedValue(undefined)}
      />
    );

    expect(screen.getByText("Main Tank")).toBeInTheDocument();
    expect(screen.getByText("TC")).toBeInTheDocument();
    expect(screen.getByText("JNX-TG-C3-001")).toBeInTheDocument();
  });
});
