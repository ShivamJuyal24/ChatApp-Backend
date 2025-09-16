import { io } from "socket.io-client";

// Replace these with real JWT tokens for your users
const tokenUser1 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YzNjZmEzNTA1ZjI5ZTlhODI2ZmMzNiIsImlhdCI6MTc1ODA0NjEyNiwiZXhwIjoxNzU4NjUwOTI2fQ.dcQZE8hRKNH_Lg4tnRWx9U5TW-pSSWOGMucrue-y8N4";
const tokenUser2 = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YzZkZWIxNDIyNGUzMWY1YmNjOTAzYyIsImlhdCI6MTc1ODA0NjcyOCwiZXhwIjoxNzU4NjUxNTI4fQ.ZxRKHobsjf2VlH4metSwN_liHKbwH3bpbj4rbZ7Cmq4";

// Replace these with real MongoDB ObjectIds
const user1Id = "68c3cfa3505f29e9a826fc36";
const user2Id = "68c6deb14224e31f5bcc903c";


// Connect Client 1
const client1 = io("http://localhost:3000", {
  auth: { token: tokenUser1 }
});

// Connect Client 2
const client2 = io("http://localhost:3000", {
  auth: { token: tokenUser2 }
});

// --- Client 1 ---
client1.on("connect", () => {
  console.log("Client1 Connected:", client1.id);

  // Join private room with user2
  client1.emit("joinRoom", { otherUserId: user2Id });

  // Send a message after joining
  setTimeout(() => {
    console.log("Client1 sending message...");
    client1.emit("sendMessage", {
      receiver: user2Id,
      content: "Hello from Client 1"
    });

    // Typing indicator
    setTimeout(() => {
      client1.emit("typing", { receiver: user2Id });
      setTimeout(() => client1.emit("stopTyping", { receiver: user2Id }), 1500);
    }, 500);
  }, 1000);
});

// Listen for messages and read receipts on Client 1
client1.on("receiveMessage", (msg) => {
  console.log("Client1 received:", msg);
});

client1.on("messageRead", (data) => {
  console.log("Client1 sees message read:", data);
});

// --- Client 2 ---
client2.on("connect", () => {
  console.log("Client2 Connected:", client2.id);

  // Join private room with user1
  client2.emit("joinRoom", { otherUserId: user1Id });
});

// Listen for messages on Client 2
client2.on("receiveMessage", (msg) => {
  console.log("Client2 received:", msg);

  // Mark the message as read
  setTimeout(() => {
    console.log("Client2 marking message as read...");
    client2.emit("markAsRead", { messageId: msg._id });
  }, 500);
});

// Typing indicator received
client2.on("typing", (data) => {
  console.log("Client2 sees typing:", data);
});
client2.on("stopTyping", (data) => {
  console.log("Client2 sees stopTyping:", data);
});
