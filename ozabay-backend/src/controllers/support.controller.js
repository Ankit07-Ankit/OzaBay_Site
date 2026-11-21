import Joi from "joi";
import User from "../models/user.model.js";
import SupportMessage from "../models/support-message.model.js";
import {
  countUnreadSupportMessages,
  markSupportMessagesRead as markMessagesReadForRecipient,
  withSupportUnreadFlag,
} from "../services/support-notification.service.js";

const createSchema = Joi.object({
  category: Joi.string().valid("Support", "Feedback", "Order", "Return", "Review", "Vendor").default("Support"),
  subject: Joi.string().trim().min(3).max(120).required(),
  message: Joi.string().trim().min(5).max(2000).required(),
});

const replySchema = Joi.object({
  message: Joi.string().trim().min(2).max(2000).required(),
});

export const createSupportMessage = async (req, res, next) => {
  const { error, value } = createSchema.validate(req.body, { abortEarly: true });
  if (error) return res.status(400).json({ message: error.details[0].message });
  try {
    const user = await User.findById(req.authUserId).select("name email accountType");
    if (!user) return res.status(404).json({ message: "Account not found." });
    const createdAt = new Date();
    const ticket = await SupportMessage.create({
      userId: user._id,
      userName: user.name,
      userEmail: user.email,
      accountType: user.accountType === "vendor" ? "vendor" : "user",
      userReadAt: createdAt,
      ...value,
    });
    return res.status(201).json({ message: "Your message was sent to support.", ticket });
  } catch (error) {
    return next(error);
  }
};

export const listSupportMessages = async (req, res, next) => {
  try {
    const tickets = await SupportMessage.find({ userId: req.authUserId })
      .sort({ createdAt: -1 })
      .lean();
    const ticketsWithUnread = withSupportUnreadFlag(tickets, "user");
    if (req.query.markRead === "true") {
      await markMessagesReadForRecipient(SupportMessage, tickets, "user");
    }
    return res.status(200).json({ tickets: ticketsWithUnread });
  } catch (error) {
    return next(error);
  }
};

export const getSupportUnreadCount = async (req, res, next) => {
  try {
    const tickets = await SupportMessage.find({ userId: req.authUserId })
      .select("createdAt replies.sender replies.createdAt userReadAt")
      .lean();
    return res.status(200).json({
      unreadCount: countUnreadSupportMessages(tickets, "user"),
    });
  } catch (error) {
    return next(error);
  }
};

export const replyToSupportMessage = async (req, res, next) => {
  const { error, value } = replySchema.validate(req.body, { abortEarly: true });
  if (error) return res.status(400).json({ message: error.details[0].message });
  try {
    const user = await User.findById(req.authUserId).select("accountType");
    const ticket = await SupportMessage.findOneAndUpdate(
      { _id: req.params.ticketId, userId: req.authUserId },
      {
        $push: {
          replies: {
            sender: user?.accountType === "vendor" ? "vendor" : "customer",
            message: value.message,
            createdAt: new Date(),
          },
        },
        $set: { status: "Open" },
        $max: { userReadAt: new Date() },
      },
      { new: true, runValidators: true },
    );
    if (!ticket) return res.status(404).json({ message: "Support message not found." });
    return res.status(200).json({ message: "Reply sent.", ticket });
  } catch (error) {
    if (error.name === "CastError") return res.status(400).json({ message: "Invalid support message identifier." });
    return next(error);
  }
};
