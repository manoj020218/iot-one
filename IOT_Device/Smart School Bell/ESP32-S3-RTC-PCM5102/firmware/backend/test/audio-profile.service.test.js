import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { AudioProfileService } from "../src/audio-profiles/audio-profile.service.js";
import { createRuntimeConfig } from "../src/config.js";

function makeRequestStub(baseUrl) {
  return {
    headers: {
      host: baseUrl.replace(/^https?:\/\//, "")
    }
  };
}

test("AudioProfileService creates, updates, lists and builds firmware manifest", async () => {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), "school-bell-media-backend-"));
  try {
    const runtimeConfig = createRuntimeConfig({
      dataDir: tempDir,
      publicBaseUrl: "http://127.0.0.1:4180"
    });
    const service = new AudioProfileService(runtimeConfig);

    const created = await service.createProfile({
      name: "Morning Bell",
      sourceType: "url",
      input: {
        url: "https://media.example.com/morning.mp3"
      }
    });

    assert.match(created.profileId, /^APR-/);
    assert.equal(created.output.format, "wav");

    const updated = await service.updateProfile(created.profileId, {
      notes: "Main assembly bell",
      output: {
        extraOutputArgs: ["-af", "volume=1.2"]
      }
    });

    assert.equal(updated.notes, "Main assembly bell");
    assert.deepEqual(updated.output.extraOutputArgs, ["-af", "volume=1.2"]);

    const list = await service.listProfiles();
    assert.equal(list.length, 1);

    const manifest = await service.buildFirmwareManifest(
      created.profileId,
      makeRequestStub("http://127.0.0.1:4180"),
      { soundId: "school", durationSeconds: "8" }
    );

    assert.equal(manifest.manifest.profiles[created.profileId].endpoint, `http://127.0.0.1:4180/streams/${created.profileId}.wav`);
    assert.equal(manifest.manifest.sounds.school.duration, 8);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
});
