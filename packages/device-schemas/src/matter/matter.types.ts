export const matterModes = [
  "NONE",
  "NATIVE_MATTER",
  "MATTER_BRIDGE_CHILD",
  "MATTER_BRIDGE_GATEWAY"
] as const;

export type MatterMode = (typeof matterModes)[number];

export function isMatterMode(value: string): value is MatterMode {
  return matterModes.includes(value as MatterMode);
}
