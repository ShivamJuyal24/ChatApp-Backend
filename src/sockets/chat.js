import mongoose from "mongoose";
import Message from "../models/message.model.js";

export const setupChatSocket = (io)=>{
  io.on("connection", (socket)=>{
    console.log("User Connected :", socket.id);

    //User joins room
    socket.on("joinRoom", (room)=>{
      socket.join(room);
      console.log(`User ${socket.id} joined room ${room}`);
    });

    // send message
    socket.on("sendMessage", async ({ room, sender, receiver, content})=>{
      try{
        const message = await Message.create({
          sender : new mongoose.Types.ObjectId(sender),
          receiver: new mongoose.Types.ObjectId(receiver),
          content
        });

        console.log(`Message stored and sent in ${room}: ${content}`);

        //Broadcast message to room
        io.to(room).emit("receiveMessage", {
          _id: message.id,
          sender: message.sender,
          receiver: message.receiver,
          content: message.contenet,
          createdAt: message.createdAt
        });
      }catch(err){
        console.error("Erron saving message", err);
      }
    })

    // Handle disconnect
    socket.on("disconnect", ()=>{
      console.log("User Disconnected:", socket.id);
    });
  });
}