import Group from "../models/group.model.js";
import GroupMessage from "../models/groupMessage.model.js";
import User from "../models/User.model.js";

// ---------------- CREATE GROUP ----------------
export const createGroup = async (req, res) => {
  try {
    const { name, description, isPrivate, maxMembers } = req.body;
    const adminId = req.user._id;

    if (!name) {
      return res.status(400).json({ message: "Group name is required" });
    }

    // Create group
    const group = await Group.create({
      name,
      description,
      admin: adminId,
      isPrivate,
      maxMembers,
      members: [
        {
          user: adminId,
          role: "admin",
          joinedAt: new Date(),
        },
      ],
    });

    // Create system message
    await GroupMessage.create({
      sender: adminId,
      group: group._id,
      content: `${req.user.username} created the group`,
      messageType: "system",
      systemMessage: {
        type: "group_created",
      },
    });

    // Populate group with user details
    const populatedGroup = await Group.findById(group._id)
      .populate("admin", "username email")
      .populate("members.user", "username email isOnline lastSeen");

    res.status(201).json({
      message: "Group created successfully",
      group: populatedGroup,
    });
  } catch (error) {
    console.error("Error creating group:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- GET USER GROUPS ----------------
export const getUserGroups = async (req, res) => {
  try {
    const userId = req.user._id;
    const groups = await Group.find({
      "members.user": userId,
    })
      .populate("admin", "username email")
      .populate("members.user", "username email isOnline lastSeen") // fixed space in "username"
      .sort({ lastActivity: -1 });

    res.json({ groups });
  } catch (error) {
    console.error("Error fetching user groups:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- GET GROUP DETAILS ----------------
export const getGroupDetails = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId)
      .populate("admin", "username email")
      .populate("members.user", "username email isOnline lastSeen");

    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!group.isMember(userId)) {
      return res.status(403).json({ message: "Not a member of the group" });
    }

    res.json({ group });
  } catch (error) {
    console.error("Error fetching group details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- ADD MEMBER ----------------
export const addMember = async (req, res) => {
  try {
    const { userId } = req.body;
    const { groupId } = req.params;
    const requesterId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    if (!group.isMember(requesterId)) {
      return res.status(403).json({ message: "Not a member of this group" });
    }

    const requesterRole = group.getMemberRole(requesterId);
    if (!group.settings.allowMemberInvites && requesterRole === "member") {
      return res.status(403).json({ message: "Only admin can add members" });
    }

    // check if user exists
    const userToAdd = await User.findById(userId);
    if (!userToAdd) {
      return res.status(400).json({ message: "User not found" });
    }

    // check if user is already a member
    if (group.isMember(userId)) {
      return res.status(400).json({ message: "User is already a member" });
    }

    // check group capacity
    if (group.members.length >= group.maxMembers) {
      return res.status(400).json({ message: "Group is at capacity" });
    }

    // add member
    group.members.push({
      user: userId,
      role: "member",
      joinedAt: new Date(),
    });
    group.lastActivity = new Date();
    await group.save();

    // create system message
    await GroupMessage.create({
      sender: requesterId,
      group: groupId,
      content: `${req.user.username} added ${userToAdd.username} to the group`,
      messageType: "system",
      systemMessage: {
        type: "user_added",
        targetUser: userId,
      },
    });

    const updatedGroup = await Group.findById(groupId).populate(
      "members.user",
      "username email isOnline lastSeen"
    );

    res.json({
      message: "Member added successfully",
      group: updatedGroup,
    });
  } catch (error) {
    console.error("Error adding member:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- REMOVE MEMBER ----------------
export const removeMember = async (req, res) => {
  try {
    const { userId, groupId } = req.params;
    const requesterId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }

    // check permission
    if (!group.isAdmin(requesterId) && requesterId.toString() !== userId) {
      return res
        .status(403)
        .json({ message: "Not authorized to remove this member" });
    }

    // can't remove admin
    if (group.isAdmin(userId)) {
      return res.status(400).json({ message: "Cannot remove group admin" });
    }

    // remove member
    group.members = group.members.filter(
      (member) => member.user.toString() !== userId // fixed `tostring()` -> `toString()`
    );
    group.lastActivity = new Date();
    await group.save();

    const removedUser = await User.findById(userId);
    const isLeaving = requesterId.toString() === userId;

    // create system message
    await GroupMessage.create({
      sender: requesterId,
      group: groupId,
      content: isLeaving
        ? `${removedUser.username} left the group`
        : `${req.user.username} removed ${removedUser.username}`,
      messageType: "system",
      systemMessage: {
        type: isLeaving ? "user_left" : "user_removed",
        targetUser: userId,
      },
    });

    res.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Error removing member from group:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- UPDATE GROUP ----------------
export const updateGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { name, description, isPrivate, maxMembers, settings } = req.body;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!group.isAdmin(userId)) {
      return res
        .status(403)
        .json({ message: "Only admin can update group details" });
    }

    // update fields
    if (name) group.name = name;
    if (description !== undefined) group.description = description;
    if (isPrivate !== undefined) group.isPrivate = isPrivate;
    if (maxMembers) group.maxMembers = maxMembers;
    if (settings) group.settings = { ...group.settings, ...settings };

    group.lastActivity = new Date();
    await group.save();

    const updatedGroup = await Group.findById(groupId)
      .populate("admin", "username email")
      .populate("members.user", "username email isOnline lastSeen");

    res.json({
      message: "Group updated successfully",
      group: updatedGroup, // fixed wrong reference (was `updateGroup`)
    });
  } catch (error) {
    console.error("Error updating group details:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// ---------------- DELETE GROUP ----------------
export const deleteGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const userId = req.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Group not found" });
    }
    if (!group.isAdmin(userId)) {
      return res
        .status(403)
        .json({ message: "Only admin can delete group" });
    }

    // delete all group messages
    await GroupMessage.deleteMany({ group: groupId });

    // delete group (fixed incorrect usage)
    await Group.findByIdAndDelete(groupId);

    res.json({ message: "Group deleted successfully" });
  } catch (error) {
    console.error("Error deleting group:", error);
    res.status(500).json({ message: "Server error" });
  }
};
