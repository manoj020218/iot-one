#!/usr/bin/env python3
"""Factory flash tool.

Hardware models (chip family, manufacturer, PlatformIO project/env) are
registered once via `register-model`. Flashing a unit always looks up its
model first, so the right firmware always goes on the right hardware.

Each factory flash does a full chip erase (required for a genuinely fresh
per-device Security Scheme 2 PoP and local API token to be generated -
skipping this silently reuses whatever was already in NVS from a previous
flash/test), then uploads, then captures the boot log directly over a raw
serial connection to pull out the PoP, the local API token, and the BLE
service name. The record is saved locally (this folder's own records/,
gitignored - it contains real per-device secrets) and, if VPS credentials
are configured, pushed there too over SCP into a root-only directory --
deliberately not a public HTTP endpoint, since these records carry each
device's own PoP and local API token. Separately, and also optionally, just
the PoP (not the local API token) is registered with the platform API so
the app can auto-fill it during BLE provisioning.

Usage:
    python flash_tool.py list-models
    python flash_tool.py register-model --model-id ID --display-name NAME \
        --chip esp32c3 --manufacturer NAME --board NAME \
        --vid-pid 303A:1001 --project-dir .. \
        --pio-env esp32-c3-supermini-prov2 [--notes TEXT] \
        [--vps-env-prefix TOKEN_DISPENSER] [--vps-dir /root/secrets/iot-one/...]
    python flash_tool.py flash --model-id ID [--port COM25] [--skip-erase]

VPS upload (all optional -- flashing still works and saves the local
record with none of these set). Each registered model has its own env var
prefix (default "QRUNLOCK", set at register-model time via --vps-env-prefix)
so multiple product families can each push to their own VPS directory
without sharing credentials:
    <PREFIX>_FACTORY_VPS_HOST      e.g. root@154.61.69.200
    <PREFIX>_FACTORY_VPS_PASSWORD  password for the above (never committed --
                                    set it in your own shell/profile, not here)
    <PREFIX>_FACTORY_VPS_DIR       remote directory (falls back to the
                                    model's own vps_dir_default, then to
                                    DEFAULT_VPS_DIR); created on first upload
                                    if it doesn't exist yet

Factory-record registration (also optional): POSTs just the deviceId/pid/PoP
(not the local API token) to the platform API so the app can auto-fill the
PoP during BLE provisioning instead of asking the installer to type it in.
    <PREFIX>_ADMIN_API_URL / JENIX_ADMIN_API_URL    e.g. https://api.iotsoft.in
    <PREFIX>_ADMIN_API_KEY / JENIX_ADMIN_API_KEY    only needed once the
                                    platform's ADMIN_API_KEY enforcement is
                                    turned on (see require-admin.ts)
"""

import argparse
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.error
import urllib.request

import serial.tools.list_ports

from capture import capture_boot_record, missing_fields

TOOL_DIR = os.path.dirname(os.path.abspath(__file__))
REGISTRY_PATH = os.path.join(TOOL_DIR, "hardware_models.json")
RECORDS_DIR = os.path.join(TOOL_DIR, "records")

DEFAULT_VPS_ENV_PREFIX = "QRUNLOCK"
DEFAULT_VPS_DIR = "/root/secrets/iot-one/qrunlock-factory-records"
# Same PuTTY suite the rest of this project's manual VPS access already
# uses -- checked on PATH first so this also works if pscp is installed
# some other way.
DEFAULT_PSCP_PATH = r"C:\Program Files\PuTTY\pscp.exe"
DEFAULT_PLINK_PATH = r"C:\Program Files\PuTTY\plink.exe"


def find_esptool():
    packages_dir = os.path.expanduser("~/.platformio/packages")
    candidates = sorted(glob.glob(os.path.join(packages_dir, "tool-esptoolpy*", "esptool.py")))
    if not candidates:
        return None
    # Prefer the unversioned/current package dir over an older pinned copy.
    for c in candidates:
        if "@" not in os.path.basename(os.path.dirname(c)):
            return c
    return candidates[0]


def lightweight_reset(esptool_path, chip, port):
    """Trigger a hard reset via esptool directly, without going through a
    full PlatformIO build/upload cycle. Much lower latency between the
    reset actually happening and this script being ready to read the
    resulting boot output, since there's no build system overhead."""
    cmd = [sys.executable, esptool_path, "--chip", chip, "--port", port,
           "--before", "default_reset", "--after", "hard_reset", "chip_id"]
    subprocess.run(cmd, cwd=TOOL_DIR, capture_output=True)


