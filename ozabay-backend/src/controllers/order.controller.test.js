import assert from "node:assert/strict";
import { before, test } from "node:test";

let sendOrderRequestEmail;

before(async () => {
  process.env.MONGO_URI = "mongodb://127.0.0.1/test";
  process.env.JWT_SECRET = "test-secret";
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REFRESH_TOKEN = "test-refresh-token";
  process.env.GOOGLE_USER = "sender@example.com";
  process.env.RAZORPAY_KEY_ID = "test-razorpay-key";
  process.env.RAZORPAY_KEY_SECRET = "test-razorpay-secret";
  process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
  ({ sendOrderRequestEmail } = await import("./order.controller.js"));
});

test("emails customers about return and cancellation request updates", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), ...options });
    return {
      ok: true,
      status: 200,
      json: async () => ({ access_token: "test-access-token", expires_in: 3600 }),
    };
  };

  const order = {
    _id: "1234567890abcdefABC12345",
    customer: {
      name: "Test Customer",
      email: "customer@example.com",
      address: "1 Test Road",
      city: "Jaipur",
      pincode: "302001",
    },
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    paymentStatus: "paid",
    paymentMethod: "Razorpay",
    paymentDetails: { amount: 100 },
    total: 100,
  };

  const returnItem = {
    name: "Test vase",
    quantity: 1,
    fulfillmentStatus: "Delivered",
    returnRequest: { reason: "Damaged <box>" },
  };
  const cancellationItem = {
    name: "Test bowl",
    quantity: 1,
    fulfillmentStatus: "Cancelled",
    cancellationRequest: { reason: "Changed my mind" },
  };

  try {
    await sendOrderRequestEmail(order, returnItem, "return", "requested");
    await sendOrderRequestEmail(
      order,
      cancellationItem,
      "cancellation",
      "approved",
      { refundPending: true },
    );
    await sendOrderRequestEmail(order, returnItem, "return", "rejected");

    const messages = requests
      .filter(({ url }) => url === "https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
      .map(({ body }) =>
        Buffer.from(JSON.parse(body).raw, "base64url").toString("utf8"),
      );

    assert.equal(messages.length, 3);
    assert.match(messages[0], /To: customer@example\.com/);
    assert.match(messages[0], /Return request received/);
    assert.match(messages[0], /Damaged &lt;box&gt;/);
    assert.match(messages[1], /Cancellation request approved/);
    assert.match(messages[1], /Refund status: pending/);
    assert.match(messages[2], /Return request declined/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
