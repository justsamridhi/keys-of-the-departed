import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config({ path: "server/.env" });

async function testAtlas() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in server/.env");
    return;
  }
  console.log("Connecting to MongoDB Atlas at:", uri.replace(/\/\/.*@/, "//*@"));
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 8000,
    connectTimeoutMS: 8000,
    tls: true,
  });
  try {
    await client.connect();
    const ping = await client.db().command({ ping: 1 });
    console.log("Atlas ping response:", ping);
    const collections = await client.db().listCollections().toArray();
    console.log(
      "Existing collections:",
      collections.map((c) => c.name),
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Atlas connection error:", msg);
  } finally {
    await client.close();
  }
}

testAtlas();
