/**
 * Loosely typed on purpose for the skeleton phase — no page reads session
 * fields yet. Once real data-fetching lands, mirror the host's
 * AuthSession shape from @jenix/shared (this package intentionally has no
 * dependency on the platform repo, so it's a plain structural type here).
 */
export interface RemoteProductPackageProps {
  session: unknown;
  homeId: string;
}