def load_registry():
    if not os.path.isfile(REGISTRY_PATH):
        return {"models": []}
    with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_registry(registry):
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(registry, f, indent=2)
        f.write("\n")


def find_model(registry, model_id):
    for model in registry["models"]:
        if model["model_id"] == model_id:
            return model
    return None


def cmd_list_models(args):
    registry = load_registry()
    if not registry["models"]:
        print("No hardware models registered yet.")
        return
    for model in registry["models"]:
        print(
            f"{model['model_id']:<20} {model['chip']:<10} "
            f"{model['manufacturer']} {model['board']} "
            f"(VID:PID={model['vid_pid']}, env={model['pio_env']})"
        )


def register_model(model_id, display_name, chip, manufacturer, board, vid_pid,
                    project_dir, pio_env, notes="", vps_env_prefix=None, vps_dir=None):
    registry = load_registry()
    if find_model(registry, model_id):
        raise FlashError(f"Model '{model_id}' is already registered. "
                          f"Remove it from {REGISTRY_PATH} first if you want to redefine it.")

    registry["models"].append({
        "model_id": model_id,
        "display_name": display_name,
        "chip": chip,
        "manufacturer": manufacturer,
        "board": board,
        "vid_pid": vid_pid.upper(),
        "project_dir": project_dir,
        "pio_env": pio_env,
        "notes": notes,
        "vps_env_prefix": vps_env_prefix or DEFAULT_VPS_ENV_PREFIX,
        "vps_dir_default": vps_dir or DEFAULT_VPS_DIR,
    })
    save_registry(registry)


def cmd_register_model(args):
    try:
        register_model(args.model_id, args.display_name, args.chip, args.manufacturer,
                        args.board, args.vid_pid, args.project_dir, args.pio_env,
                        args.notes, args.vps_env_prefix, args.vps_dir)
    except FlashError as exc:
        print(exc)
        sys.exit(1)
    print(f"Registered hardware model '{args.model_id}'.")


def get_source_info(project_dir):
    """Identify exactly what firmware source a flash will build from.

    Every unit's factory record should be traceable back to a real commit -
    otherwise "what firmware is on device X" is unanswerable later. Returns
    a dict with commit hash, dirty flag (and which files, if any), and a
    browser-openable URL to that commit when the remote is on GitHub.
    """
    def git(*args):
        result = subprocess.run(["git", "-C", project_dir, *args],
                                 capture_output=True, text=True)
        return result.stdout.strip() if result.returncode == 0 else None

    commit = git("rev-parse", "HEAD")
    if commit is None:
        return {"commit": None, "dirty": None, "dirty_files": [], "untracked_files": [],
                "source_url": None, "note": "not a git repository or git not available"}

    short_commit = git("rev-parse", "--short", "HEAD") or commit[:7]
    status = subprocess.run(["git", "-C", project_dir, "status", "--porcelain", "--", "."],
                             capture_output=True, text=True)
    # Untracked scratch files (bench outputs, serial logs, __pycache__) never
    # get compiled into firmware - only modified/staged TRACKED files change
    # what actually builds. Track them separately so junk in the working
    # directory doesn't block every real flash.
    dirty_files = []
    untracked_files = []
    for line in status.stdout.splitlines():
        if not line.strip():
            continue
        (untracked_files if line.startswith("??") else dirty_files).append(line[3:])

    remote = git("remote", "get-url", "origin") or ""
    source_url = None
    if "github.com" in remote:
        repo = remote.split("github.com")[-1].lstrip(":/").removesuffix(".git")
        source_url = f"https://github.com/{repo}/commit/{commit}"

    return {
        "commit": commit,
        "short_commit": short_commit,
        "dirty": len(dirty_files) > 0,
        "dirty_files": dirty_files,
        "untracked_files": untracked_files,
        "source_url": source_url,
    }


def detect_port(expected_vid_pid):
    matches = []
    for p in serial.tools.list_ports.comports():
        if p.vid is None or p.pid is None:
            continue
        vid_pid = f"{p.vid:04X}:{p.pid:04X}"
        if vid_pid == expected_vid_pid.upper():
            matches.append(p.device)
    return matches


class FlashError(Exception):
    pass


