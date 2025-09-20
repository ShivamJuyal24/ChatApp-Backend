// __tests__/chat.test.js
import { jest } from "@jest/globals";
jest.setTimeout(30000);

// Add a counter to ensure unique usernames
let userCounter = 0;

import { createServer } from "http";
import { Server as IOServer } from "socket.io";
import Client from "socket.io-client";
import jwt from "jsonwebtoken";

import { setupChatSocket } from "../src/sockets/chat.js";
import { createUser, createGroup } from "../tests/factories.js";

let httpServer;
let io;
let baseUrl;

beforeAll(async () => {
  httpServer = createServer();
  io = new IOServer(httpServer);
  setupChatSocket(io);

  await new Promise((resolve) => {
    httpServer.listen(() => {
      const { port } = httpServer.address();
      baseUrl = `http://localhost:${port}`;
      resolve();
    });
  });
});

afterAll(async () => {
  if (io) await io.close();
  if (httpServer) await new Promise((res) => httpServer.close(res));
});

// Helper to connect a client with JWT
function clientConnect(user) {
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
}

// Helper to wait for socket to join a group
function waitForGroupJoin(socket, groupId) {
  return new Promise((resolve) => {
    socket.emit("joinGroup", { groupId });
    // Wait a bit to ensure join is processed
    setTimeout(resolve, 100);
  });
}

// ------------------------
// Private message tests
// ------------------------
test("private message: user1 -> user2", async () => {
  const user1 = await createUser();
  const user2 = await createUser();

  const client1 = await clientConnect(user1);
  const client2 = await clientConnect(user2);

  client1.emit("joinRoom", { otherUserId: user2._id.toString() });
  client2.emit("joinRoom", { otherUserId: user1._id.toString() });

  const messagePromise = new Promise((resolve) => client2.on("receiveMessage", resolve));
  client1.emit("sendMessage", { receiver: user2._id.toString(), content: "Hello Jest!" });

  const message = await messagePromise;
  expect(message.content).toBe("Hello Jest!");
  expect(message.sender.toString()).toBe(user1._id.toString());

  client1.close();
  client2.close();
});

// ------------------------
// Group message tests
// ------------------------
test("group message: user1 -> group (user2 receives)", async () => {
  const user1 = await createUser();
  const user2 = await createUser();
  const group = await createGroup([user1._id, user2._id]);

  const client1 = await clientConnect(user1);
  const client2 = await clientConnect(user2);

  await waitForGroupJoin(client1, group._id.toString());
  await waitForGroupJoin(client2, group._id.toString());

  const groupMessagePromise = new Promise((resolve) => client2.on("receiveGroupMessage", resolve));
  client1.emit("sendGroupMessage", { groupId: group._id.toString(), content: "Hello Group!" });

  const gm = await groupMessagePromise;
  expect(gm.content).toBe("Hello Group!");
  expect(gm.group).toBe(group._id.toString());

  client1.close();
  client2.close();
});

// ------------------------
// Group member tests
// ------------------------
test("adding a member to group emits notification", async () => {
  const user1 = await createUser();
  const user2 = await createUser();
  const newUser = await createUser();
  const group = await createGroup([user1._id, user2._id]);

  const client1 = await clientConnect(user1);
  const client2 = await clientConnect(user2);
  const clientNew = await clientConnect(newUser);

  await waitForGroupJoin(client1, group._id.toString());
  await waitForGroupJoin(client2, group._id.toString());

  const notificationPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("groupMemberAdded event timeout")), 5000);
    client2.on("groupMemberAdded", (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  client1.emit("memberAddedToGroup", { 
    groupId: group._id.toString(), 
    newMemberId: newUser._id.toString(), 
    addedBy: user1._id.toString() 
  });

  const msg = await notificationPromise;
  expect(msg.groupId.toString()).toBe(group._id.toString());
  expect(msg.newMemberId.toString()).toBe(newUser._id.toString());
  expect(msg.addedBy.toString()).toBe(user1._id.toString());

  client1.close();
  client2.close();
  clientNew.close();
});

test("removing a member from group emits notification and leaves room", async () => {
  const user1 = await createUser();
  const user2 = await createUser();
  const group = await createGroup([user1._id, user2._id]);

  const client1 = await clientConnect(user1);
  const client2 = await clientConnect(user2);

  await waitForGroupJoin(client1, group._id.toString());
  await waitForGroupJoin(client2, group._id.toString());

  const notificationPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("groupMemberRemoved event timeout")), 5000);
    client2.on("groupMemberRemoved", (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  client1.emit("memberRemovedFromGroup", { 
    groupId: group._id.toString(), 
    removedMemberId: user2._id.toString(), 
    removedBy: user1._id.toString() 
  });

  const msg = await notificationPromise;
  expect(msg.groupId.toString()).toBe(group._id.toString());
  expect(msg.removedMemberId.toString()).toBe(user2._id.toString());
  expect(msg.removedBy.toString()).toBe(user1._id.toString());

  await new Promise((res) => setTimeout(res, 100));
  const groupRoom = io.sockets.adapter.rooms.get(`group_${group._id.toString()}`);
  expect(groupRoom ? groupRoom.has(client2.id) : false).toBe(false);

  client1.close();
  client2.close();
});

// ------------------------
// Group typing tests
// ------------------------
test("group typing indicators", async () => {
  const user1 = await createUser();
  const user2 = await createUser();
  const group = await createGroup([user1._id, user2._id]);

  const client1 = await clientConnect(user1);
  const client2 = await clientConnect(user2);

  await waitForGroupJoin(client1, group._id.toString());
  await waitForGroupJoin(client2, group._id.toString());

  const typingPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("userTypingInGroup event timeout")), 5000);
    client2.on("userTypingInGroup", (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  client1.emit("groupTyping", { groupId: group._id.toString() });

  const typingEvent = await typingPromise;
  expect(typingEvent.userId.toString()).toBe(user1._id.toString());

  const stopTypingPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("userStoppedTypingInGroup event timeout")), 5000);
    client2.on("userStoppedTypingInGroup", (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  client1.emit("stopGroupTyping", { groupId: group._id.toString() });

  const stopTypingEvent = await stopTypingPromise;
  expect(stopTypingEvent.userId.toString()).toBe(user1._id.toString());

  client1.close();
  client2.close();
});

// ------------------------
// Group message read tests
// ------------------------
test("mark group message as read", async () => {
  const user1 = await createUser();
  const user2 = await createUser();
  const group = await createGroup([user1._id, user2._id]);

  const client1 = await clientConnect(user1);
  const client2 = await clientConnect(user2);

  await waitForGroupJoin(client1, group._id.toString());
  await waitForGroupJoin(client2, group._id.toString());

  const groupMessagePromise = new Promise((resolve) => client2.on("receiveGroupMessage", resolve));
  client1.emit("sendGroupMessage", { groupId: group._id.toString(), content: "Read this message!" });
  const message = await groupMessagePromise;

  const readPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("groupMessageRead event timeout")), 5000);
    client1.on("groupMessageRead", (data) => {
      clearTimeout(timeout);
      resolve(data);
    });
  });

  client2.emit("markGroupMessageAsRead", { messageId: message._id, groupId: group._id.toString() });
  const readEvent = await readPromise;

  expect(readEvent.userId.toString()).toBe(user2._id.toString());
  expect(readEvent.messageId.toString()).toBe(message._id.toString());

  client1.close();
  client2.close();
});