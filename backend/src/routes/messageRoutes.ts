import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { messageController } from "../controllers/messageController";
import { sendMessageSchema } from "../models/schemas";

export const messageRouter = Router();

messageRouter.get("/conversations", authenticate, messageController.getConversationList);
messageRouter.get("/conversations/:userId", authenticate, messageController.getConversation);
messageRouter.post("/", authenticate, validate(sendMessageSchema), messageController.sendMessage);
