import mongoose from "mongoose";
import Message from "../models/message.model.js";
import User from "../models/User.model.js";
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
    } catch (error) {
      console.error("Socket auth error:", error);
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket) => {
    console.log("User Connected:", socket.userId);

    // Mark user online + update lastSeen
    await User.findByIdAndUpdate(socket.userId, {
      isOnline: true,
      lastSeen: new Date()
    });
    io.emit("user_online", { userId: socket.userId });

    // Join private room
    socket.on("joinRoom", ({ otherUserId }) => {
      const room = [socket.userId, otherUserId].sort().join("_");
      socket.join(room);
      console.log(`User ${socket.userId} joined room ${room}`);
    });

    // Send message
    socket.on("sendMessage", async ({ receiver, content }) => {
      try {
        const sender = socket.userId;
        const room = [sender, receiver].sort().join("_");

        const message = await Message.create({
          sender: new mongoose.Types.ObjectId(sender),
          receiver: new mongoose.Types.ObjectId(receiver),
          content,
          deliveredAt: new Date() // Mark delivered instantly
        });

        console.log(`Message stored and sent in ${room}: ${content}`);

        io.to(room).emit("receiveMessage", {
          _id: message._id,
          sender: message.sender,
          receiver: message.receiver,
          content: message.content,
          createdAt: message.createdAt,
          deliveredAt: message.deliveredAt
        });
      } catch (error) {
        console.error("Error saving message:", error);
        socket.emit("errorMessage", { message: "Failed to send message" });
      }
    });

    // Mark message as read
    socket.on("markAsRead", async ({ messageId }) => {
      try {
        const message = await Message.findByIdAndUpdate(
          messageId,
          { readAt: new Date() },
          { new: true }
        );

        if (message) {
          const room = [message.sender.toString(), message.receiver.toString()]
            .sort()
            .join("_");
          io.to(room).emit("messageRead", {
            messageId: message._id,
            readAt: message.readAt
          });
        }
      } catch (error) {
        console.error("Error marking message as read:", error);
      }
    });

    // Typing indicators
    socket.on("typing", ({ receiver }) => {
      const room = [socket.userId, receiver].sort().join("_");
      io.to(room).emit("typing", { senderId: socket.userId });
    });

    socket.on("stopTyping", ({ receiver }) => {
      const room = [socket.userId, receiver].sort().join("_");
      io.to(room).emit("stopTyping", { senderId: socket.userId });
    });

    // Disconnect
    socket.on("disconnect", async () => {
      console.log("User Disconnected:", socket.userId);
      await User.findByIdAndUpdate(socket.userId, {
        isOnline: false,
        lastSeen: new Date()
      });
      io.emit("user_offline", { userId: socket.userId });
    });
  });
};
