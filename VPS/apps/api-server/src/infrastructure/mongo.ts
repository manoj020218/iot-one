import { MongoClient, type Db } from "mongodb";

let mongoClientPromise: Promise<MongoClient> | null = null;

export async function getMongoClient(mongodbUri: string): Promise<MongoClient> {
  if (!mongoClientPromise) {
    const client = new MongoClient(mongodbUri);
    mongoClientPromise = client.connect();
  }

  return mongoClientPromise;
}

export async function getMongoDb(mongodbUri: string): Promise<Db> {
  const client = await getMongoClient(mongodbUri);
  return client.db();
}

export async function closeMongoClient() {
  if (!mongoClientPromise) {
    return;
  }

  const client = await mongoClientPromise;
  mongoClientPromise = null;
  await client.close();
}