def run_pio(project_dir, pio_env, target, port, log):
    cmd = [
        "pio", "run",
        "-d", project_dir,
        "-e", pio_env,
        "-t", target,
        "--upload-port", port,
    ]
    log(f"$ {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=TOOL_DIR, stdout=subprocess.PIPE,
                             stderr=subprocess.STDOUT, text=True)
    for line in result.stdout.splitlines():
        log(line)
    if result.returncode != 0:
        raise FlashError(f"'{target}' failed (exit {result.returncode}).")


def run_factory_flash(model_id, port=None, skip_erase=False, force=False,
                       allow_dirty=False, log=print):
    """Erase, flash, and capture a factory record for one unit.

    Returns the factory_record dict on success. Raises FlashError with a
    human-readable message on any failure - callers (CLI or GUI) decide
    how to present that.
    """
    registry = load_registry()
    model = find_model(registry, model_id)
    if model is None:
        raise FlashError(f"No registered model '{model_id}'.")

    project_dir_early = os.path.normpath(os.path.join(TOOL_DIR, model["project_dir"]))
    source_info = get_source_info(project_dir_early)
    if source_info["commit"] is None:
        log(f"WARNING: {source_info['note']} - this build won't be traceable "
            f"to a commit.")
    else:
        log(f"Firmware source: {model['project_dir']} @ {source_info['short_commit']}")
        if source_info["source_url"]:
            log(f"  {source_info['source_url']}")
        if source_info["untracked_files"]:
            log(f"  ({len(source_info['untracked_files'])} untracked file(s) present, "
                f"not part of the build - not blocking)")
        if source_info["dirty"]:
            log(f"WARNING: working tree has {len(source_info['dirty_files'])} modified "
                f"tracked file(s) - this build will NOT match that commit:")
            for f in source_info["dirty_files"][:10]:
                log(f"  {f}")
            if not allow_dirty:
                raise FlashError(
                    "Refusing to flash from an uncommitted working tree - the "
                    "resulting unit's firmware wouldn't be traceable to a real "
                    "commit. Commit or stash the changes above, or pass "
                    "allow_dirty if this is deliberate (e.g. local testing).")

    if port is None:
        matches = detect_port(model["vid_pid"])
        if len(matches) == 1:
            port = matches[0]
            log(f"Auto-detected port {port} for VID:PID {model['vid_pid']}.")
        elif len(matches) == 0:
            raise FlashError(f"No connected device matches VID:PID {model['vid_pid']} "
                              f"for model '{model_id}'. Plug it in or pick a port.")
        else:
            raise FlashError(f"Multiple devices match VID:PID {model['vid_pid']}: "
                              f"{matches}. Pick one explicitly.")
    else:
        matches = detect_port(model["vid_pid"])
        if port not in matches:
            log(f"WARNING: {port} does not report VID:PID {model['vid_pid']} "
                f"expected for model '{model_id}'. Detected matching ports: "
                f"{matches or 'none'}.")
            if not force:
                raise FlashError("Refusing to flash a port that doesn't match the "
                                  "registered hardware model (override if you're sure).")

    project_dir = os.path.normpath(os.path.join(TOOL_DIR, model["project_dir"]))
    pio_env = model["pio_env"]

    if not skip_erase:
        log(f"\n== Erasing {port} (full chip erase - required for a fresh "
            f"PoP/token) ==")
        run_pio(project_dir, pio_env, "erase", port, log)
    else:
        log("\n== Skipping erase - PoP/token capture will reflect whatever is "
            "already in NVS, not a fresh generation. ==")

    log(f"\n== Flashing {model['model_id']} to {port} ==")
    run_pio(project_dir, pio_env, "upload", port, log)

    esptool_path = find_esptool()
    if esptool_path is None:
        raise FlashError("Could not locate a bundled esptool.py under "
                          "~/.platformio/packages - can't do a lightweight "
                          "reset for capture retries.")

    log("\n== Capturing boot log ==")
    record = {}
    raw_lines = []
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        got, lines = capture_boot_record(port)
        record.update(got)
        raw_lines.extend(lines)
        missing = missing_fields(record)
        if not missing:
            break
        log(f"Attempt {attempt}/{max_attempts}: still missing {missing}. "
            f"Triggering another reset and retrying...")
        if attempt < max_attempts:
            lightweight_reset(esptool_path, model["chip"], port)
    missing = missing_fields(record)
    if missing:
        log(f"\nGiving up after {max_attempts} attempts - still missing {missing}.")
        log("Raw captured lines:")
        for line in raw_lines:
            log(f"  {line}")
        raise FlashError(
            "The app is flashed and running - it just wasn't caught mid-boot. "
            "Retry capture alone (skip erase) without reflashing, or read the "
            "record from a serial monitor.")

    log(f"BLE name:        {record['ble_name']}")
    log(f"PID:             {record['pid']}")
    log(f"PoP username:    {record['username']}")
    log(f"PoP:             {record['pop']}")
    log(f"Local API token: {record['token']}")

    factory_record = {
        "model_id": model["model_id"],
        "captured_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "port": port,
        "ble_name": record["ble_name"],
        "pid": record["pid"],
        "pop_username": record["username"],
        "pop": record["pop"],
        "local_api_token": record["token"],
        "firmware_commit": source_info["commit"],
        "firmware_source_url": source_info["source_url"],
        "firmware_dirty": source_info["dirty"],
    }

    os.makedirs(RECORDS_DIR, exist_ok=True)
    safe_name = record["ble_name"].replace("/", "_")
    ts = time.strftime("%Y%m%d_%H%M%S")
    record_path = os.path.join(RECORDS_DIR, f"{safe_name}_{ts}.json")
    with open(record_path, "w", encoding="utf-8") as f:
        json.dump(factory_record, f, indent=2)
    log(f"\nSaved local record: {record_path}")
    factory_record["record_path"] = record_path

    upload_to_vps(record_path, model, log)
    register_factory_record_with_api(factory_record, model, log)
    return factory_record


