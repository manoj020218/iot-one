export interface ValidationSummaryProps {
  errors: string[];
}

export function ValidationSummary({ errors }: ValidationSummaryProps) {
  if (!errors.length) {
    return null;
  }

  return (
    <section className="validation-card" role="alert">
      <h2>Validation Issues</h2>
      <ul>
        {errors.map((error) => (
          <li key={error}>{error}</li>
        ))}
      </ul>
    </section>
  );
}
