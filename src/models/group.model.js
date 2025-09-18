import mongoose from "mongoose";

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200,
        default: ""
    },
    admin: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User", 
        required: true
    },
    members: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
        joinedAt: {
            type: Date,
            default: Date.now
        },
        role: {
            type: String,
            enum: ["admin", "member", "moderator"],
            default: "member"
        }
    }],
    isPrivate: {
        type: Boolean,
        default: false
    },
    maxMembers: {
        type: Number,
        default: 100,
        min: 2,
        max: 500
    },
    lastActivity: {
        type: Date,
        default: Date.now
    },
    settings: {
        allowMemberInvites: {
            type: Boolean,
            default: true
        },
        allowFileSharing: {
            type: Boolean,
            default: true
        }
    }
}, { timestamps: true });

// Indexes
groupSchema.index({ admin: 1 });
groupSchema.index({ "members.user": 1 });
groupSchema.index({ lastActivity: -1 });

// Virtual for member count
groupSchema.virtual("memberCount").get(function () {
    return this.members.length;
});

// Check if user is admin
groupSchema.methods.isAdmin = function (userId) {
    return this.admin.toString() === userId.toString();
};

// Check if user is member 
groupSchema.methods.isMember = function (userId) {
    return this.members.some(
        member => member.user.toString() === userId.toString()
    );
};

// Get member role
groupSchema.methods.getMemberRole = function (userId) {
    const member = this.members.find(
        member => member.user.toString() === userId.toString()
    );
    return member ? member.role : null;
};

export default mongoose.model("Group", groupSchema);
