export function isNativeShell(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(
    (
      window as Window & {
        Capacitor?: unknown;
      }
    ).Capacitor
  );
}
