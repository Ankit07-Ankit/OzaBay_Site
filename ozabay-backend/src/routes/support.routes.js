import { Router } from "express";
import requireAuth from "../middleware/auth.middleware.js";
import {
  createSupportMessage,
  getSupportUnreadCount,
  listSupportMessages,
  replyToSupportMessage,
} from "../controllers/support.controller.js";

const supportRouter = Router();
supportRouter.use(requireAuth);
supportRouter.get("/", listSupportMessages);
supportRouter.get("/unread-count", getSupportUnreadCount);
supportRouter.post("/", createSupportMessage);
supportRouter.post("/:ticketId/replies", replyToSupportMessage);

export default supportRouter;
