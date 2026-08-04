import { AppShell } from "@jenix/ui";
import { useState } from "react";
import { FiArrowLeft, FiPlus } from "react-icons/fi";
import { useNavigate } from "react-router-dom";

import { Sheet } from "../../app/components/Sheet";
import { useAuth } from "../auth/hooks/useAuth";
import { HomeFormSheet } from "../homes/components/HomeFormSheet";
import {
  createHome,
  listHomes,
  redeemHomeShareCode,
  type HomeUpsertInput
} from "../homes/services/homeApi";
import { HomeListRow } from "./components/HomeListRow";

export function HomeManagementPage() {
  const { session, replaceHomes } = useAuth();
  const navigate = useNavigate();

  if (!session) {
    throw new Error("HomeManagementPage requires an authenticated session");
  }

  const activeSession = session;
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  async function refreshHomes(activeHomeId?: string) {
    replaceHomes(await listHomes(activeSession), activeHomeId);
  }

  async function handleCreateHome(input: HomeUpsertInput) {
    setSaving(true);
    setError(null);

    try {
      const record = await createHome(activeSession, input);
      await refreshHomes(record.homeId);
      setFormOpen(false);
      navigate(`/settings/homes/${record.homeId}`);
    } catch (createError) {
      setError(
        createError instanceof Error ? createError.message : "Unable to create home."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleJoin() {
    setJoining(true);
    setJoinError(null);

    try {
      const result = await redeemHomeShareCode(activeSession, joinCode.trim());
      replaceHomes(result.homes, result.home.homeId);
      setJoinOpen(false);
      setJoinCode("");
      navigate(`/settings/homes/${result.home.homeId}`);
    } catch (joinErrorValue) {
      setJoinError(
        joinErrorValue instanceof Error ? joinErrorValue.message : "Unable to join home."
      );
    } finally {
      setJoining(false);
    }
  }

  return (
    <AppShell
      eyebrow="Settings"
      title="Home Management"
      aside={
        <button
          aria-label="Create home"
          className="devices-add-button"
          onClick={() => setFormOpen(true)}
          type="button"
        >
          <FiPlus size={20} />
        </button>
      }
    >
      <button className="editor-back" onClick={() => navigate("/settings")} type="button">
        <FiArrowLeft size={16} />
        Settings
      </button>

      <div style={{ display: "grid", gap: 10 }}>
        {activeSession.homes.map((home) => (
          <HomeListRow
            home={home}
            key={home.homeId}
            onClick={() => navigate(`/settings/homes/${home.homeId}`)}
          />
        ))}
      </div>

      <button
        className="text-button"
        onClick={() => setJoinOpen(true)}
        style={{ display: "block", margin: "16px auto 0" }}
        type="button"
      >
        Have an invitation code?
      </button>

      <HomeFormSheet
        error={error}
        onClose={() => setFormOpen(false)}
        onSubmit={handleCreateHome}
        open={formOpen}
        submitting={saving}
        subtitle="Save name, timezone, and optional location for this home."
        title="Create Home"
      />

      <Sheet
        actions={
          <>
            <button className="secondary-button" onClick={() => setJoinOpen(false)} type="button">
              Cancel
            </button>
            <button
              className="primary-button"
              disabled={joining || !joinCode.trim()}
              onClick={() => void handleJoin()}
              type="button"
            >
              {joining ? "Joining..." : "Join Home"}
            </button>
          </>
        }
        onClose={() => setJoinOpen(false)}
        open={joinOpen}
        subtitle="Enter the invitation code someone shared with you."
        title="Join a home"
      >
        <label className="field">
          <span>Invitation code</span>
          <input
            onChange={(event) => setJoinCode(event.target.value)}
            placeholder="JNX-XXXX-XXXX"
            value={joinCode}
          />
        </label>
        {joinError ? <p className="inline-error">{joinError}</p> : null}
      </Sheet>
    </AppShell>
  );
}
