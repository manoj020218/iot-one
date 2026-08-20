import { beforeEach, describe, expect, it } from "vitest";

import { resetDestinationStore } from "./destination.model";
import {
  createDestination,
  listDestinations,
  updateDestination,
  validateDestination
} from "./destination.service";
import { StreamerDestinationError } from "./destination.types";

const HOME_ID = "HOME-1";

beforeEach(async () => {
  await resetDestinationStore();
});

describe("createDestination", () => {
  it("rejects a non-RTMPS server URL", async () => {
    await expect(
      createDestination(HOME_ID, {
        platform: "youtube",
        displayName: "Main Channel",
        serverUrl: "http://not-rtmps.example"
      })
    ).rejects.toBeInstanceOf(StreamerDestinationError);
  });

  it("creates a destination and never exposes the stream key", async () => {
    const created = await createDestination(HOME_ID, {
      platform: "instagram",
      displayName: "Temple Live",
      serverUrl: "rtmps://live-upload.instagram.com:443",
      streamKey: "secret-key",
      credentialMode: "temporary"
    });

    expect((created as unknown as { streamKey?: string }).streamKey).toBeUndefined();
    expect(created.hasStreamKey).toBe(true);

    const list = await listDestinations(HOME_ID);
    expect(list).toHaveLength(1);
  });
});

describe("validateDestination", () => {
  it("fails validation when the credential has already expired", async () => {
    const created = await createDestination(HOME_ID, {
      platform: "instagram",
      displayName: "Temple Live",
      serverUrl: "rtmps://live-upload.instagram.com:443",
      streamKey: "secret-key",
      credentialExpiry: "2020-01-01T00:00:00Z"
    });

    const result = await validateDestination(created.destinationId, HOME_ID);

    expect(result.valid).toBe(false);
    expect(result.reasons).toContain("Credential has expired.");
  });

  it("passes and stamps lastValidatedAt when everything checks out", async () => {
    const created = await createDestination(HOME_ID, {
      platform: "youtube",
      displayName: "Main Channel",
      serverUrl: "rtmps://a.rtmps.youtube.com/live2",
      streamKey: "secret-key"
    });

    const result = await validateDestination(created.destinationId, HOME_ID);

    expect(result.valid).toBe(true);
    expect(result.lastValidatedAt).not.toBeNull();
  });
});

describe("updateDestination", () => {
  it("keeps the existing stream key when none is provided in the patch", async () => {
    const created = await createDestination(HOME_ID, {
      platform: "youtube",
      displayName: "Main Channel",
      serverUrl: "rtmps://a.rtmps.youtube.com/live2",
      streamKey: "secret-key"
    });

    const updated = await updateDestination(created.destinationId, HOME_ID, {
      displayName: "Main Channel (renamed)"
    });

    expect(updated.hasStreamKey).toBe(true);
    expect(updated.displayName).toBe("Main Channel (renamed)");
  });
});
