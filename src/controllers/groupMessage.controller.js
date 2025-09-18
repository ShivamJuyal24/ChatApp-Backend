import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";

// Send message to Group
export const sendGroupMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const {groupId} = req.params;
    const { content, messageType = "text" } = req.body;

    if (!groupId || !content) {
      return res.status(400).json({ message: "Group Id and content are required." });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.isMember(senderId)) {
      return res.status(403).json({ message: "Not a member of the group" });
    }

    const message = await GroupMessage.create({
      sender: senderId,
      group: groupId,
      content,
      messageType,
    });

    group.lastActivity = new Date();
    await group.save();

    // populate sender info
    const populatedMessage = await GroupMessage.findById(message._id)
      .populate("sender", "username email")
      .populate("group", "name");

    res.status(201).json({
      message: "Message sent successfully",
      GroupMessage: populatedMessage,
    });
  } catch (error) {
    console.error("Error sending group message:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Get group message with pagination
export const getGroupMessages = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;
    const { page = 1, limit = 50 } = req.query;

    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.isMember(userId)) {
      return res.status(403).json({ message: "Not a member of the group" });
    }

    const messages = await GroupMessage.find({
      group: groupId,
      isDeleted: false,
    })
      .populate("sender", "username email")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Reverse to get chronological order
    messages.reverse();

    res.json({
      messages,
      currentPage: parseInt(page),
      totalPages: Math.ceil(
        (await GroupMessage.countDocuments({
          group: groupId,
          isDeleted: false,
        })) / limit
      ),
    });
  } catch (error) {
    console.error("Error getting group messages:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Mark group message as read
export const markGroupMessageAsRead = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await GroupMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found" });
    }

    // check if user is member of the group
    const group = await Group.findById(message.group);

    if (!group || !group.isMember(userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Don’t mark own message as read
    if (message.sender.toString() === userId.toString()) {
      return res.status(400).json({ message: "Cannot mark own message as read." });
    }

    message.markGroupMessageAsRead(userId);
    await message.save();

    res.json({ message: "Message marked as read" });
  } catch (error) {
    console.error("Error marking message as read:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Edit Group Message
export const editGroupMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user._id;

    if (!content) {
      return res.status(400).json({ message: "Content is required" });
    }

    const message = await GroupMessage.findById(messageId);
    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    if (message.sender.toString() !== userId.toString()) {
      return res.status(403).json({ message: "Can only edit own message." });
    }

    if (message.messageType !== "text") {
      return res.status(400).json({ message: "Can only edit text messages" });
    }

    message.content = content;
    message.editedAt = new Date();
    await message.save();

    const updatedMessage = await GroupMessage.findById(messageId).populate(
      "sender",
      "username email"
    );

    res.json({
      message: "Message edited successfully",
      groupMessage: updatedMessage,
    });
  } catch (error) {
    console.error("Error editing group message:", error);
    res.status(500).json({ message: "Server Error" });
  }
};

// Delete Group Message
export const deleteGroupMessage = async (req, res) => {
  try {
    const { messageId } = req.params;
    const userId = req.user._id;

    const message = await GroupMessage.findById(messageId);

    if (!message) {
      return res.status(404).json({ message: "Message not found." });
    }

    // check if user can delete (own message or admin)
    const group = await Group.findById(message.group);

    const canDelete =
      message.sender.toString() === userId.toString() || group.isAdmin(userId);

    if (!canDelete) {
      return res.status(403).json({ message: "Not authorized to delete the message" });
    }

    message.isDeleted = true;
    message.deletedAt = new Date();
    message.content = "This message was deleted";
    await message.save();

    res.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Error deleting group message:", error);
    res.status(500).json({ message: "Server Error" });
  }
};
