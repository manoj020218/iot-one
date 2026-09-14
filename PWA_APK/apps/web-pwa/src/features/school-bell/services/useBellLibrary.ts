import { useCallback, useEffect, useState } from "react";

import { addFileToLibrary, listLibraryFiles, readLibraryFileAsBlob, removeFileFromLibrary, type BellLibraryFile } from "./bellLibrary";
import { isBellLibraryAvailable } from "./nativeFilesystem";
import { uploadSound } from "./schoolBellLocalApi";

export interface BellLibraryState {
  available: boolean;
  files: BellLibraryFile[];
  loading: boolean;
  addFile: (file: File) => Promise<void>;
  removeFile: (fileName: string) => Promise<void>;
  pushToDevice: (fileName: string) => Promise<void>;
}

/** Phone-side library management, plus the one bridge action into the device's own storage: push a library file onto it via the existing /sd/upload endpoint. */
export function useBellLibrary(deviceId: string, baseUrl: string | null): BellLibraryState {
  const available = isBellLibraryAvailable();
  const [files, setFiles] = useState<BellLibraryFile[]>([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    if (!available) return;
    setLoading(true);
    listLibraryFiles(deviceId)
      .then(setFiles)
      .finally(() => setLoading(false));
  }, [available, deviceId]);

  useEffect(reload, [reload]);

  const addFile = useCallback(
    async (file: File) => {
      await addFileToLibrary(deviceId, file.name, file);
      reload();
    },
    [deviceId, reload]
  );

  const removeFile = useCallback(
    async (fileName: string) => {
      await removeFileFromLibrary(deviceId, fileName);
      reload();
    },
    [deviceId, reload]
  );

  const pushToDevice = useCallback(
    async (fileName: string) => {
      if (!baseUrl) throw new Error("Not connected to the bell");
      const blob = await readLibraryFileAsBlob(deviceId, fileName);
      await uploadSound(baseUrl, fileName, blob);
    },
    [deviceId, baseUrl]
  );

  return { available, files, loading, addFile, removeFile, pushToDevice };
}
