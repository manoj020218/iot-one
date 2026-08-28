/**
 * Build-time replacement for "react/jsx-runtime" -- companion to
 * reactHostShim.ts. The real npm "react/jsx-runtime" package reads
 * React's internal __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED
 * shape off whatever "react" module it resolves, which reactHostShim.ts
 * doesn't (and shouldn't) replicate -- confirmed on real hardware as
 * "Cannot read properties of undefined (reading 'ReactCurrentOwner')".
 * Implementing jsx/jsxs directly on top of the host's createElement
 * sidesteps that shape entirely; this is the standard technique for a
 * custom JSX runtime, not a workaround.
 */
const host = typeof window !== "undefined" ? window.__JENIX_DEVICE_PACKAGE_HOST__ : undefined;

if (!host) {
  throw new Error(
    "Device package host runtime is not initialized -- this bundle must be loaded as a remote package, not run standalone."
  );
}

const HostReact = host.React;

export const Fragment = HostReact.Fragment;

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- untyped JSX-runtime plumbing, not application code
export function jsx(type: any, config: Record<string, unknown>, maybeKey?: unknown) {
  const props: Record<string, unknown> = { ...config };
  if (maybeKey !== undefined) {
    props.key = String(maybeKey);
  }
  const { children, ...rest } = props;
  return children === undefined
    ? HostReact.createElement(type, rest)
    : HostReact.createElement(type, rest, children as never);
}

export const jsxs = jsx;
