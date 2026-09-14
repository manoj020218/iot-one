import { base64ToBlob, blobToBase64 } from "./base64";
import { getNativeFilesystemPlugin, NATIVE_DIRECTORY_DATA } from "./nativeFilesystem";

/**
 * The school's own sound collection, kept on the phone (native app only —
 * see nativeFilesystem.ts) independent of any one bell device. This is
 * deliberately separate storage from the device's own /sounds: the
 * device only ever holds the small working set actually referenced by
 * its current schedule (see useBellLibrary.ts's sync logic), while this
 * library can hold everything the school owns.
 *
 * Scoped per deviceId under Directory.Data so two bells (or a bell
 * re-provisioned with a new deviceId) don't collide.
 */

export interface BellLibraryFile {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
}

function libraryPath(deviceId: string, fileName?: string): string {
  const base = `school-bell-library/${deviceId}`;
  return fileName ? `${base}/${fileName}` : base;
}

function mimeTypeFor(fileName: string): string {
  return fileName.toLowerCase().endsWith(".wav") ? "audio/wav" : "audio/mpeg";
}

export async function listLibraryFiles(deviceId: string): Promise<BellLibraryFile[]> {
  const plugin = getNativeFilesystemPlugin();
  if (!plugin) return [];

  try {
    const { files } = await plugin.readdir({ path: libraryPath(deviceId), directory: NATIVE_DIRECTORY_DATA });
    return files
      .filter((entry) => entry.type === "file")
      .map((entry) => ({ fileName: entry.name, sizeBytes: entry.size, mimeType: mimeTypeFor(entry.name) }));
  } catch {
    // Directory doesn't exist yet — an empty library, not an error.
    return [];
  }
}

export async function addFileToLibrary(deviceId: string, fileName: string, file: Blob): Promise<void> {
  const plugin = getNativeFilesystemPlugin();
  if (!plugin) throw new Error("A saved sound library needs the Jenix One app, not the browser version.");

  const data = await blobToBase64(file);
  await plugin.mkdir({ path: libraryPath(deviceId), directory: NATIVE_DIRECTORY_DATA, recursive: true }).catch(() => {
    // Already exists — fine.
  });
  await plugin.writeFile({ path: libraryPath(deviceId, fileName), data, directory: NATIVE_DIRECTORY_DATA });
}

export async function removeFileFromLibrary(deviceId: string, fileName: string): Promise<void> {
  const plugin = getNativeFilesystemPlugin();
  if (!plugin) return;
  await plugin.deleteFile({ path: libraryPath(deviceId, fileName), directory: NATIVE_DIRECTORY_DATA });
}

export async function readLibraryFileAsBlob(deviceId: string, fileName: string): Promise<Blob> {
  const plugin = getNativeFilesystemPlugin();
  if (!plugin) throw new Error("A saved sound library needs the Jenix One app, not the browser version.");

  const { data } = await plugin.readFile({ path: libraryPath(deviceId, fileName), directory: NATIVE_DIRECTORY_DATA });
  return base64ToBlob(data, mimeTypeFor(fileName));
}
