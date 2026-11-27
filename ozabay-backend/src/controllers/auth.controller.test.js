import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import { generateKeyPairSync, sign, randomUUID } from "node:crypto";
import { test } from "node:test";

process.env.ADMIN_EMAIL = "admin-test@example.com";
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync("admin-test-password", 4);
process.env.MONGO_URI ??= "mongodb://127.0.0.1/test";
process.env.JWT_SECRET ??= "google-auth-test-secret";
process.env.GOOGLE_CLIENT_ID ??= "google-auth-test-client";
process.env.GOOGLE_CLIENT_SECRET ??= "google-auth-test-client-secret";
process.env.GOOGLE_REFRESH_TOKEN ??= "google-auth-test-refresh-token";
process.env.GOOGLE_USER ??= "google-auth-test@example.com";

const [
  { default: userModel },
  { default: Session },
  { default: AdminSession },
  { login, googleLogin },
] =
  await Promise.all([
    import("../models/user.model.js"),
    import("../models/session.model.js"),
    import("../models/admin-session.model.js"),
    import("./auth.controller.js"),
  ]);

test("regular login authenticates admin credentials and creates an admin session", async (t) => {
  const createSession = t.mock.method(AdminSession, "create", async (data) => ({
    ...data,
    _id: "admin-session-test-id",
  }));
  const findUser = t.mock.method(userModel, "findOne", async () => null);
  const response = {
    cookieName: undefined,
    cookieValue: undefined,
    statusCode: undefined,
    body: undefined,
    cookie(name, value) {
      this.cookieName = name;
      this.cookieValue = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await login(
    {
      body: { email: " ADMIN-TEST@example.com ", password: "admin-test-password" },
      ip: "127.0.0.1",
      get: () => "Admin login test",
    },
    response,
  );

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.admin.email, "admin-test@example.com");
  assert.equal(response.cookieName, "adminToken");
  assert.ok(response.cookieValue);
  assert.equal(createSession.mock.calls.length, 1);
  assert.equal(findUser.mock.calls.length, 0);
});

test("Google sign-in creates a user on first sign-in and authenticates them", async (t) => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const keyId = randomUUID();
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: keyId }))
    .toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    aud: process.env.GOOGLE_CLIENT_ID,
    email: "New.User@example.com",
    email_verified: true,
    exp: now + 300,
    iat: now,
    iss: "https://accounts.google.com",
    name: "New User",
  })).toString("base64url");
  const signingInput = `${header}.${payload}`;
  const credential = `${signingInput}.${sign(
    "RSA-SHA256",
    Buffer.from(signingInput),
    privateKey,
  ).toString("base64url")}`;
  const user = new userModel({
    name: "New User",
    email: "new.user@example.com",
    accountType: "user",
    verified: true,
  });

  t.mock.method(globalThis, "fetch", async () => new Response(
    JSON.stringify({
      keys: [{
        ...publicKey.export({ format: "jwk" }),
        alg: "RS256",
        kid: keyId,
        use: "sig",
      }],
    }),
    { headers: { "cache-control": "max-age=300" } },
  ));
  const upsert = t.mock.method(userModel, "findOneAndUpdate", async () => user);
  t.mock.method(Session.prototype, "save", async function save() {
    return this;
  });

  const response = {
    cookieValue: undefined,
    statusCode: undefined,
    body: undefined,
    cookie(_name, value) {
      this.cookieValue = value;
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };

  await googleLogin(
    {
      body: { credential },
      headers: { "user-agent": "Google auth test" },
      ip: "127.0.0.1",
    },
    response,
  );

  assert.equal(upsert.mock.calls.length, 1);
  assert.deepEqual(upsert.mock.calls[0].arguments[0], {
    email: "new.user@example.com",
  });
  assert.equal(upsert.mock.calls[0].arguments[1].$setOnInsert.verified, true);
  assert.equal(upsert.mock.calls[0].arguments[2].upsert, true);
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.email, "new.user@example.com");
  assert.ok(response.body.accessToken);
  assert.ok(response.cookieValue);
});
