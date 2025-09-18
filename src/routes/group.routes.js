import express from "express";
import { protect } from "../middleware/auth.middleware.js";
import {
    createGroup,
    getUserGroups,
    getGroupDetails,
    addMember,
    removeMember,
    updateGroup,
    deleteGroup
} from "../controllers/group.controller.js";

import {
    sendGroupMessage,
    getGroupMessages,
    markGroupMessageAsRead,
    editGroupMessage,
    deleteGroupMessage
} from "../controllers/groupMessage.controller.js";

const router = express.Router();

// Group management routes
router.post('/', protect, createGroup);                    // Create group
router.get('/', protect, getUserGroups);                  // Get user's groups
router.get('/:groupId', protect, getGroupDetails);        // Get group details
router.put('/:groupId', protect, updateGroup);            // Update group
router.delete('/:groupId', protect, deleteGroup);         // Delete group

// Member management routes
router.post('/:groupId/members', protect, addMember);     // Add member
router.delete('/:groupId/members/:userId', protect, removeMember); // Remove member

// Group message routes
router.post('/:groupId/messages', protect, sendGroupMessage);      // Send message
router.get('/:groupId/messages', protect, getGroupMessages);       // Get messages
router.put('/messages/:messageId/read', protect, markGroupMessageAsRead); // Mark as read
router.put('/messages/:messageId', protect, editGroupMessage);     // Edit message
router.delete('/messages/:messageId', protect, deleteGroupMessage); // Delete message

export default router;