import { useState } from "react";
import type { TokenDispenserState } from "../types";

interface Props {
  state: TokenDispenserState;
  onRollReset: () => void;
  resetting: boolean;
}

function color(left: number) {
  if (left > 100) return "#16a34a";
  if (left > 50) return "#d97706";
  return "#dc2626";
}

function pct(left: number, total: number) {
  if (total <= 0) return 100;
  return Math.min(100, Math.round((left / total) * 100));
}

export function PaperRollCard({ state, onRollReset, resetting }: Props) {
  const [confirming, setConfirming] = useState(false);
  const total = state.estimatedTokensLeft + state.tokensPrintedSinceRollReset;
  const fillPct = pct(state.estimatedTokensLeft, total);
  const fillColor = color(state.estimatedTokensLeft);

  function handleClick() {
    if (!confirming) { setConfirming(true); return; }
    setConfirming(false);
    onRollReset();
  }

  return (
    <article className="scene-card">
      <p className="scene-card-kicker">Paper Roll</p>
      <h3 style={{ margin: 0 }}>~{state.estimatedTokensLeft} tokens left</h3>

      <div className="td-paper-bar-bg">
        <div
          className="td-paper-bar-fill"
          style={{ width: `${fillPct}%`, background: fillColor }}
        />
      </div>

      <p className="hint-text" style={{ color: fillColor, margin: 0 }}>
        {state.estimatedTokensLeft <= 50
          ? "⚠ Very low — load new roll now"
          : state.estimatedTokensLeft <= 100
          ? "Paper roll low. Keep new roll ready."
          : "Paper roll OK"}
      </p>

      <dl className="summary-grid">
        <div><dt>Printed This Roll</dt><dd>{state.tokensPrintedSinceRollReset}</dd></div>
        <div><dt>Estimated Left</dt><dd>{state.estimatedTokensLeft}</dd></div>
      </dl>

      <div className="button-row">
        {confirming ? (
          <>
            <button
              className="primary-button"
              onClick={handleClick}
              disabled={resetting}
            >
              {resetting ? "Resetting..." : "Confirm New Roll"}
            </button>
            <button className="secondary-button" onClick={() => setConfirming(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button className="secondary-button" onClick={handleClick}>
            New Roll Installed
          </button>
        )}
      </div>
    </article>
  );
}
