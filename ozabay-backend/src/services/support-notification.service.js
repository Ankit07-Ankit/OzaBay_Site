const getLatestIncomingSupportMessageAt = (ticket, recipient) => {
  const incomingDates = recipient === "admin"
    ? [ticket.createdAt, ...(ticket.replies || [])
      .filter((reply) => reply.sender !== "admin")
      .map((reply) => reply.createdAt)]
    : (ticket.replies || [])
      .filter((reply) => reply.sender === "admin")
      .map((reply) => reply.createdAt);
  const timestamps = incomingDates
    .map((date) => new Date(date).getTime())
    .filter(Number.isFinite);
  return timestamps.length ? new Date(Math.max(...timestamps)) : null;
};

const hasUnreadSupportMessage = (ticket, recipient) => {
  const latestIncomingAt = getLatestIncomingSupportMessageAt(ticket, recipient);
  if (!latestIncomingAt) return false;
  const readAt = ticket[recipient === "admin" ? "adminReadAt" : "userReadAt"];
  return !readAt || latestIncomingAt > new Date(readAt);
};

const withSupportUnreadFlag = (tickets, recipient) => tickets.map((ticket) => ({
  ...ticket,
  hasUnread: hasUnreadSupportMessage(ticket, recipient),
}));

const markSupportMessagesRead = async (SupportMessage, tickets, recipient) => {
  const readField = recipient === "admin" ? "adminReadAt" : "userReadAt";
  const operations = tickets.flatMap((ticket) => {
    const latestIncomingAt = getLatestIncomingSupportMessageAt(ticket, recipient);
    if (!latestIncomingAt) return [];
    const previousReadAt = ticket[readField] ? new Date(ticket[readField]) : null;
    if (previousReadAt && latestIncomingAt <= previousReadAt) return [];
    return [{
      updateOne: {
        filter: { _id: ticket._id },
        update: { $max: { [readField]: latestIncomingAt } },
      },
    }];
  });
  if (operations.length) await SupportMessage.bulkWrite(operations, { ordered: false });
};

const countUnreadSupportMessages = (tickets, recipient) => (
  tickets.reduce((count, ticket) => count + Number(hasUnreadSupportMessage(ticket, recipient)), 0)
);

const countUnreadSupportMessagesInDatabase = async (
  SupportMessage,
  filter,
  recipient,
) => {
  const isAdmin = recipient === "admin";
  const readField = isAdmin ? "adminReadAt" : "userReadAt";
  const incomingSender = isAdmin ? { $ne: ["$$reply.sender", "admin"] } : {
    $eq: ["$$reply.sender", "admin"],
  };
  const epoch = new Date(0);
  const [result] = await SupportMessage.aggregate([
    { $match: filter },
    {
      $project: {
        readAt: { $ifNull: [`$${readField}`, epoch] },
        latestIncomingAt: {
          $reduce: {
            input: {
              $filter: {
                input: { $ifNull: ["$replies", []] },
                as: "reply",
                cond: incomingSender,
              },
            },
            initialValue: isAdmin ? { $ifNull: ["$createdAt", epoch] } : epoch,
            in: {
              $cond: [
                { $gt: ["$$this.createdAt", "$$value"] },
                "$$this.createdAt",
                "$$value",
              ],
            },
          },
        },
      },
    },
    { $match: { $expr: { $gt: ["$latestIncomingAt", "$readAt"] } } },
    { $count: "unreadCount" },
  ]);
  return result?.unreadCount || 0;
};

export {
  countUnreadSupportMessages,
  countUnreadSupportMessagesInDatabase,
  markSupportMessagesRead,
  withSupportUnreadFlag,
};
