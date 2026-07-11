import type { PropsWithChildren, ReactNode } from "react";

export interface SheetProps extends PropsWithChildren {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  actions?: ReactNode;
}

export function Sheet({
  open,
  title,
  subtitle,
  onClose,
  actions,
  children
}: SheetProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button className="sheet-scrim" aria-label="Close panel" onClick={onClose} />
      <section className="sheet-panel" aria-modal="true" role="dialog">
        <header className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <button className="secondary-button sheet-close" onClick={onClose} type="button">
            Close
          </button>
        </header>
        <div className="sheet-body">{children}</div>
        {actions ? <footer className="sheet-actions">{actions}</footer> : null}
      </section>
    </>
  );
}
