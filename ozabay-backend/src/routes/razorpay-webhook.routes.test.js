import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";

process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
const { default: app } = await import("../app.js");

test("Razorpay webhook validates the signature against the raw request body", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  }));

  const { port } = server.address();
  const body = JSON.stringify({ event: "payment.failed" });
  const endpoint = `http://127.0.0.1:${port}/api/orders/razorpay/webhook`;
  const rejected = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": "invalid",
    },
    body,
  });
  assert.equal(rejected.status, 400);

  const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(body)
    .digest("hex");
  const accepted = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": signature,
    },
    body,
  });
  assert.equal(accepted.status, 200);
});
