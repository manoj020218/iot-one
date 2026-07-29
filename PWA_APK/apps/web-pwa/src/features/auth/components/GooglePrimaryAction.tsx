import { useMemo, useRef, useState } from "react";

import { isNativeShell } from "../nativeShell";

function GoogleMark() {
  return (
    <span aria-hidden="true" className="google-mark">
      <svg viewBox="0 0 24 24" width="18" height="18">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.42 3.58v3h3.91c2.29-2.11 3.53-5.22 3.53-8.82z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.91-3c-1.08.72-2.46 1.16-4.02 1.16-3.09 0-5.71-2.09-6.65-4.9H1.3v3.09C3.26 21.3 7.31 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.35 14.35c-.24-.72-.38-1.49-.38-2.35s.14-1.63.38-2.35V6.56H1.3A11.98 11.98 0 000 12c0 1.93.46 3.76 1.3 5.44z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.3 6.56l4.05 3.14c.94-2.81 3.56-4.95 6.65-4.95z"
        />
      </svg>
    </span>
  );
}

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
        <GoogleMark />
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
        <GoogleMark />
      </button>
    </div>
  );
}
