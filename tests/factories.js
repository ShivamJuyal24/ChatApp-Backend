// tests/factories.js
import mongoose from "mongoose";
import User from "../src/models/User.model.js";
import Group from "../src/models/group.model.js";

let userCounter = 0;

// Create a user with unique identifiers
export async function createUser(overrides = {}) {
  userCounter++;
  const uniqueId = `${Date.now()}_${userCounter}_${Math.random().toString(36).substr(2, 9)}`;
  
  const user = new User({
    username: `user_${uniqueId}`,
    email: `user_${uniqueId}@test.com`,
    password: "password123", // make sure User schema hashes or accepts plain in test
    ...overrides
  });
  await user.save();
  return user;
}

// Create a group with required admin + members
export async function createGroup(memberIds) {
  if (!memberIds || memberIds.length === 0) {
    throw new Error("At least one member required to create group");
  }

  const adminId = memberIds[0]; // first member as admin
  const groupCounter = userCounter++;
  const uniqueId = `${Date.now()}_${groupCounter}_${Math.random().toString(36).substr(2, 9)}`;
  
  return Group.create({
    name: `Test Group ${uniqueId}`,
    admin: adminId,
    members: memberIds.map((id) => ({
      user: new mongoose.Types.ObjectId(id),
      role: id.toString() === adminId.toString() ? "admin" : "member"
    }))
  });
}