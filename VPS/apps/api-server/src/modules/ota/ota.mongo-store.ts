import type { Db } from "mongodb";

import type { OtaReleaseRecord } from "@jenix/shared";

import type {
  ClaimOtaDeliveryJobsInput,
  OtaDeliveryJobRepository,
  OtaRepository
} from "./ota.model";
import type { OtaDeliveryJob } from "./ota.types";

const otaReleaseCollectionName = "ota_releases";
const otaDeliveryJobCollectionName = "ota_delivery_jobs";

export async function createMongoOtaPersistenceStore(
  database: Db
): Promise<{
  releases: OtaRepository;
  deliveryJobs: OtaDeliveryJobRepository;
}> {
  const otaReleaseCollection =
    database.collection<OtaReleaseRecord>(otaReleaseCollectionName);
  const otaDeliveryJobCollection =
    database.collection<OtaDeliveryJob>(otaDeliveryJobCollectionName);

  await Promise.all([
    otaReleaseCollection.createIndex({ releaseId: 1 }, { unique: true }),
    otaReleaseCollection.createIndex({ pid: 1, hardwareRevision: 1, channel: 1, status: 1 }),
    otaReleaseCollection.createIndex({ pid: 1, version: 1 }),
    otaReleaseCollection.createIndex({ publishedAt: -1 }),
    otaDeliveryJobCollection.createIndex({ requestId: 1 }, { unique: true }),
    otaDeliveryJobCollection.createIndex({ deviceId: 1, requestedAt: 1 }),
    otaDeliveryJobCollection.createIndex({ status: 1, visibleAfter: 1, requestedAt: 1 })
  ]);

  async function claimOneDeliveryJob(
    input: ClaimOtaDeliveryJobsInput
  ): Promise<OtaDeliveryJob | undefined> {
    const leaseExpiry = new Date(
      new Date(input.now).getTime() + input.visibilityTimeoutMs
    ).toISOString();

    const claimed = await otaDeliveryJobCollection.findOneAndUpdate(
      {
        $or: [
          {
            status: "queued",
            $or: [
              {
                visibleAfter: {
                  $exists: false
                }
              },
              {
                visibleAfter: {
                  $lte: input.now
                }
              }
            ]
          },
          {
            status: "processing",
            visibleAfter: {
              $lte: input.now
            }
          },
          {
            status: "dispatched",
            visibleAfter: {
              $lte: input.now
            }
          }
        ]
      },
      {
        $set: {
          status: "processing",
          processingWorkerId: input.workerId,
          processingStartedAt: input.now,
          visibleAfter: leaseExpiry
        },
        $inc: {
          attemptCount: 1
        }
      },
      {
        sort: {
          requestedAt: 1,
          requestId: 1
        },
        returnDocument: "after"
      }
    );

    return claimed ?? undefined;
  }

  return {
    releases: {
      async list() {
        return otaReleaseCollection.find({}).toArray();
      },
      async get(releaseId) {
        return (
          await otaReleaseCollection.findOne({
            releaseId
          })
        ) ?? undefined;
      },
      async save(record) {
        await otaReleaseCollection.replaceOne(
          { releaseId: record.releaseId },
          record,
          {
            upsert: true
          }
        );

        return record;
      },
      async reset() {
        await otaReleaseCollection.deleteMany({});
      }
    },
    deliveryJobs: {
      async get(requestId) {
        return (
          await otaDeliveryJobCollection.findOne({
            requestId
          })
        ) ?? undefined;
      },
      async listByDevice(deviceId) {
        return otaDeliveryJobCollection
          .find({ deviceId })
          .sort({ requestedAt: 1, requestId: 1 })
          .toArray();
      },
      async listAll() {
        return otaDeliveryJobCollection
          .find({})
          .sort({ requestedAt: 1, requestId: 1 })
          .toArray();
      },
      async enqueue(job) {
        await otaDeliveryJobCollection.insertOne(job);
        return job;
      },
      async claimNextBatch(input) {
        const claimedEntries: OtaDeliveryJob[] = [];

        for (let index = 0; index < input.limit; index += 1) {
          const claimed = await claimOneDeliveryJob(input);

          if (!claimed) {
            break;
          }

          claimedEntries.push(claimed);
        }

        return claimedEntries;
      },
      async markDispatched(requestId, dispatchedAt, visibleAfter) {
        await otaDeliveryJobCollection.updateOne(
          { requestId },
          {
            $set: {
              status: "dispatched",
              dispatchedAt,
              visibleAfter
            },
            $unset: {
              completedAt: "",
              failedAt: "",
              acknowledgedAt: "",
              lastError: ""
            }
          }
        );
      },
      async complete(requestId, completedAt, acknowledgedAt) {
        await otaDeliveryJobCollection.updateOne(
          { requestId },
          {
            $set: {
              status: "completed",
              completedAt,
              ...(acknowledgedAt ? { acknowledgedAt } : {})
            },
            $unset: {
              visibleAfter: "",
              lastError: ""
            }
          }
        );
      },
      async fail(requestId, failedAt, errorMessage) {
        await otaDeliveryJobCollection.updateOne(
          { requestId },
          {
            $set: {
              status: "failed",
              failedAt,
              lastError: errorMessage
            },
            $unset: {
              visibleAfter: ""
            }
          }
        );
      },
      async reset() {
        await otaDeliveryJobCollection.deleteMany({});
      }
    }
  };
}
