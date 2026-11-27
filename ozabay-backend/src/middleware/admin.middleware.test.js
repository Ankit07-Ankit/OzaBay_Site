import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { test } from "node:test";

process.env.MONGO_URI ??= "mongodb://127.0.0.1/test";
process.env.JWT_SECRET = "admin-middleware-test-secret";
process.env.GOOGLE_CLIENT_ID ??= "admin-middleware-test-client";
process.env.GOOGLE_CLIENT_SECRET ??= "admin-middleware-test-client-secret";
process.env.GOOGLE_REFRESH_TOKEN ??= "admin-middleware-test-refresh-token";
process.env.GOOGLE_USER ??= "admin-middleware-test@example.com";

const [{ default: AdminSession }, { default: requireAdmin }] = await Promise.all([
  import("../models/admin-session.model.js"),
  import("./admin.middleware.js"),
]);

test("admin middleware accepts a bearer token when the cross-origin cookie is unavailable", async (t) => {
  const sessionId = "admin-session-test-id";
  const findSession = t.mock.method(AdminSession, "findOne", async () => ({
    _id: sessionId,
    email: "admin-test@example.com",
  }));
  const token = jwt.sign(
    {
      admin: true,
      email: "admin-test@example.com",
      adminSessionId: sessionId,
    },
    process.env.JWT_SECRET,
    { expiresIn: "1h" },
  );
  const req = {
    cookies: {},
    get: (name) => name === "authorization" ? `Bearer ${token}` : undefined,
  };
  let nextCalled = false;

  await requireAdmin(req, {}, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(req.adminEmail, "admin-test@example.com");
  assert.equal(findSession.mock.calls.length, 1);
});
