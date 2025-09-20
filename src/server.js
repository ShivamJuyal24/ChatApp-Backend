import express from "express";
import dotenv from "dotenv";
import http from "http";           
import { Server } from "socket.io";    
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import messageRoutes from "./routes/message.routes.js";
import groupRoutes from "./routes/group.routes.js";
import { setupChatSocket } from "./sockets/chat.js";

dotenv.config();

const app = express();
app.use(express.json());

// Create HTTP server from express app
const server = http.createServer(app);

// Create socket.io server
const io = new Server(server, {
  cors: {
    origin: "*", // later restrict to your frontend
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
});

// Setup socket handlers
setupChatSocket(io);

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "OK", timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    await connectDB();
    server.listen(PORT, () =>
      console.log(`🚀 Server running on http://localhost:${PORT}`)
    );
  } catch (err) {
    console.error("Failed to start server", err);
    process.exit(1);
  }
};

start();