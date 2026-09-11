# School Bell Media Backend

Node backend for the ESP32 school-bell firmware. This service turns mixed input
sources into plain HTTP WAV endpoints that the firmware can consume through the
new audio-profile support.

It is intentionally self-contained:
- no external npm package install is required just to run the API or tests
- source metadata is persisted to `backend/data/audio-profiles.json`
- microphone/app uploads are stored under `backend/data/mic-channels/`

## What It Supports

Input profile types:
- `youtube`
- `url`
- `vps`
- `file`
- `sip`
- `rtp`
- `browser-mic`
- `app-mic`

Firmware delivery format:
- WAV only
- PCM 16-bit via `ffmpeg`
- mono
- 22050 Hz by default

Backend behavior by source:
- `url` and `vps`: `ffmpeg` pulls the remote stream/file and normalizes it
- `file`: `ffmpeg` normalizes a local file such as MP3, WAV, OGG, AAC, M4A
- `youtube`: `yt-dlp` fetches audio and pipes it to `ffmpeg`
- `rtp`: `ffmpeg` reads `rtp://...` or an SDP file path
- `sip`: direct `ffmpeg -i sip:...` can be attempted, but the safer path is to
  provide `bridgeCommand` and `bridgeArgs` so an external SIP client or PBX
  helper emits audio to stdout and Node pipes that through `ffmpeg`
- `browser-mic` and `app-mic`: upload audio to a mic channel, then expose it
  as a firmware-ready WAV stream

## Runtime Prerequisites

- Node.js 20+
- `ffmpeg` in `PATH`, or set `FFMPEG_BIN`
- `yt-dlp` in `PATH` for YouTube sources, or set `YT_DLP_BIN`

## Run

```powershell
cd "D:\IOT Device\IOT_Platform\jenix One\IOT_Device\Smart School Bell\ESP32-S3-RTC-PCM5102\firmware\backend"
npm start
```

Environment variables:
- `PORT`
- `PUBLIC_BASE_URL`
- `DATA_DIR`
- `FFMPEG_BIN`
- `YT_DLP_BIN`
- `MAX_UPLOAD_BYTES`

## API

### Health

`GET /health`

Returns runtime metadata and whether `ffmpeg` / `yt-dlp` are visible.

### Audio Profiles

`GET /api/audio-profiles`

`POST /api/audio-profiles`

`GET /api/audio-profiles/:profileId`

`PATCH /api/audio-profiles/:profileId`

`DELETE /api/audio-profiles/:profileId`

Create payload example for YouTube:

```json
{
  "name": "Morning Prayer From YouTube",
  "sourceType": "youtube",
  "enabled": true,
  "input": {
    "youtubeUrl": "https://www.youtube.com/watch?v=example"
  }
}
```

Create payload example for VPS/URL:

```json
{
  "name": "VPS Live Bell",
  "sourceType": "vps",
  "input": {
    "url": "https://media.example.com/live-bell.mp3"
  }
}
```

Create payload example for RTP:

```json
{
  "name": "Campus RTP Feed",
  "sourceType": "rtp",
  "input": {
    "rtpUrl": "rtp://239.1.1.20:5004"
  }
}
```

Create payload example for SIP with external bridge:

```json
{
  "name": "PBX Paging Feed",
  "sourceType": "sip",
  "input": {
    "sipUri": "sip:7001@pbx.local",
    "bridgeCommand": "baresip",
    "bridgeArgs": ["-f", "C:/baresip", "-e", "/dial sip:7001@pbx.local"]
  }
}
```

### Firmware Manifest Helper

`GET /api/audio-profiles/:profileId/firmware-manifest?soundId=school&durationSeconds=8`

Returns a manifest snippet that can be copied into the firmware-side
`sounds_manifest.json`. The backend always emits an HTTP WAV endpoint because
that is what the firmware understands.

### Mic Upload

`PUT /api/mic-channels/:channelId/upload`

Send raw request body with an audio content type such as `audio/wav`,
`audio/mpeg`, `audio/webm`, or `audio/ogg`.

Example:

```powershell
curl.exe -X PUT `
  -H "Content-Type: audio/webm" `
  --data-binary "@D:\captures\latest-mic.webm" `
  http://127.0.0.1:4180/api/mic-channels/principal-desk/upload
```

Then create a profile:

```json
{
  "name": "Principal Desk Mic",
  "sourceType": "browser-mic",
  "input": {
    "micChannelId": "principal-desk"
  }
}
```

### Stream Endpoint

`GET /streams/:profileId.wav`

This is the firmware-facing endpoint. The ESP32 firmware should use this URL as
the audio profile endpoint.

## Tests

```powershell
npm test
```
