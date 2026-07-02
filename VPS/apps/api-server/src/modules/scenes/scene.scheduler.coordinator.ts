export const sceneSchedulerLockKey = "scene-runtime-scheduler";

export interface SceneSchedulerCoordinatorRunResult<T> {
  executed: boolean;
  value?: T;
}

export interface SceneSchedulerCoordinator {
  runIfLeader<T>(
    task: () => Promise<T>
  ): Promise<SceneSchedulerCoordinatorRunResult<T>>;
}

export interface SceneSchedulerLeaseStoreAcquireInput {
  lockKey: string;
  ownerId: string;
  now: Date;
  leasedUntil: Date;
}

export interface SceneSchedulerLeaseStoreReleaseInput {
  lockKey: string;
  ownerId: string;
  now: Date;
}

export interface SceneSchedulerLeaseStore {
  tryAcquire(input: SceneSchedulerLeaseStoreAcquireInput): Promise<boolean>;
  release(input: SceneSchedulerLeaseStoreReleaseInput): Promise<void>;
}

export interface LeaseBasedSceneSchedulerCoordinatorOptions {
  lockKey?: string;
  ownerId: string;
  leaseMs: number;
  now?: () => Date;
  leaseStore: SceneSchedulerLeaseStore;
}

interface InMemorySceneSchedulerLeaseRecord {
  ownerId: string;
  leasedUntilMs: number;
}

export function createLocalSceneSchedulerCoordinator(): SceneSchedulerCoordinator {
  return {
    async runIfLeader<T>(task: () => Promise<T>) {
      return {
        executed: true,
        value: await task()
      };
    }
  };
}

export function createLeaseBasedSceneSchedulerCoordinator(
  options: LeaseBasedSceneSchedulerCoordinatorOptions
): SceneSchedulerCoordinator {
  const lockKey = options.lockKey ?? sceneSchedulerLockKey;
  const now = options.now ?? (() => new Date());

  return {
    async runIfLeader<T>(
      task: () => Promise<T>
    ): Promise<SceneSchedulerCoordinatorRunResult<T>> {
      const acquiredAt = now();
      const acquired = await options.leaseStore.tryAcquire({
        lockKey,
        ownerId: options.ownerId,
        now: acquiredAt,
        leasedUntil: new Date(acquiredAt.getTime() + options.leaseMs)
      });

      if (!acquired) {
        return {
          executed: false
        };
      }

      try {
        return {
          executed: true,
          value: await task()
        };
      } finally {
        await options.leaseStore.release({
          lockKey,
          ownerId: options.ownerId,
          now: now()
        });
      }
    }
  };
}

export function createInMemorySceneSchedulerLeaseStore(
  seed = new Map<string, InMemorySceneSchedulerLeaseRecord>()
): SceneSchedulerLeaseStore {
  return {
    async tryAcquire(input) {
      const existing = seed.get(input.lockKey);

      if (
        existing &&
        existing.ownerId !== input.ownerId &&
        existing.leasedUntilMs > input.now.getTime()
      ) {
        return false;
      }

      seed.set(input.lockKey, {
        ownerId: input.ownerId,
        leasedUntilMs: input.leasedUntil.getTime()
      });

      return true;
    },
    async release(input) {
      const existing = seed.get(input.lockKey);

      if (!existing || existing.ownerId !== input.ownerId) {
        return;
      }

      seed.set(input.lockKey, {
        ownerId: input.ownerId,
        leasedUntilMs: input.now.getTime()
      });
    }
  };
}
