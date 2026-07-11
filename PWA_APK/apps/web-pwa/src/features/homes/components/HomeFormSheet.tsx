import { useEffect, useState } from "react";

import type { HomeUpsertInput } from "../services/homeApi";
import { homeTimezoneOptions } from "../constants/homeTimezones";
import { Sheet } from "../../../app/components/Sheet";

export interface HomeFormSheetProps {
  open: boolean;
  title: string;
  subtitle: string;
  initialValue?: HomeUpsertInput;
  submitting?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (value: HomeUpsertInput) => Promise<void> | void;
}

const defaultValue: HomeUpsertInput = {
  name: "",
  timezone: "Asia/Kolkata"
};

export function HomeFormSheet({
  open,
  title,
  subtitle,
  initialValue,
  submitting = false,
  error,
  onClose,
  onSubmit
}: HomeFormSheetProps) {
  const [form, setForm] = useState<HomeUpsertInput>(defaultValue);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [gpsMessage, setGpsMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm({
      ...defaultValue,
      ...initialValue
    });
    setGpsMessage(null);
  }, [initialValue, open]);

  function update<K extends keyof HomeUpsertInput>(key: K, value: HomeUpsertInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  function captureGps() {
    if (!navigator.geolocation) {
      setGpsMessage("Location is not available on this device.");
      return;
    }

    setGpsBusy(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        update("latitude", Number(position.coords.latitude.toFixed(6)));
        update("longitude", Number(position.coords.longitude.toFixed(6)));
        update("locationLabel", "Captured from device GPS");
        setGpsMessage("Current location captured.");
        setGpsBusy(false);
      },
      () => {
        setGpsMessage("Unable to capture GPS. You can continue without it.");
        setGpsBusy(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12_000
      }
    );
  }

  async function handleSubmit() {
    await onSubmit({
      ...form,
      name: form.name.trim()
    });
  }

  return (
    <Sheet
      open={open}
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      actions={
        <>
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className="primary-button"
            disabled={submitting || !form.name.trim()}
            onClick={() => void handleSubmit()}
            type="button"
          >
            {submitting ? "Saving..." : "Save Home"}
          </button>
        </>
      }
    >
      <div className="form-card">
        <label className="field">
          <span>Home Name</span>
          <input
            maxLength={48}
            onChange={(event) => update("name", event.target.value)}
            placeholder="Enter a home name"
            value={form.name}
          />
        </label>
        <label className="field">
          <span>Time Zone</span>
          <select
            onChange={(event) => update("timezone", event.target.value)}
            value={form.timezone ?? "Asia/Kolkata"}
          >
            {homeTimezoneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Location Label</span>
          <input
            onChange={(event) => update("locationLabel", event.target.value)}
            placeholder="Optional location"
            value={form.locationLabel ?? ""}
          />
        </label>
        <div className="button-row">
          <button className="secondary-button" onClick={captureGps} type="button">
            {gpsBusy ? "Capturing GPS..." : "Use Mobile GPS"}
          </button>
          {(form.latitude ?? form.longitude) !== undefined ? (
            <span className="hint-text">
              {form.latitude ?? "-"}, {form.longitude ?? "-"}
            </span>
          ) : null}
        </div>
        {gpsMessage ? <p className="hint-text">{gpsMessage}</p> : null}
        {error ? <p className="inline-error">{error}</p> : null}
      </div>
    </Sheet>
  );
}
