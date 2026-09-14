/**
 * TypeScript-facing wrapper for the official @capacitor/filesystem plugin
 * -- same window.Capacitor.Plugins access pattern as
 * features/provisioning/services/nativeWifiInfo.ts, deliberately not a
 * direct `@capacitor/filesystem` import: this repo's convention is that
 * web-pwa stays free of Capacitor-specific npm packages (only the native
 * android app declares them, for `npx cap sync` to pull in the real
 * plugin), and calls the bridge object the native runtime injects at
 * `window.Capacitor.Plugins`. Unavailable on the hosted web PWA -- every
 * caller here must treat a null return as "no phone-side library on this
 * build," not an error, and fall back to the direct-upload flow that
 * already works everywhere (SoundsScreen's upload button).
 */

export const NATIVE_DIRECTORY_DATA = "DATA";

export interface NativeFilesystemEntry {
  name: string;
  type: "file" | "directory";
  size: number;
}

export interface NativeFilesystemPlugin {
  writeFile: (options: { path: string; data: string; directory: string; recursive?: boolean }) => Promise<{ uri: string }>;
  readFile: (options: { path: string; directory: string }) => Promise<{ data: string }>;
  deleteFile: (options: { path: string; directory: string }) => Promise<void>;
  mkdir: (options: { path: string; directory: string; recursive?: boolean }) => Promise<void>;
  readdir: (options: { path: string; directory: string }) => Promise<{ files: NativeFilesystemEntry[] }>;
}

export function getNativeFilesystemPlugin(): NativeFilesystemPlugin | null {
  if (typeof window === "undefined") {
    return null;
  }

  const candidate = (
    window as Window & {
      Capacitor?: { Plugins?: { Filesystem?: NativeFilesystemPlugin } };
    }
  ).Capacitor?.Plugins?.Filesystem;

  return candidate ?? null;
}

export function isBellLibraryAvailable(): boolean {
  return getNativeFilesystemPlugin() !== null;
}
