import { useRef, type MouseEvent } from "react";

/**
 * Tuya-style "tap opens it, long-press acts on it" gesture, shared across
 * every home-grid tile type. Implemented as pointer-down/up timing plus a
 * capture-phase click guard rather than a synthetic "onLongPress" prop on
 * each tile component -- the tiles already own a plain onClick={onOpen}
 * internally, and capturing the click before it reaches them is the only
 * way to suppress that open when the hold fires, without changing every
 * tile's prop contract.
 *
 * Usage: spread the returned handlers onto a wrapper element around the
 * tile (not the tile's own root), e.g. `<div {...useLongPressGuard(fn)}>
 * <SomeHomeTile onOpen={...} /></div>`.
 */
export function useLongPressGuard(onLongPress: () => void, delayMs = 550) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const firedRef = useRef(false);

  function start() {
    firedRef.current = false;
    timerRef.current = setTimeout(() => {
      firedRef.current = true;
      onLongPress();
    }, delayMs);
  }

  function cancel() {
    clearTimeout(timerRef.current);
  }

  return {
    onPointerDown: start,
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onClickCapture: (event: MouseEvent) => {
      if (firedRef.current) {
        event.stopPropagation();
        firedRef.current = false;
      }
    }
  };
}
