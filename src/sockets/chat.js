import mongoose from "mongoose";
import Message from "../models/message.model.js";
import User from "../models/User.model.js";
import jwt from "jsonwebtoken";
import { setupGroupSocket } from "./setupGroupSocket.js";

export const setupChatSocket = (io) => {
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

  io.on("connection", async (socket) => {
    console.log("User Connected:", socket.userId);

    // Only update user status if database is connected
    if (mongoose.connection.readyState === 1) {
      try {
        await User.findByIdAndUpdate(socket.userId, {
          isOnline: true,
          lastSeen: new Date(),
        });
      } catch (error) {
        console.error("Error updating user online status:", error);
      }
    }

    io.emit("user_online", { userId: socket.userId });

    // Setup group socket functionality
    setupGroupSocket(io, socket);

    socket.on("joinRoom", ({ otherUserId }) => {
      const room = [socket.userId, otherUserId].sort().join("_");
      socket.join(room);
      console.log(`User ${socket.userId} joined room ${room}`);
    });

    socket.on("sendMessage", async ({ receiver, content }) => {
      if (mongoose.connection.readyState !== 1) {
        console.log("Database not connected, skipping message save");
        return;
      }
      
      try {
        const sender = socket.userId;
        const room = [sender, receiver].sort().join("_");
        const message = await Message.create({
          sender: new mongoose.Types.ObjectId(sender),
          receiver: new mongoose.Types.ObjectId(receiver),
          content,
          deliveredAt: new Date(),
        });

        console.log(`Message stored and sent in ${room}: ${content}`);

        io.to(room).emit("receiveMessage", {
          _id: message._id,
          sender: message.sender,
          receiver: message.receiver,
          content: message.content,
          createdAt: message.createdAt,
          deliveredAt: message.deliveredAt,
        });
      } catch (error) {
        console.error("Error saving message:", error);
        socket.emit("errorMessage", { message: "Failed to send message" });
      }
    });

    socket.on("disconnect", async () => {
      console.log("User Disconnected:", socket.userId);
      if (mongoose.connection.readyState === 1) {
        try {
          await User.findByIdAndUpdate(socket.userId, {
            isOnline: false,
            lastSeen: new Date(),
          });
        } catch (error) {
          console.error("Error updating user offline status:", error);
        }
      }
      io.emit("user_offline", { userId: socket.userId });
    });
  });
};