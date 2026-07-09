export interface ToggleSwitchProps {
  on: boolean;
  onToggle: () => void;
  label?: string;
}

/** Themed pill toggle used for pump / relay controls. */
export function ToggleSwitch({ on, onToggle, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      className={`jx-switch ${on ? "on" : ""}`}
      aria-pressed={on}
      aria-label={label ?? "toggle"}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
    />
  );
}
