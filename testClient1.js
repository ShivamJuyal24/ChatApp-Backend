// testClient1.js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

// Replace with real MongoDB ObjectIds from your User collection
const senderId = "68c6deb14224e31f5bcc903c";   // user1
const receiverId = "68c3cfa3505f29e9a826fc36"; // user2

socket.on("connect", () => {
  console.log("Connected as", socket.id);

  socket.emit("joinRoom", "room1");

  // Send a message
  socket.emit("sendMessage", {
    room: "room1",
    sender: senderId,
    receiver: receiverId,
    content: "Hello from Client 1",
  });
});

// Listen for messages
socket.on("receiveMessage", (data) => {
  console.log("Received:", data);
});
