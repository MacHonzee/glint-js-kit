import TestService from "../test-service.js";
import mongoose from "mongoose";

async function main() {
  // stop mongo
  await TestService.stopMongo();

  // disconnect from mongo in mongoose connections
  await mongoose.disconnect();

  // and disconnect from mongo in glint-js connections
  const { MongoClient } = await import("glint-js");
  for (const connection of Object.values(MongoClient.connections)) {
    await connection.connection.close();
  }
}

export default main;
