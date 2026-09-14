import { useCallback, useState } from "react";

import { estimateBitrateKbps, RECOMMENDED_MAX_BITRATE_KBPS } from "./audioBitrate";

export interface BitrateWarningState {
  warning: string | null;
  check: (file: File) => Promise<void>;
}

/** Non-blocking — flags a high-bitrate upload so the admin can choose a smaller export next time, but never stops the upload itself. */
export function useBitrateWarning(): BitrateWarningState {
  const [warning, setWarning] = useState<string | null>(null);

  const check = useCallback(async (file: File) => {
    setWarning(null);
    const kbps = await estimateBitrateKbps(file);
    if (kbps !== null && kbps > RECOMMENDED_MAX_BITRATE_KBPS) {
      setWarning(
        `This file is about ${kbps}kbps — bell clips only need ${RECOMMENDED_MAX_BITRATE_KBPS}kbps mono or less. Uploading anyway, but a smaller export leaves more room for future bells.`
      );
    }
  }, []);

  return { warning, check };
}
