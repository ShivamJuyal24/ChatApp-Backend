import mongoose from "mongoose";

const groupMessageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Group",
    required: true
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  messageType: {
    type: String,
    enum: ["text", "image", "file", "system"],
    default: "text"
  },
  systemMessage: {
    type: {
      type: String,
      enum: [
        "user_joined",
        "user_left",
        "user_added",
        "user_removed",
        "group_created",
        "admin_changed"
      ]
    },
    targetUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  },
  readBy: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      readAt: { type: Date, default: Date.now }
    }
  ],
  deliveredTo: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      deliveredAt: { type: Date, default: Date.now }
    }
  ],
  editedAt: {
    type: Date,
    default: null
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

groupMessageSchema.index({ group: 1, createdAt: -1 });
groupMessageSchema.index({ sender: 1 });

// Mark message as read
groupMessageSchema.methods.markAsReadBy = function(userId) {
  if (!this.readBy.find(r => r.user.toString() === userId.toString())) {
    this.readBy.push({ user: userId });
  }
};

// Mark message as delivered
groupMessageSchema.methods.markAsDeliveredTo = function(userId) {
  if (!this.deliveredTo.find(d => d.user.toString() === userId.toString())) {
    this.deliveredTo.push({ user: userId });
  }
};

export default mongoose.model("GroupMessage", groupMessageSchema);
