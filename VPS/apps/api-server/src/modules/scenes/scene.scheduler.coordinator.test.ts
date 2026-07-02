import { describe, expect, it } from "vitest";

import {
  createInMemorySceneSchedulerLeaseStore,
  createLeaseBasedSceneSchedulerCoordinator
} from "./scene.scheduler.coordinator";

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve
  };
}

describe("scene scheduler coordinator", () => {
  it("allows only one owner to execute while a lease is held", async () => {
    const leaseStore = createInMemorySceneSchedulerLeaseStore();
    const started = createDeferred<void>();
    const release = createDeferred<void>();
    const ownerOne = createLeaseBasedSceneSchedulerCoordinator({
      ownerId: "scheduler-owner-one",
      leaseMs: 60_000,
      leaseStore
    });
    const ownerTwo = createLeaseBasedSceneSchedulerCoordinator({
      ownerId: "scheduler-owner-two",
      leaseMs: 60_000,
      leaseStore
    });

    const firstExecution = ownerOne.runIfLeader(async () => {
      started.resolve();
      await release.promise;
      return "owner-one";
    });

    await started.promise;

    const secondExecution = await ownerTwo.runIfLeader(async () => "owner-two");

    expect(secondExecution.executed).toBe(false);

    release.resolve();

    await expect(firstExecution).resolves.toEqual({
      executed: true,
      value: "owner-one"
    });
  });
});
