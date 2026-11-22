import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";
import app from "../app.js";

test("vendor support unread-count route is registered", async (t) => {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  }));

  const { port } = server.address();
  const response = await fetch(
    `http://127.0.0.1:${port}/api/vendor/support/unread-count`,
  );
  assert.equal(response.status, 401, await response.text());
});
