import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PidEditorForm } from "./components/PidEditorForm";
import { PidPageShell } from "./components/PidPageShell";
import { usePidRecord } from "./hooks/usePidRecord";
import { createDraftFromPid, validatePidDraft } from "./services/pidDraft";
import { updatePid } from "./services/pidApi";

export function PidEditPage() {
  const navigate = useNavigate();
  const { pid } = useParams();
  const { record, loading, error } = usePidRecord(pid);
  const [draft, setDraft] = useState(record ? createDraftFromPid(record) : null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (record) {
      setDraft(createDraftFromPid(record));
    }
  }, [record]);

  async function handleSubmit() {
    if (!draft || !pid) {
      return;
    }

    const nextErrors = validatePidDraft(draft);
    setErrors(nextErrors);

    if (nextErrors.length > 0) {
      return;
    }

    try {
      const updated = await updatePid(pid, draft);
      navigate(`/admin/developer/pid-management/${updated.pid}`);
    } catch (submitError) {
      setErrors([
        submitError instanceof Error
          ? submitError.message
          : "Unable to update PID."
      ]);
    }
  }

  return (
    <PidPageShell
      title={`Edit PID ${pid ?? ""}`}
      description="Draft PID records can be refined here before production approval locks the product identity."
    >
      {loading ? <section className="admin-card">Loading PID draft...</section> : null}
      {error ? <section className="validation-card">{error}</section> : null}
      {!loading && draft ? (
        <PidEditorForm
          draft={draft}
          errors={errors}
          submitLabel="Save PID Changes"
          onSubmit={handleSubmit}
          onDraftChange={(updater) => setDraft((current) => updater(current!))}
        />
      ) : null}
    </PidPageShell>
  );
}
