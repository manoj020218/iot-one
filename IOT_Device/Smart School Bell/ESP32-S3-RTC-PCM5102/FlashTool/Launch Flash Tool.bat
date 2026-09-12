@echo off
rem Thin per-device launcher for the shared Jenix Factory Flash Tool -- the
rem real tool (flash_tool.py / gui.py / capture.py / hardware_models.json)
rem lives in IOT_Device/QRunlock/FlashTool/ (PROVISIONING.md Section 8a: one
rem shared implementation, not a per-device copy, same reasoning as the
rem jenix_provisioning firmware component). This just opens it preselected
rem to School Bell's model_id.
cd /d "%~dp0..\..\..\QRunlock\FlashTool"
where pythonw >nul 2>nul
if %errorlevel%==0 (
    start "" pythonw gui.py JNX-SB-S3-01
) else (
    start "" python gui.py JNX-SB-S3-01
)
