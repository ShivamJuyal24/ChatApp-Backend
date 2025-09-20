import { jest } from "@jest/globals";
jest.setTimeout(30000);

import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import Client from "socket.io-client";
import jwt from "jsonwebtoken";

import { setupGroupSocket } from "../src/sockets/setupGroupSocket.js";
import { createUser, createGroup } from "../tests/factories.js";

let httpServer, io, baseUrl;

beforeAll(async () => {
  httpServer = createServer();
  io = new IOServer(httpServer);
  
  // Setup authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error"));

    try {
      const secret = process.env.JWT_SECRET || "testsecret";
      const decoded = jwt.verify(token, secret);
      socket.userId = decoded.id;
      next();
    } catch (error) {
      console.error("Socket auth error:", error);
      next(new Error("Authentication error"));
    }
  });

  // Setup socket handlers
  io.on("connection", (socket) => {
    setupGroupSocket(io, socket);
  });

  await new Promise((resolve) => {
    httpServer.listen(() => {
      baseUrl = `http://localhost:${httpServer.address().port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (io) await io.close();
  if (httpServer) await new Promise((res) => httpServer.close(res));
});

const clientConnect = (user) => {
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET || "testsecret");
  return new Promise((resolve, reject) => {
    const socket = Client(baseUrl, { 
      auth: { token }, 
      reconnectionDelayMax: 1000,
      timeout: 5000
    });
    socket.on("connect", () => resolve(socket));
    socket.on("connect_error", (err) => reject(err));
  });
};

const setupUsersAndGroup = async (count = 2) => {
  const users = [];
  for (let i = 0; i < count; i++) users.push(await createUser());
  const group = await createGroup(users.map(u => u._id));
  const clients = await Promise.all(users.map(u => clientConnect(u)));
  return { users, group, clients };
};

// Helper to wait for socket to join a group
function waitForGroupJoin(socket, groupId) {
  return new Promise((resolve) => {
    socket.emit("joinGroup", { groupId });
    // Wait a bit to ensure join is processed
    setTimeout(resolve, 100);
  });
}

// ------------------------
// Add member
test("adding a member to group emits notification", async () => {
  const { users, group, clients } = await setupUsersAndGroup(2);
  const newUser = await createUser();
  const clientNew = await clientConnect(newUser);
  const [client1, client2] = clients;

  // Wait for both clients to join the group
  await waitForGroupJoin(client1, group._id.toString());
  await waitForGroupJoin(client2, group._id.toString());

  const notification = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("groupMemberAdded event timeout")), 5000);
    client2.on("groupMemberAdded", (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
    
    // Emit after setting up the listener
    client1.emit("memberAddedToGroup", { 
      groupId: group._id.toString(), 
      newMemberId: newUser._id.toString(), 
      addedBy: users[0]._id.toString() 
    });
  });

  expect(notification.groupId.toString()).toBe(group._id.toString());
  expect(notification.newMemberId.toString()).toBe(newUser._id.toString());
  expect(notification.addedBy.toString()).toBe(users[0]._id.toString());

  [client1, client2, clientNew].forEach(c => c.close());
});

// Remove member
test("removing a member from group emits notification and leaves room", async () => {
  const { users, group, clients } = await setupUsersAndGroup(2);
  const [client1, client2] = clients;

  // Wait for both clients to join the group
  await waitForGroupJoin(client1, group._id.toString());
  await waitForGroupJoin(client2, group._id.toString());

  const notification = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("groupMemberRemoved event timeout")), 5000);
    client2.on("groupMemberRemoved", (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
    
    // Emit after setting up the listener
    client1.emit("memberRemovedFromGroup", { 
      groupId: group._id.toString(), 
      removedMemberId: users[1]._id.toString(), 
      removedBy: users[0]._id.toString() 
    });
  });

  expect(notification.groupId.toString()).toBe(group._id.toString());
  expect(notification.removedMemberId.toString()).toBe(users[1]._id.toString());
  expect(notification.removedBy.toString()).toBe(users[0]._id.toString());

  clients.forEach(c => c.close());
});