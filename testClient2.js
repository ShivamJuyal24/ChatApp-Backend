// testClient2.js
import { io } from "socket.io-client";

// Use your real JWT for user2 here
const socket = io("http://localhost:3000", {
  auth: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YzNjZmEzNTA1ZjI5ZTlhODI2ZmMzNiIsImlhdCI6MTc1ODA0NjEyNiwiZXhwIjoxNzU4NjUwOTI2fQ.dcQZE8hRKNH_Lg4tnRWx9U5TW-pSSWOGMucrue-y8N4" },
});

// Replace with real MongoDB ObjectIds
const otherUserId = "68c6deb14224e31f5bcc903c"; // user1

socket.on("connect", () => {
  console.log("Client2 Connected as", socket.id);

  // Join private room with user1
  socket.emit("joinRoom", { otherUserId });
});

socket.on("receiveMessage", (data) => {
  console.log("Client2 received:", data);

  // Mark the message as read
  socket.emit("markAsRead", { messageId: data._id });
});
