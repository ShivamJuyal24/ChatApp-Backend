import express from "express";
import {protect} from "../middleware/auth.middleware.js";
import {createMessage, getMessage} from "../controllers/message.controller.js";


const router = express.Router();

//Send Message
router.post('/', protect, createMessage);

//Get Messages between two users
router.get('/:user1/:user2', protect, getMessage);

export default router;
