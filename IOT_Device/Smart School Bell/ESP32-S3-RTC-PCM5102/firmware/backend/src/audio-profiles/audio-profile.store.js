import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

export class AudioProfileStore {
  constructor(runtimeConfig) {
    this.filePath = runtimeConfig.profileStorePath;
  }

  async list() {
    return await this.#readAll();
  }

  async get(profileId) {
    const records = await this.#readAll();
    return records.find((record) => record.profileId === profileId) ?? null;
  }

  async save(record) {
    const records = await this.#readAll();
    const nextRecords = records.filter((current) => current.profileId !== record.profileId);
    nextRecords.push(record);
    await this.#writeAll(nextRecords);
    return record;
  }

  async delete(profileId) {
    const records = await this.#readAll();
    const nextRecords = records.filter((record) => record.profileId !== profileId);
    const changed = nextRecords.length !== records.length;
    if (changed) {
      await this.#writeAll(nextRecords);
    }
    return changed;
  }

  async #readAll() {
    await this.#ensureStore();

    const raw = await readFile(this.filePath, "utf8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  }

  async #writeAll(records) {
    await this.#ensureStore();
    const tempPath = `${this.filePath}.tmp`;
    await writeFile(tempPath, JSON.stringify(records, null, 2), "utf8");
    await rename(tempPath, this.filePath);
  }

  async #ensureStore() {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, "utf8");
    } catch {
      await writeFile(this.filePath, "[]", "utf8");
    }
  }
}
