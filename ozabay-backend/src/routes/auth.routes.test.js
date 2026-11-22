import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import app from "../app.js";

test("Google sign-in endpoints allow the production Vercel origin", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  }));

  const { port } = server.address();
  const origin = "https://oza-bay-site-iota.vercel.app";
  const preflightResponse = await fetch(
    `http://127.0.0.1:${port}/api/auth/google`,
    {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    },
  );
  assert.equal(preflightResponse.status, 204);
  assert.equal(preflightResponse.headers.get("access-control-allow-origin"), origin);
  assert.equal(preflightResponse.headers.get("access-control-allow-credentials"), "true");

  const response = await fetch(
    `http://127.0.0.1:${port}/api/auth/google/client-id`,
    { headers: { Origin: origin } },
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), origin);
  assert.ok((await response.json()).clientId);
});
