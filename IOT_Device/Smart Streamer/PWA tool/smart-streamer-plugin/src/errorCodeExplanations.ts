/**
 * User-friendly text for the error codes defined in firmware/API_CONTRACT.md
 * §8 and VPS/API_CONTRACT.md §10. Streamer Plugin.txt §15 requires plain
 * explanations with the raw code available separately, not instead of it —
 * see the "Advanced Details" toggle in DeviceDiagnosticsPage.
 */
export const ERROR_CODE_EXPLANATIONS: Record<string, string> = {
  CAMERA_AUTH_FAILED: "Camera username or password was rejected.",
  CAMERA_TIMEOUT: "The camera did not respond within the expected time.",
  CAMERA_CODEC_UNSUPPORTED: "The camera's video codec isn't supported by this device.",
  CAMERA_NO_KEYFRAME: "No keyframe was received from the camera — check the stream is active.",
  AUDIO_CODEC_UNSUPPORTED: "The camera's audio codec can't be used or transcoded.",
  DESTINATION_CREDENTIAL_EXPIRED: "The destination's stream key or credentials have expired.",
  RTMP_HANDSHAKE_FAILED: "The connection to the streaming platform was rejected.",
  DEVICE_ALREADY_STREAMING: "This device already has an active stream.",
  SESSION_NOT_AUTHORIZED: "The server did not authorize this streaming session.",
  TIME_NOT_SYNCHRONIZED: "The device's clock isn't synchronized yet — this usually resolves itself shortly after startup.",
  TLS_CERTIFICATE_FAILED: "The device couldn't verify the server's security certificate.",
  SIGNATURE_INVALID: "The device's security credentials need to be re-provisioned.",
  CLOCK_SKEW: "The device's clock is out of sync with the server."
};

export function explainErrorCode(code: string | null): string {
  if (!code) {
    return "No recent errors.";
  }
  return ERROR_CODE_EXPLANATIONS[code] ?? "An unrecognized error occurred.";
}
