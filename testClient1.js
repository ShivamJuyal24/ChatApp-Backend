// testClient1.js
import { io } from "socket.io-client";

// Use your real JWT for user1 here
const socket = io("http://localhost:3000", {
  auth: { token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY4YzZkZWIxNDIyNGUzMWY1YmNjOTAzYyIsImlhdCI6MTc1ODA0NjA0NSwiZXhwIjoxNzU4NjUwODQ1fQ.8gGtMHbvc4TV0BL_xrD5q5O-y66xKC8jl1EcQaCEfmU" },
});

// Replace with real MongoDB ObjectIds
const receiverId = "68c3cfa3505f29e9a826fc36"; // user2

socket.on("connect", () => {
  console.log("Client1 Connected as", socket.id);

  // Join private room with user2
  socket.emit("joinRoom", { otherUserId: receiverId });

  // Send a message after join
  setTimeout(() => {
    socket.emit("sendMessage", {
      receiver: receiverId,
      content: "Hello from Client 1",
    });
  }, 2000);
});

// Listen for messages
socket.on("receiveMessage", (data) => {
  console.log("Client1 received:", data);
});
