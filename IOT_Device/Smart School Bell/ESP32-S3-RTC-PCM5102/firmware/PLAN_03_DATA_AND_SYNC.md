# Plan 03: Data And Sync

Last updated: 2026-08-01

## Design Decision

The device runtime should consume normalized data, not the desktop app's live
database format directly. That keeps the appliance stable even if desktop
internals evolve.

## SD-Card Content Contract

The firmware expects these files on SD:
- `device.json`
- `schedules.json`
- `holidays.json`
- `sounds_manifest.json`
- `sounds/*.wav`
- `logs/runtime.log` created by firmware when possible

The first release should treat SD as the primary content source.

## Canonical Audio Format

To reduce decoder risk, first release audio is:
- `WAV`
- PCM
- `16-bit`
- `22050 Hz`
- `mono`

PCM5102 output remains stereo at hardware level by duplicating the mono stream
to left and right channels.

Bell audio storage rule:
- all school bell tones and melodies must live on SD only
- firmware flash must not be treated as the source for normal bell audio

## Device Config Model

`device.json` should carry:
- device name
- timezone
- Wi-Fi settings if used
- audio defaults such as volume
- sync metadata later

Missing optional fields should fall back to sane defaults.

## Schedule Model

Each normalized schedule entry should contain:
- stable entry id
- enabled flag
- `HH:MM` time
- day set
- sound id
- optional label

Device-side schedule rules:
- ignore malformed entries
- ignore disabled entries
- evaluate by local date and weekday
- suppress execution if current date is a holiday

## Holiday Model

Each holiday entry should contain:
- `YYYY-MM-DD` date
- name or reason
- enabled flag if future editing requires it

Device runtime only needs a fast set of active holiday dates.

## Sound Manifest Model

Each sound manifest entry should contain:
- stable sound id
- relative file path under `sounds/`
- display name
- expected format metadata if exported by desktop later

The schedule references `sound_id`, never raw filenames.

## Mapping From Current Jenix Project

The existing desktop project already owns:
- schedule creation
- holiday management
- sound library selection
- local server patterns on port `7288`

Firmware should not copy the desktop DB schema directly into runtime logic.
Instead, desktop should export a normalized device pack using stable JSON.

## Versioning

Every future export pack should include:
- schema version
- generated timestamp
- optional content checksum
- source application version

If schema version is unsupported, firmware must reject the pack safely.

## Sync Strategy

### Phase A: SD export/import

This is the first required path:
- desktop exports normalized JSON + WAV pack
- installer copies pack to SD
- firmware boots from SD only

This path is simplest, most serviceable, and least fragile for schools.

### Phase B: LAN pull sync

Later, firmware may pull from the existing desktop service:
- target remains LAN only
- desktop exposes normalized export endpoint
- firmware downloads metadata, validates integrity, then swaps atomically

LAN sync must never be required for bell operation.

### Phase C: cloud sync

Not a first-release concern.

## Atomic Update Rules

For any writable metadata:
- write to temp file first
- flush and close
- rename into place
- keep last known good runtime set until replacement succeeds

Half-written config must never become active.

## Network Contract Direction

When LAN sync is implemented later:
- firmware should prefer pull, not push
- desktop remains editor of truth
- firmware remains execution appliance
- status endpoint may stay on port `7288` for ecosystem consistency

## Failure Handling

If data is invalid:
- invalid device config uses defaults where safe
- invalid schedules are skipped and logged
- invalid holiday file disables holiday suppression only if explicitly allowed
- missing or invalid SD sound asset fails the ring request and is logged
- unsupported schema rejects the new pack and preserves old pack

## Export Responsibility

Desktop-side export work needed later:
- map existing schedule schema into normalized JSON
- map day encoding into explicit day lists
- include holiday date list
- copy only referenced sound assets
- optionally compute manifest checksums