def cmd_flash(args):
    try:
        run_factory_flash(args.model_id, port=args.port, skip_erase=args.skip_erase,
                           force=args.force, allow_dirty=args.allow_dirty, log=print)
    except FlashError as exc:
        print(f"\n{exc}")
        sys.exit(1)


def find_putty_tool(name, default_path):
    found = shutil.which(name)
    if found:
        return found
    if os.path.isfile(default_path):
        return default_path
    return None


def upload_to_vps(record_path, model, log=print):
    """Push one factory record file to the VPS over SCP, into a root-only
    directory -- never a public HTTP endpoint, since these records carry
    each device's own PoP and local API token. All env vars are optional;
    flashing already succeeded and saved the local record regardless of
    whether this step runs at all. Env var names are derived per-model
    (model["vps_env_prefix"], default "QRUNLOCK" for models registered
    before this field existed) so different product families can each push
    to their own VPS directory under their own credentials.
    """
    prefix = model.get("vps_env_prefix") or DEFAULT_VPS_ENV_PREFIX
    host_env = f"{prefix}_FACTORY_VPS_HOST"
    password_env = f"{prefix}_FACTORY_VPS_PASSWORD"
    dir_env = f"{prefix}_FACTORY_VPS_DIR"

    host = os.environ.get(host_env)
    if not host:
        log(f"{host_env} not set - skipping VPS upload "
            f"(local record is still saved).")
        return

    remote_dir = os.environ.get(
        dir_env, model.get("vps_dir_default") or DEFAULT_VPS_DIR
    )
    password = os.environ.get(password_env)
    pw_args = ["-pw", password] if password else []

    plink_path = find_putty_tool("plink", DEFAULT_PLINK_PATH)
    pscp_path = find_putty_tool("pscp", DEFAULT_PSCP_PATH)
    if pscp_path is None:
        log("pscp not found (checked PATH and the default PuTTY install "
            "dir) - skipping VPS upload. Install PuTTY or add pscp to "
            "PATH to enable this.")
        return

    if plink_path is not None:
        mkdir_result = subprocess.run(
            [plink_path, "-batch", *pw_args, host, f"mkdir -p {remote_dir}"],
            capture_output=True, text=True,
        )
        if mkdir_result.returncode != 0:
            log(f"Could not confirm/create {remote_dir} on the VPS "
                f"(continuing anyway - upload may still fail): "
                f"{mkdir_result.stderr.strip() or mkdir_result.stdout.strip()}")

    result = subprocess.run(
        [pscp_path, "-batch", *pw_args, record_path, f"{host}:{remote_dir}/"],
        capture_output=True, text=True,
    )
    if result.returncode == 0:
        log(f"Uploaded to VPS: {host}:{remote_dir}/{os.path.basename(record_path)}")
    else:
        log(f"VPS upload failed (local record is still saved): "
            f"{result.stderr.strip() or result.stdout.strip()}")


