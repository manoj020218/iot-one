#!/usr/bin/env python3
"""Factory flash tool - GUI.

Click-button version of flash_tool.py for a factory operator who doesn't
need to know the command line. Flashing runs on a background thread so the
window stays responsive; log output streams into the text box live.
"""

import queue
import threading
import tkinter as tk
from tkinter import messagebox, ttk

import serial.tools.list_ports

import flash_tool as ft


class FlashToolApp(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("QRunlock Factory Flash Tool")
        self.geometry("760x560")
        self.minsize(680, 480)

        self.log_queue = queue.Queue()
        self.busy = False

        self._build_widgets()
        self.refresh_models()
        self.refresh_ports()
        self.after(100, self._drain_log_queue)

    # -- layout -----------------------------------------------------

    def _build_widgets(self):
        top = ttk.Frame(self, padding=10)
        top.pack(fill="x")

        ttk.Label(top, text="Hardware model:").grid(row=0, column=0, sticky="w")
        self.model_var = tk.StringVar()
        self.model_combo = ttk.Combobox(top, textvariable=self.model_var,
                                         state="readonly", width=45)
        self.model_combo.grid(row=0, column=1, sticky="w", padx=5)
        ttk.Button(top, text="Register New Model...",
                   command=self.open_register_dialog).grid(row=0, column=2, padx=5)

        ttk.Label(top, text="Port:").grid(row=1, column=0, sticky="w", pady=(8, 0))
        self.port_var = tk.StringVar(value="(auto-detect)")
        self.port_combo = ttk.Combobox(top, textvariable=self.port_var, width=45)
        self.port_combo.grid(row=1, column=1, sticky="w", padx=5, pady=(8, 0))
        ttk.Button(top, text="Refresh Ports",
                   command=self.refresh_ports).grid(row=1, column=2, padx=5, pady=(8, 0))

        opts = ttk.Frame(self, padding=(10, 0))
        opts.pack(fill="x")
        self.skip_erase_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(opts, text="Skip erase (reuse existing NVS - not for real units)",
                         variable=self.skip_erase_var).pack(side="left")
        self.force_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(opts, text="Force (ignore VID:PID mismatch)",
                         variable=self.force_var).pack(side="left", padx=15)

        btns = ttk.Frame(self, padding=10)
        btns.pack(fill="x")
        self.flash_btn = ttk.Button(btns, text="Flash Device", command=self.start_flash)
        self.flash_btn.pack(side="left")
        self.status_var = tk.StringVar(value="Ready.")
        ttk.Label(btns, textvariable=self.status_var).pack(side="left", padx=15)

        result = ttk.LabelFrame(self, text="Last captured record", padding=10)
        result.pack(fill="x", padx=10, pady=(0, 10))
        self.result_var = tk.StringVar(value="(nothing flashed yet)")
        result_label = ttk.Label(result, textvariable=self.result_var, justify="left",
                                  font=("Consolas", 10))
        result_label.pack(anchor="w")

        log_frame = ttk.LabelFrame(self, text="Log", padding=5)
        log_frame.pack(fill="both", expand=True, padx=10, pady=(0, 10))
        self.log_text = tk.Text(log_frame, wrap="word", font=("Consolas", 9),
                                 state="disabled")
        scroll = ttk.Scrollbar(log_frame, command=self.log_text.yview)
        self.log_text.configure(yscrollcommand=scroll.set)
        self.log_text.pack(side="left", fill="both", expand=True)
        scroll.pack(side="right", fill="y")

    # -- data ---------------------------------------------------------

    def refresh_models(self):
        registry = ft.load_registry()
        ids = [m["model_id"] for m in registry["models"]]
        self.model_combo["values"] = ids
        if ids and not self.model_var.get():
            self.model_var.set(ids[0])

    def refresh_ports(self):
        ports = [p.device for p in serial.tools.list_ports.comports()]
        self.port_combo["values"] = ["(auto-detect)"] + ports
        if not self.port_var.get():
            self.port_var.set("(auto-detect)")

    # -- logging --------------------------------------------------------

    def log(self, line):
        # Called from the worker thread - just queue it, the Tk mainloop
        # thread is the only one allowed to touch widgets.
        self.log_queue.put(line)

    def _drain_log_queue(self):
        try:
            while True:
                line = self.log_queue.get_nowait()
                self.log_text.configure(state="normal")
                self.log_text.insert("end", str(line) + "\n")
                self.log_text.see("end")
                self.log_text.configure(state="disabled")
        except queue.Empty:
            pass
        self.after(100, self._drain_log_queue)

    # -- flash --------------------------------------------------------

    def start_flash(self):
        if self.busy:
            return
        model_id = self.model_var.get()
        if not model_id:
            messagebox.showerror("No model selected", "Register or select a hardware model first.")
            return

        port = self.port_var.get()
        if port == "(auto-detect)" or not port:
            port = None

        if not self.skip_erase_var.get():
            if not messagebox.askyesno(
                "Confirm full erase",
                "This will ERASE THE ENTIRE CHIP before flashing, wiping any "
                "existing Wi-Fi provisioning and generating a brand new PoP/token.\n\n"
                "Continue?"):
                return

        self.busy = True
        self.flash_btn.configure(state="disabled")
        self.status_var.set("Flashing...")
        self.result_var.set("(in progress)")
        self.log_text.configure(state="normal")
        self.log_text.delete("1.0", "end")
        self.log_text.configure(state="disabled")

        skip_erase = self.skip_erase_var.get()
        force = self.force_var.get()

        thread = threading.Thread(
            target=self._flash_worker,
            args=(model_id, port, skip_erase, force),
            daemon=True,
        )
        thread.start()

    def _flash_worker(self, model_id, port, skip_erase, force):
        try:
            record = ft.run_factory_flash(model_id, port=port, skip_erase=skip_erase,
                                           force=force, log=self.log)
        except ft.FlashError as exc:
            self.log(f"\nFAILED: {exc}")
            self.after(0, lambda: self._flash_done(None, str(exc)))
            return
        except Exception as exc:  # noqa: BLE001 - surface anything unexpected to the operator
            self.log(f"\nUNEXPECTED ERROR: {exc}")
            self.after(0, lambda: self._flash_done(None, str(exc)))
            return
        self.after(0, lambda: self._flash_done(record, None))

    def _flash_done(self, record, error):
        self.busy = False
        self.flash_btn.configure(state="normal")
        if error:
            self.status_var.set("Failed.")
            messagebox.showerror("Flash failed", error)
            return
        self.status_var.set("Done.")
        self.result_var.set(
            f"BLE name:        {record['ble_name']}\n"
            f"PID:             {record['pid']}\n"
            f"PoP username:    {record['pop_username']}\n"
            f"PoP:             {record['pop']}\n"
            f"Local API token: {record['local_api_token']}\n"
            f"Saved to:        {record['record_path']}"
        )

    # -- register model dialog -----------------------------------------

    def open_register_dialog(self):
        dialog = RegisterModelDialog(self)
        self.wait_window(dialog)
        self.refresh_models()


class RegisterModelDialog(tk.Toplevel):
    FIELDS = [
        ("model_id", "Model ID"),
        ("display_name", "Display name"),
        ("chip", "Chip (e.g. esp32c3, esp32s3)"),
        ("manufacturer", "Manufacturer"),
        ("board", "Board"),
        ("vid_pid", "USB VID:PID (e.g. 303A:1001)"),
        ("project_dir", "Project dir (relative to Flash Tool folder)"),
        ("pio_env", "PlatformIO env name"),
        ("notes", "Notes (optional)"),
    ]

    def __init__(self, parent):
        super().__init__(parent)
        self.title("Register New Hardware Model")
        self.resizable(False, False)
        self.vars = {}

        form = ttk.Frame(self, padding=15)
        form.pack(fill="both", expand=True)
        for row, (key, label) in enumerate(self.FIELDS):
            ttk.Label(form, text=label + ":").grid(row=row, column=0, sticky="w", pady=3)
            var = tk.StringVar()
            ttk.Entry(form, textvariable=var, width=45).grid(row=row, column=1, pady=3, padx=5)
            self.vars[key] = var

        btns = ttk.Frame(self, padding=(15, 0, 15, 15))
        btns.pack(fill="x")
        ttk.Button(btns, text="Cancel", command=self.destroy).pack(side="right")
        ttk.Button(btns, text="Register", command=self._on_register).pack(side="right", padx=8)

        self.transient(parent)
        self.grab_set()

    def _on_register(self):
        values = {k: v.get().strip() for k, v in self.vars.items()}
        required = [k for k, _ in self.FIELDS if k != "notes"]
        missing = [k for k in required if not values[k]]
        if missing:
            messagebox.showerror("Missing fields", f"Fill in: {', '.join(missing)}")
            return
        try:
            ft.register_model(
                values["model_id"], values["display_name"], values["chip"],
                values["manufacturer"], values["board"], values["vid_pid"],
                values["project_dir"], values["pio_env"], values["notes"],
            )
        except ft.FlashError as exc:
            messagebox.showerror("Registration failed", str(exc))
            return
        messagebox.showinfo("Registered", f"Registered model '{values['model_id']}'.")
        self.destroy()


if __name__ == "__main__":
    app = FlashToolApp()
    app.mainloop()
