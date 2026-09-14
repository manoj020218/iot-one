/**
 * Placeholder for the future paid/SaaS path (see the "minimum VPS use,
 * gated behind a default-off toggle" direction this plugin was built
 * under). No backend route for relaying bell control through the VPS
 * exists yet — DEVICE_INTEGRATION_GUIDE.md's public device routes only
 * cover generic state/commands, and School Bell has no module there.
 *
 * This file exists so the connection hook has one honest place to ask
 * "is cloud relay actually available" instead of pretending a working
 * network call — it always resolves false today. Wiring this up for real
 * is backend work, not something to fake from the client.
 */
export async function isCloudRelayAvailable(): Promise<boolean> {
  return false;
}