def device_id_from_factory_record(factory_record):
    """Mirrors the app's own derivation exactly (bleDiscoveryService.ts's
    deriveDeviceIdFromPid): the PID with its trailing "-NN" instance number
    stripped, "-", then the last 6 hex chars of the BLE name (same bytes the
    firmware's own ensureDeviceId() uses). Must never drift from that -- a
    mismatch here means the app looks up a PoP for a deviceId the backend
    never sees traffic from, same failure mode as the deviceId bug this
    whole factory-record feature was built alongside.
    """
    pid_prefix = re.sub(r"-\d+$", "", factory_record["pid"])
    mac_suffix = factory_record["ble_name"][-6:]
    return f"{pid_prefix}-{mac_suffix}"


def register_factory_record_with_api(factory_record, model, log=print):
    """POST the captured PoP to the platform so the app can auto-fill it
    during BLE provisioning instead of asking the installer to type it in
    (see VPS/apps/api-server/src/modules/factory-records). Optional, same
    as the SCP upload above -- flashing already succeeded regardless.
    """
    prefix = model.get("vps_env_prefix") or DEFAULT_VPS_ENV_PREFIX
    base_url = os.environ.get(f"{prefix}_ADMIN_API_URL") or os.environ.get(
        "JENIX_ADMIN_API_URL"
    )
    if not base_url:
        log(f"{prefix}_ADMIN_API_URL / JENIX_ADMIN_API_URL not set - "
            f"skipping factory-record registration (app will fall back to "
            f"asking the installer for this device's PoP).")
        return

    admin_key = os.environ.get(f"{prefix}_ADMIN_API_KEY") or os.environ.get(
        "JENIX_ADMIN_API_KEY"
    )
    device_id = device_id_from_factory_record(factory_record)
    body = json.dumps({
        "deviceId": device_id,
        "pid": factory_record["pid"],
        "proofOfPossession": factory_record["pop"],
    }).encode("utf-8")

    request = urllib.request.Request(
        base_url.rstrip("/") + "/api/v1/admin/factory-records",
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            **({"x-admin-key": admin_key} if admin_key else {}),
        },
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            response.read()
        log(f"Registered factory record with platform for deviceId={device_id}")
    except urllib.error.URLError as exc:
        log(f"Factory-record registration failed (local record is still "
            f"saved, app will fall back to manual PoP entry): {exc}")


def build_parser():
    parser = argparse.ArgumentParser(description=__doc__,
                                      formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("list-models", help="List registered hardware models.").set_defaults(func=cmd_list_models)

    p_register = sub.add_parser("register-model", help="Register a new hardware model.")
    p_register.add_argument("--model-id", required=True)
    p_register.add_argument("--display-name", required=True)
    p_register.add_argument("--chip", required=True, help="e.g. esp32c3, esp32s3")
    p_register.add_argument("--manufacturer", required=True)
    p_register.add_argument("--board", required=True)
    p_register.add_argument("--vid-pid", required=True, help="e.g. 303A:1001")
    p_register.add_argument("--project-dir", required=True,
                             help="Path to the PlatformIO project, relative to this tool's folder")
    p_register.add_argument("--pio-env", required=True)
    p_register.add_argument("--notes", default="")
    p_register.add_argument("--vps-env-prefix", default=None,
                             help=f"Env var prefix for VPS upload credentials "
                                  f"(default: {DEFAULT_VPS_ENV_PREFIX})")
    p_register.add_argument("--vps-dir", default=None,
                             help="Remote VPS directory for this model's factory "
                                  "records (default: shared qrunlock-factory-records)")
    p_register.set_defaults(func=cmd_register_model)

    p_flash = sub.add_parser("flash", help="Erase, flash, and capture a factory record for one unit.")
    p_flash.add_argument("--model-id", required=True)
    p_flash.add_argument("--port", default=None, help="Serial port; auto-detected if omitted")
    p_flash.add_argument("--skip-erase", action="store_true",
                          help="Skip the full chip erase (NOT recommended for real factory units)")
    p_flash.add_argument("--force", action="store_true",
                          help="Flash even if the port's VID:PID doesn't match the registered model")
    p_flash.add_argument("--allow-dirty", action="store_true",
                          help="Flash even with uncommitted changes in the project dir "
                               "(NOT recommended for real factory units - the result "
                               "won't be traceable to a commit)")
    p_flash.set_defaults(func=cmd_flash)

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
