import { useEffect, useRef, useState } from "react";
import type { AuthSession } from "@jenix/shared";

import {
  addRfRemote,
  cancelRfLearning,
  deleteRfRemote,
  getRfLearnStatus,
  listRfRemotes,
  renameRfRemote,
  startRfLearning,
  type RfRemoteRecord
} from "../services/qrunlockApi";

const RF_LEARN_POLL_MS = 1500;

export interface RfRemoteSetupScreenProps {
  session: AuthSession;
  deviceId: string;
  onBack: () => void;
  onToast: (message: string) => void;
}

export function RfRemoteSetupScreen({ session, deviceId, onBack, onToast }: RfRemoteSetupScreenProps) {
  const [remotes, setRemotes] = useState<RfRemoteRecord[] | null>(null);
  const [pairing, setPairing] = useState(false);
  const resolvedRef = useRef(false);

  useEffect(() => {
    let active = true;
    listRfRemotes(session, deviceId)
      .then((result) => {
        if (active) setRemotes(result);
      })
      .catch(() => {
        if (active) setRemotes([]);
      });
    return () => {
      active = false;
    };
  }, [session, deviceId]);

  async function refresh() {
    setRemotes(await listRfRemotes(session, deviceId).catch(() => []));
  }

  async function handleAddTap() {
    try {
      await startRfLearning(session, deviceId);
      resolvedRef.current = false;
      setPairing(true);
    } catch {
      onToast("Couldn't start RF-learn mode — check your connection");
    }
  }

  // Firmware now confirms a real pairing over MQTT (see
  // CloudBridgeService::PublishRfLearnResult / applyRfLearnResult on the
  // VPS side) instead of the platform only ever guessing "timeout" from
  // elapsed time. Poll while the pairing screen is open and auto-add the
  // moment the device itself reports success — the manual "I've paired it"
  // button stays as a fallback for a slow/dropped status poll, guarded by
  // resolvedRef so a race between the two never double-adds.
  useEffect(() => {
    if (!pairing) return;
    const interval = setInterval(() => {
      getRfLearnStatus(session, deviceId)
        .then((state) => {
          if (resolvedRef.current) return;
          if (state.status === "learned") {
            void finishPairing("Remote paired");
          } else if (state.status === "timeout") {
            resolvedRef.current = true;
            setPairing(false);
            onToast("No signal received — try again");
          } else if (state.status === "cancelled") {
            resolvedRef.current = true;
            setPairing(false);
          }
        })
        .catch(() => {
          // best-effort — the manual confirm button and the learn window's
          // own timeout both still apply if polling itself is failing
        });
    }, RF_LEARN_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairing, session, deviceId]);

  async function finishPairing(successMessage: string) {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    setPairing(false);
    try {
      const remote = await addRfRemote(session, deviceId);
      onToast(`${successMessage}: ${remote.name}`);
      await refresh();
    } catch {
      onToast("Couldn't save the new remote — try again");
    }
  }

  async function handleCancelPairing() {
    resolvedRef.current = true;
    setPairing(false);
    try {
      await cancelRfLearning(session, deviceId);
    } catch {
      // best-effort — the learn window will time out on its own either way
    }
  }

  async function handleRename(remote: RfRemoteRecord, name: string) {
    if (!name.trim() || name === remote.name) return;
    try {
      await renameRfRemote(session, deviceId, remote.remoteId, name.trim());
      onToast("Remote renamed");
    } catch {
      onToast("Couldn't rename — try again");
      await refresh();
    }
  }

  async function handleDelete(remote: RfRemoteRecord) {
    try {
      await deleteRfRemote(session, deviceId, remote.remoteId);
      onToast("Remote removed");
      await refresh();
    } catch {
      onToast("Couldn't remove — try again");
    }
  }

  return (
    <div className="qr-page">
      <div className="qr-sub-head">
        <button aria-label="Back" className="iconbtn" onClick={onBack} type="button">
          <svg fill="none" height="17" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" viewBox="0 0 24 24" width="17">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="titles" style={{ flex: 1 }}>
          <div className="nm">RF Remote Control</div>
        </div>
        <button className="qr-btn ghost" disabled={pairing} onClick={() => void handleAddTap()} type="button">
          ADD
        </button>
      </div>

      {!pairing ? (
        <div className="qr-card" style={{ marginBottom: 14 }}>
          {remotes === null ? (
            <div className="qr-empty">Loading…</div>
          ) : remotes.length === 0 ? (
            <div className="qr-empty">No remotes paired yet. Tap ADD to pair your first RF remote.</div>
          ) : (
            remotes.map((remote) => (
              <div className="qr-remote-item" key={remote.remoteId}>
                <span className="ic">
                  <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
                    <rect height="20" rx="2.5" width="10" x="7" y="2" />
                    <circle cx="12" cy="7" fill="currentColor" r="1.4" stroke="none" />
                    <line x1="9.5" x2="14.5" y1="12" y2="12" />
                    <line x1="9.5" x2="14.5" y1="15.5" y2="15.5" />
                  </svg>
                </span>
                <span className="nm-edit">
                  <input
                    defaultValue={remote.name}
                    onBlur={(event) => void handleRename(remote, event.target.value)}
                  />
                  <span className="sub">Paired &middot; tap name to rename</span>
                </span>
                <button aria-label="Remove remote" className="del" onClick={() => void handleDelete(remote)} type="button">
                  <svg fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="16">
                    <path d="M3 6h18" />
                    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="qr-rf-add-zone">
          <div className="qr-rf-pulse">
            <div className="ring" />
            <div className="ring" />
            <div className="core">
              <svg fill="none" height="30" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="30">
                <path d="M4 8a10 10 0 0 1 16 0" />
                <path d="M7 11a6 6 0 0 1 10 0" />
                <circle cx="12" cy="16" r="2" />
              </svg>
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 14.5 }}>Waiting for remote signal…</div>
          <p style={{ maxWidth: 260, margin: "8px auto 20px", fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
            Press and hold any button on the RF remote you want to pair. This closes on its own once the
            device confirms a signal — tap below only if that takes too long.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 260, margin: "0 auto" }}>
            <button className="qr-btn primary block" onClick={() => void finishPairing("Remote paired")} type="button">
              I&apos;ve paired it — Add
            </button>
            <button className="qr-btn ghost block" onClick={() => void handleCancelPairing()} type="button">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
