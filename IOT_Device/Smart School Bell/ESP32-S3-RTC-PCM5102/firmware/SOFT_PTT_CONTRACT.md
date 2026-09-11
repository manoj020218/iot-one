# Soft Push-to-Talk Contract (API 1.4)

Device endpoint: `ws://<device>/api/v1/announcement/ws`

## Audio and framing

- transport: one WebSocket per talk session
- audio: signed 16-bit little-endian PCM (`pcm_s16le`)
- sample rate: 22,050 Hz
- channels: mono
- recommended binary frame duration: 20-40 ms (882-1,764 bytes)
- maximum binary frame size: 4,096 bytes

The app must resample the phone microphone to this exact format. Compression is
deliberately omitted: the raw stream is about 352.8 kbit/s, which is small on a
local Wi-Fi link and avoids codec startup delay and firmware decoder state.

## Session sequence

1. Open the WebSocket.
2. Send this text frame:

   ```json
   {"type":"start","format":"pcm_s16le","sample_rate":22050,"channels":1}
   ```

3. Wait for `{"type":"ready",...}`.
4. Send microphone samples as binary frames while the talk control is held.
5. Send `{"type":"stop"}` and wait for `{"type":"stopped"}` before closing.

An invalid control message receives a text `error` frame. Binary audio sent
before `start` is rejected. Only one announcement source may be active: a soft
session is rejected while physical PTT is active, and vice versa. If frames
stop for 750 ms (including an abrupt disconnect), the device ends the session.

## Bell priority and latency

A scheduled or manual bell has priority. While the bell owns the PCM5102,
incoming live PCM frames are discarded; the app must continue sending current
microphone frames. Output resumes from the live point as soon as the bell ends.
This is the meaningful live-audio equivalent of pause/resume: old speech is not
buffered and replayed after the bell.

Target mouth-to-speaker latency is under 150 ms on a normal local Wi-Fi link:
20-40 ms capture frames, under 50 ms network/jitter allowance, and under 60 ms
device/output buffering. The current device implementation does not add a
jitter buffer, so the app should send frames at a steady cadence and should not
batch more than 40 ms in normal operation.

`GET /api/v1/status` and `GET /api/v1/announcement/status` expose
`audio.announcement_source`, `soft_ptt_active`, bell state and the common
collision policy.
