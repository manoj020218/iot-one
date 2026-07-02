import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { PidEditorForm } from "./components/PidEditorForm";
import { PidPageShell } from "./components/PidPageShell";
import { createPid } from "./services/pidApi";
import { createEmptyPidDraft, validatePidDraft } from "./services/pidDraft";

export function PidCreatePage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState(createEmptyPidDraft);
  const [errors, setErrors] = useState<string[]>([]);

  async function handleSubmit() {
    const nextErrors = validatePidDraft(draft);
    setErrors(nextErrors);

    if (nextErrors.length > 0) {
      return;
    }

    try {
      const record = await createPid(draft);
      navigate(`/admin/developer/pid-management/${record.pid}`);
    } catch (submitError) {
      setErrors([
        submitError instanceof Error
          ? submitError.message
          : "Unable to create PID."
      ]);
    }
  }

  return (
    <PidPageShell
      title="Create PID"
      description="Register a new product identity before firmware, dashboard, OTA, Matter, or API work starts."
    >
      <PidEditorForm
        draft={draft}
        errors={errors}
        submitLabel="Create PID"
        onSubmit={handleSubmit}
        onDraftChange={(updater) => setDraft((current) => updater(current))}
      />
    </PidPageShell>
  );
}
