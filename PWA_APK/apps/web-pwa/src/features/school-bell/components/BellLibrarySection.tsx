import { useRef, useState } from "react";
import { FiPlus, FiTrash2, FiUploadCloud } from "react-icons/fi";

import { formatBytes } from "../services/formatBytes";
import type { BellLibraryState } from "../services/useBellLibrary";
import { useBitrateWarning } from "../services/useBitrateWarning";

export interface BellLibrarySectionProps {
  library: BellLibraryState;
  canManage: boolean;
  onPushed: () => void;
}

/**
 * The school's own saved sound collection on this phone (native app only
 * — see nativeFilesystem.ts). Separate from the device's own SD/`/bells`
 * library shown above it in SoundsScreen: this is where the app keeps
 * files the device doesn't currently need, ready to push on demand.
 */
export function BellLibrarySection({ library, canManage, onPushed }: BellLibrarySectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pushingFile, setPushingFile] = useState<string | null>(null);
  const bitrateWarning = useBitrateWarning();

  if (!library.available) {
    return (
      <div className="sb-info" style={{ marginTop: 4 }}>
        A saved sound library on your phone is available in the Jenix One app — open this bell from the app instead of a browser to
        use it.
      </div>
    );
  }

  async function handlePush(fileName: string) {
    setPushingFile(fileName);
    try {
      await library.pushToDevice(fileName);
      onPushed();
    } finally {
      setPushingFile(null);
    }
  }

  return (
    <>
      <div className="sb-sec">
        <h3>Your saved library · {library.files.length} files</h3>
        {canManage ? (
          <button className="sb-iconbtn" onClick={() => fileInputRef.current?.click()} title="Add to library" type="button">
            <FiPlus size={14} />
          </button>
        ) : null}
        <input
          accept="audio/mpeg,audio/wav"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              void bitrateWarning.check(file);
              void library.addFile(file);
            }
            event.target.value = "";
          }}
          ref={fileInputRef}
          type="file"
        />
      </div>

      {bitrateWarning.warning ? <div className="sb-info">{bitrateWarning.warning}</div> : null}

      {library.loading ? (
        <div className="sb-empty">Loading…</div>
      ) : library.files.length === 0 ? (
        <div className="sb-empty">Nothing saved yet — files you add here stay on this phone, ready to push to the bell anytime.</div>
      ) : (
        <div className="sb-card">
          {library.files.map((file) => (
            <div className="sb-row" key={file.fileName}>
              <div className="body">
                <div className="t">{file.fileName}</div>
                <div className="s">{formatBytes(file.sizeBytes)}</div>
              </div>
              {canManage ? (
                <div className="r">
                  <button
                    className="sb-iconbtn"
                    disabled={pushingFile === file.fileName}
                    onClick={() => handlePush(file.fileName)}
                    title="Push to bell"
                    type="button"
                  >
                    <FiUploadCloud size={14} />
                  </button>
                  <button
                    className="sb-iconbtn"
                    onClick={() => library.removeFile(file.fileName)}
                    style={{ color: "var(--danger)" }}
                    title="Remove from library"
                    type="button"
                  >
                    <FiTrash2 size={13} />
                  </button>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
