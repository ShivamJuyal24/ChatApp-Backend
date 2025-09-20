// jest.setup.js
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

let mongoServer;

beforeAll(async () => {
  // Only create if not already connected
  if (mongoose.connection.readyState === 0) {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri, { dbName: "jest" });
  }

  // Optional: patch Group.isMember if your Group model doesn't have it.
  try {
    const { default: Group } = await import("./src/models/group.model.js");
    if (!Group.schema.methods.isMember) {
      Group.schema.methods.isMember = function (userId) {
        return this.members.some(
          (m) => m.user.toString() === userId.toString()
        );
      };
    }
  } catch (err) {
    // ignore if the model file path differs — tests will import models when needed
    console.log("Could not patch Group model:", err.message);
  }
});

afterEach(async () => {
  // Clear collections between tests
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
});