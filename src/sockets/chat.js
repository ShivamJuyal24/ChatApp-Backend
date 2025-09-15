import mongoose from "mongoose";
import Message from "../models/message.model.js";
import jwt from "jsonwebtoken";

export const setupChatSocket = (io) => {
  // Socket auth middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Authentication error"));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      console.error("Socket auth error:", err);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", (socket) => {
    console.log("User Connected:", socket.userId);

    // Join private room with another user
    socket.on("joinRoom", ({ otherUserId }) => {
      // Room ID = combination of two user IDs (sorted)
      const room = [socket.userId, otherUserId].sort().join("_");
      socket.join(room);
      console.log(`User ${socket.userId} joined room ${room}`);
    });

    // Send message
    socket.on("sendMessage", async ({ receiver, content }) => {
      try {
        const sender = socket.userId;
        const room = [sender, receiver].sort().join("_");

        // Save message to DB
        const message = await Message.create({
          sender: new mongoose.Types.ObjectId(sender),
          receiver: new mongoose.Types.ObjectId(receiver),
          content
        });

        console.log(`Message stored and sent in ${room}: ${content}`);

        // Emit message to room
        io.to(room).emit("receiveMessage", {
          _id: message._id,
          sender: message.sender,
          receiver: message.receiver,
          content: message.content,
          createdAt: message.createdAt
        });
      } catch (err) {
        console.error("Error saving message:", err);
        socket.emit("errorMessage", { message: "Failed to send message" });
      }
    });

    // Handle disconnect
    socket.on("disconnect", () => {
      console.log("User Disconnected:", socket.userId);
    });
  });
};
