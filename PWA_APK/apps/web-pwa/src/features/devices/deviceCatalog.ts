import type { IconType } from "react-icons";
import {
  FiActivity,
  FiAlertTriangle,
  FiBell,
  FiClipboard,
  FiDroplet,
  FiHash,
  FiMonitor,
  FiRadio,
  FiShield,
  FiVideo,
  FiZap
} from "react-icons/fi";

export type DeviceCategoryId = "sense" | "automate" | "operate" | "protect" | "broadcast";
export type DeviceCategoryFilter = DeviceCategoryId | "all";

export interface DeviceCategory {
  id: DeviceCategoryId;
  label: string;
  icon: IconType;
}

export interface DeviceCatalogEntry {
  pid: string;
  name: string;
  category: DeviceCategoryId;
  icon: IconType;
}

export const deviceCategories: DeviceCategory[] = [
  { id: "sense", label: "Sense & Alert", icon: FiActivity },
  { id: "automate", label: "Automate & Control", icon: FiZap },
  { id: "operate", label: "Queue Operations", icon: FiClipboard },
  { id: "protect", label: "Protect & Warn", icon: FiShield },
  { id: "broadcast", label: "Broadcast & Stream", icon: FiVideo }
];

export const deviceCatalog: DeviceCatalogEntry[] = [
  { pid: "JNX-TG-C3-001", name: "Tank Guard", category: "sense", icon: FiDroplet },
  { pid: "JNX-RFNC-C3-01", name: "Nurse Call Receiver", category: "sense", icon: FiBell },
  { pid: "JNX-SRR433-C3-STX01", name: "Smart RF Bridge", category: "automate", icon: FiRadio },
  { pid: "JNX-TD-C3-01", name: "Token Dispenser", category: "operate", icon: FiHash },
  { pid: "JNX-P10-C3-01", name: "Token Display", category: "operate", icon: FiMonitor },
  { pid: "JNX-SOS-C3-001", name: "SOS Siren", category: "protect", icon: FiAlertTriangle },
  { pid: "JNX-SS-P4-001", name: "Smart Streamer", category: "broadcast", icon: FiVideo }
];
