import mongoose from "mongoose";
import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";

export const setupGroupSocket = (io, socket) => {
    // Join group room
    socket.on("joinGroup", async ({ groupId }) => {
        try {
            const group = await Group.findById(groupId);
            if (!group || !group.isMember(socket.userId)) {
                socket.emit("error", { message: "Not authorized to join this group" });
                return;
            }

            socket.join(`group_${groupId}`);
            console.log(`User ${socket.userId} joined group ${groupId}`);

            // Notify group members that user is online
            socket.to(`group_${groupId}`).emit("userJoinedGroup", {
                userId: socket.userId,
                groupId: groupId
            });
        } catch (error) {
            console.error("Error joining group:", error);
            socket.emit("error", { message: "Failed to join group" });
        }
    });

    // Leave group room
    socket.on("leaveGroup", ({ groupId }) => {
        socket.leave(`group_${groupId}`);
        socket.to(`group_${groupId}`).emit("userLeftGroup", {
            userId: socket.userId,
            groupId: groupId
        });
        console.log(`User ${socket.userId} left group ${groupId}`);
    });

    // Send group message
    socket.on("sendGroupMessage", async ({ groupId, content, messageType = 'text', attachments = [] }) => {
        try {
            const sender = socket.userId;

            // Verify group membership
            const group = await Group.findById(groupId);
            if (!group || !group.isMember(sender)) {
                socket.emit("error", { message: "Not authorized to send message to this group" });
                return;
            }

            // Create message
            const message = await GroupMessage.create({
                sender: new mongoose.Types.ObjectId(sender),
                group: new mongoose.Types.ObjectId(groupId),
                content,
                messageType,
                attachments
            });

            // Update group's last activity
            group.lastActivity = new Date();
            await group.save();

            // Populate sender info
            const populatedMessage = await GroupMessage.findById(message._id)
                .populate('sender', 'username email');

            console.log(`Group message sent in ${groupId}: ${content}`);

            // Emit to all group members
            io.to(`group_${groupId}`).emit("receiveGroupMessage", {
                _id: populatedMessage._id,
                sender: populatedMessage.sender,
                group: groupId,
                content: populatedMessage.content,
                messageType: populatedMessage.messageType,
                attachments: populatedMessage.attachments,
                createdAt: populatedMessage.createdAt
            });

            // Mark as delivered to online group members
            const onlineMembers = await getOnlineGroupMembers(groupId, io);
            for (const memberId of onlineMembers) {
                if (memberId !== sender) {
                    message.markAsDeliveredTo(memberId);
                }
            }
            await message.save();

        } catch (error) {
            console.error("Error sending group message:", error);
            socket.emit("error", { message: "Failed to send group message" });
        }
    });

    // Mark group message as read
    socket.on("markGroupMessageAsRead", async ({ messageId, groupId }) => {
        try {
            const message = await GroupMessage.findById(messageId);
            if (!message) {
                socket.emit("error", { message: "Message not found" });
                return;
            }

            // Verify group membership
            const group = await Group.findById(groupId);
            if (!group || !group.isMember(socket.userId)) {
                socket.emit("error", { message: "Not authorized" });
                return;
            }

            // Don't mark own messages as read
            if (message.sender.toString() === socket.userId.toString()) {
                return;
            }

            message.markAsReadBy(socket.userId);
            await message.save();

            // Notify group members about read status
            io.to(`group_${groupId}`).emit("groupMessageRead", {
                messageId: message._id,
                userId: socket.userId,
                readAt: new Date()
            });

        } catch (error) {
            console.error("Error marking group message as read:", error);
        }
    });

    // Group typing indicators
    socket.on("groupTyping", ({ groupId }) => {
        socket.to(`group_${groupId}`).emit("userTypingInGroup", {
            userId: socket.userId,
            groupId: groupId
        });
    });

    socket.on("stopGroupTyping", ({ groupId }) => {
        socket.to(`group_${groupId}`).emit("userStoppedTypingInGroup", {
            userId: socket.userId,
            groupId: groupId
        });
    });

    // Group member events
    socket.on("memberAddedToGroup", ({ groupId, newMemberId, addedBy }) => {
        // Notify all group members
        io.to(`group_${groupId}`).emit("groupMemberAdded", {
            groupId,
            newMemberId,
            addedBy,
            timestamp: new Date()
        });
    });

    socket.on("memberRemovedFromGroup", ({ groupId, removedMemberId, removedBy }) => {
        // Notify all group members
        io.to(`group_${groupId}`).emit("groupMemberRemoved", {
            groupId,
            removedMemberId,
            removedBy,
            timestamp: new Date()
        });

        // Remove the user from the group room
        const memberSocket = Array.from(io.sockets.sockets.values())
            .find(s => s.userId === removedMemberId);
        if (memberSocket) {
            memberSocket.leave(`group_${groupId}`);
        }
    });
};

// Helper function to get online group members
async function getOnlineGroupMembers(groupId, io) {
    try {
        const group = await Group.findById(groupId);
        if (!group) return [];

        const onlineMembers = [];
        const groupRoom = io.sockets.adapter.rooms.get(`group_${groupId}`);
        
        if (groupRoom) {
            for (const socketId of groupRoom) {
                const socket = io.sockets.sockets.get(socketId);
                if (socket && socket.userId) {
                    onlineMembers.push(socket.userId);
                }
            }
        }
        
        return onlineMembers;
    } catch (error) {
        console.error("Error getting online group members:", error);
        return [];
    }
}