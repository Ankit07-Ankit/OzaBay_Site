import assert from "node:assert/strict";
import { test } from "node:test";
import { checkoutAttempt, checkoutFor, normalizeAccount } from "../src/utils/customerSession.js";

test("checkout fields belong to the current customer and reset on sign-out", () => {
  const first = checkoutFor({ accountType: "user", name: "First", email: "first@example.com",
    deliveryLocation: { fullName: "Recipient", mobile: "1234567", address: "First street", city: "Jaipur", pincode: "302001" } });
  assert.equal(first.name, "Recipient");
  assert.equal(checkoutFor(null).address, "");
  const second = checkoutFor({ accountType: "user", name: "Second", email: "second@example.com" });
  assert.equal(second.name, "Second");
  assert.equal(second.email, "second@example.com");
  for (const field of ["phone", "address", "city", "pincode"]) assert.equal(second[field], "");
});

test("legacy and current account IDs have the same storage identity", () => {
  assert.deepEqual(normalizeAccount({ _id: "customer" }), { id: "customer" });
  assert.deepEqual(normalizeAccount({ id: "customer" }), { id: "customer" });
});

test("checkout attempt survives a retry and changes with the customer or payload", async () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  const payload = { items: [{ productId: "product", quantity: 1 }] };
  const original = await checkoutAttempt("first", payload, storage);
  assert.equal(await checkoutAttempt("first", payload, storage), original);
  assert.notEqual(await checkoutAttempt("second", payload, storage), original);
  assert.notEqual(await checkoutAttempt("first", { items: [] }, storage), original);
});

test("cart hydration honors purchases, removals and quantity changes from another device", async () => {
  const { reconcileSavedProducts } = await import("../src/utils/savedProducts.js");
  const baseline = new Map([["ordered", 1], ["updated", 1], ["removed-here", 1]]);
  const local = [{ id: "ordered", qty: 1 }, { id: "updated", qty: 1 }, { id: "guest", qty: 1 }];
  const remote = [{ id: "updated", qty: 2 }, { id: "removed-here", qty: 1 }];
  assert.deepEqual(reconcileSavedProducts(local, remote, baseline), [{ id: "updated", qty: 2 }, { id: "guest", qty: 1 }]);
  assert.deepEqual(reconcileSavedProducts(["save"], ["remote"], new Map()), ["remote", "save"]);
});
