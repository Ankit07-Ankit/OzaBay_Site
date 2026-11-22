import assert from "node:assert/strict";
import { before, test } from "node:test";

let sendEmail;

before(async () => {
  process.env.MONGO_URI = "mongodb://127.0.0.1/test";
  process.env.JWT_SECRET = "test-secret";
  process.env.GOOGLE_CLIENT_ID = "test-client-id";
  process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
  process.env.GOOGLE_REFRESH_TOKEN = "test-refresh-token";
  process.env.GOOGLE_USER = "sender@example.com";
  ({ default: sendEmail } = await import("./email.service.js"));
});

test("sends a compiled email through the Gmail HTTPS API", async () => {
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

  try {
    await sendEmail("recipient@example.com", "Test subject", "Text body", "<p>HTML body</p>");

    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, "https://oauth2.googleapis.com/token");
    assert.equal(requests[1].url, "https://gmail.googleapis.com/gmail/v1/users/me/messages/send");
    assert.equal(requests[1].headers.Authorization, "Bearer test-access-token");

    const rawMessage = JSON.parse(requests[1].body).raw;
    const message = Buffer.from(rawMessage, "base64url").toString("utf8");
    assert.match(message, /To: recipient@example\.com/);
    assert.match(message, /Subject: Test subject/);
    assert.match(message, /Text body/);
    assert.match(message, /HTML body/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
