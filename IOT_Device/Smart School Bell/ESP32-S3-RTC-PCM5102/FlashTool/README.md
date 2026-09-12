# School Bell Flash Tool

Double-click `Launch Flash Tool.bat` to open the factory flash GUI, preselected
to School Bell (`JNX-SB-S3-01`).

This is a thin launcher only -- the actual tool is shared across products at
`IOT_Device/QRunlock/FlashTool/` (see that folder's own module docstrings).
It erases the chip, flashes `esp32-s3-schoolbell-prov`, and captures the
boot log for the BLE service name, PID, and Security Scheme 2 Proof-of-
Possession (printed by the shared `jenix_provisioning` component as a
`[FACTORY] ...` line every boot while unprovisioned). Records save to
`IOT_Device/QRunlock/FlashTool/records/` (gitignored -- they carry real
per-device secrets), same place every other product's records land.

Command line, if you'd rather not use the GUI:
```
cd "..\..\..\QRunlock\FlashTool"
python flash_tool.py flash --model-id JNX-SB-S3-01
```
