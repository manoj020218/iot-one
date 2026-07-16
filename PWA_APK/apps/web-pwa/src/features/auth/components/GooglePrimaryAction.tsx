import { useMemo, useRef, useState } from "react";

import { isNativeShell } from "../nativeShell";

export interface GooglePrimaryActionProps {
  busy?: boolean;
  onPress: () => Promise<void>;
}

const swipeThreshold = 0.72;
const trackWidth = 284;
const thumbWidth = 52;

export function GooglePrimaryAction({
  busy = false,
  onPress
}: GooglePrimaryActionProps) {
  const nativeShell = useMemo(() => isNativeShell(), []);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState(0);
  const draggingRef = useRef(false);
  const startXRef = useRef(0);
  const positionRef = useRef(0);
  const maxPosition = trackWidth - thumbWidth - 8;

  async function firePress() {
    if (busy) {
      return;
    }

    await onPress();
  }

  if (!nativeShell) {
    return (
      <button
        aria-label="Continue with Google"
        className="google-button"
        type="button"
        onClick={() => void firePress()}
      >
        <span aria-hidden="true" className="google-mark">G</span>
        <span>{busy ? "Connecting..." : "Continue with Google"}</span>
      </button>
    );
  }

  function updatePosition(next: number) {
    positionRef.current = next;
    setPosition(next);
  }

  function moveDrag(clientX: number) {
    if (!draggingRef.current || busy) {
      return;
    }

    const next = Math.max(0, Math.min(maxPosition, clientX - startXRef.current));
    updatePosition(next);
  }

  function finishDrag() {
    if (busy) {
      return;
    }

    if (positionRef.current >= maxPosition * swipeThreshold) {
      completeSwipe();
      return;
    }

    resetSwipe();
  }

  function completeSwipe() {
    draggingRef.current = false;
    setDragging(false);
    updatePosition(maxPosition);
    void firePress().finally(() => {
      setTimeout(() => updatePosition(0), 180);
    });
  }

  function resetSwipe() {
    draggingRef.current = false;
    setDragging(false);
    updatePosition(0);
  }

  return (
    <div
      className={`google-swipe${dragging ? " dragging" : ""}`}
      data-testid="google-swipe-track"
      onMouseMove={(event) => moveDrag(event.clientX)}
      onMouseUp={finishDrag}
      onPointerMove={(event) => moveDrag(event.clientX)}
      onPointerUp={finishDrag}
      onPointerLeave={() => {
        if (draggingRef.current && !busy) {
          resetSwipe();
        }
      }}
    >
      <span className="google-swipe-label">
        {busy ? "Connecting..." : "Swipe to continue with Google"}
      </span>
      <button
        aria-label="Swipe to continue with Google"
        className="google-swipe-thumb"
        data-testid="google-swipe-thumb"
        style={{ transform: `translateX(${position}px)` }}
        type="button"
        onMouseDown={(event) => {
          if (busy) {
            return;
          }

          draggingRef.current = true;
          setDragging(true);
          startXRef.current = event.clientX - positionRef.current;
        }}
        onPointerDown={(event) => {
          if (busy) {
            return;
        }

        draggingRef.current = true;
        setDragging(true);
        startXRef.current = event.clientX - positionRef.current;
      }}
      >
        <span aria-hidden="true" className="google-mark">G</span>
      </button>
    </div>
  );
}
