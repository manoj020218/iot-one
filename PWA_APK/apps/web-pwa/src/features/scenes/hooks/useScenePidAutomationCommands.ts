import type { PidAutomationCommandDescriptor } from "@jenix/device-schemas";
import { useEffect, useState } from "react";

import { getDevicePidProfile } from "../../devices/services/deviceManagementApi";
import type { SceneDeviceOption } from "../services/sceneBuilder";

/**
 * Resolves each distinct device PID present in `deviceOptions` to the
 * automation commands its blueprint declares (see SCHEDULE.md). PIDs that
 * declare nothing, or fail to load, are simply absent from the map — the
 * caller falls back to the full platform command list for those.
 */
export function useScenePidAutomationCommands(
  deviceOptions: SceneDeviceOption[]
): Map<string, PidAutomationCommandDescriptor[]> {
  const [commandsByPid, setCommandsByPid] = useState<
    Map<string, PidAutomationCommandDescriptor[]>
  >(new Map());

  const distinctPids = Array.from(new Set(deviceOptions.map((option) => option.pid))).sort();
  const pidsKey = distinctPids.join(",");

  useEffect(() => {
    if (distinctPids.length === 0) {
      setCommandsByPid(new Map());
      return;
    }

    let cancelled = false;

    void Promise.all(
      distinctPids.map(async (pid) => {
        try {
          const profile = await getDevicePidProfile(pid);
          return [pid, profile.automation?.commands ?? []] as [
            string,
            PidAutomationCommandDescriptor[]
          ];
        } catch {
          return [pid, []] as [string, PidAutomationCommandDescriptor[]];
        }
      })
    ).then((entries) => {
      if (!cancelled) {
        setCommandsByPid(new Map(entries.filter(([, commands]) => commands.length > 0)));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pidsKey]);

  return commandsByPid;
}
