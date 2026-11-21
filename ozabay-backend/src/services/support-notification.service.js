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

export {
  countUnreadSupportMessages,
  markSupportMessagesRead,
  withSupportUnreadFlag,
};
