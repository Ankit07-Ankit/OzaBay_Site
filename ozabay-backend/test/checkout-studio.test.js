import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const hasMongo = !spawnSync("mongod", ["--version"], { stdio: "ignore" }).error;

test("marketplace checkout and design briefs", { skip: !hasMongo && "requires a local mongod executable" }, async (t) => {
  const reservation = net.createServer().listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  const directory = await mkdtemp(path.join(tmpdir(), "ozabay-test-"));
  const database = spawn("mongod", ["--dbpath", directory, "--bind_ip", "127.0.0.1", "--port", String(port), "--nounixsocket"], { stdio: "ignore" });
  t.after(async () => {
    await mongoose.disconnect();
    if (database.exitCode === null && database.signalCode === null) {
      const exited = once(database, "exit");
      database.kill();
      await exited;
    }
    await rm(directory, { recursive: true, force: true });
  });
  Object.assign(process.env, {
    MONGO_URI: `mongodb://127.0.0.1:${port}/ozabay_test`, JWT_SECRET: "integration-secret",
    GOOGLE_CLIENT_ID: "test-client", GOOGLE_CLIENT_SECRET: "test-client-secret",
    GOOGLE_REFRESH_TOKEN: "test-refresh", GOOGLE_USER: "studio@example.com",
    RAZORPAY_KEY_ID: "test-key", RAZORPAY_KEY_SECRET: "test-secret",
    RAZORPAY_WEBHOOK_SECRET: "test-webhook", ADMIN_EMAIL: "admin@example.com",
    ADMIN_PASSWORD_HASH: bcrypt.hashSync("Admin-Example-Password", 4),
  });
  const { default: app } = await import("../src/app.js");
  const { default: Order } = await import("../src/models/order.model.js");
  const { default: User } = await import("../src/models/user.model.js");
  const { default: VendorProduct } = await import("../src/models/vendor-product.model.js");
  const { razorpayInstance } = await import("../src/controllers/payment.controller.js");
  await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
  await Order.init();

  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const httpFetch = globalThis.fetch;
  // All external calls are fakes. Only HTTP calls to the private test app use the network.
  t.mock.method(globalThis, "fetch", async () => Response.json({ access_token: "test-token", expires_in: 3600 }));
  const post = (url, body, token) => httpFetch(origin + url, {
    method: "POST", headers: { "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) },
    body: JSON.stringify(body),
  });
  const customer = { name: "Test Customer", email: "buyer@example.com", phone: "9000000000", city: "Jaipur", address: "12 Test Street", pincode: "302001" };
  const password = "Example-Password-2026";
  await User.create({ ...customer, verified: true, password: bcrypt.hashSync(password, 4) });
  const vendor = await User.create({ name: "Test Maker", email: "maker@example.com", accountType: "vendor" });
  const product = await VendorProduct.create({ vendorId: vendor._id, name: "Blue bowl", category: "Ceramics", description: "Handmade test bowl", images: ["/bowl.jpg"], price: 100 });
  const { accessToken } = await (await post("/api/auth/login", { email: customer.email, password })).json();
  assert.ok(accessToken);
  const items = [{ productId: `vendor-${product._id}`, quantity: 2 }];
  const checkout = (paymentMethod) => ({ checkoutAttemptId: randomUUID(), items: structuredClone(items), customer, paymentMethod });
  const submit = (body) => post("/api/orders", body, accessToken);
  const gatewayOrders = new Map();
  const createGateway = t.mock.method(razorpayInstance.orders, "create", async (data) => {
    const gateway = { ...data, id: "order_" + randomUUID() };
    gatewayOrders.set(data.receipt, gateway);
    return gateway;
  });
  t.mock.method(razorpayInstance.orders, "all", async ({ receipt }) => ({ items: [gatewayOrders.get(receipt)].filter(Boolean) }));
  t.mock.method(razorpayInstance.orders, "fetchPayments", async () => ({ items: [] }));

  await t.test("concurrent COD submissions, a lost response and a changed payload", async () => {
    const body = checkout("Cash on delivery");
    const replies = await Promise.all([submit(body), submit(body)]);
    assert.deepEqual(replies.map((reply) => reply.status).sort(), [200, 201]);
    const results = await Promise.all(replies.map((reply) => reply.json()));
    assert.equal(results[0].order._id, results[1].order._id);
    assert.equal((await (await submit(body)).json()).order._id, results[0].order._id);
    assert.equal((await submit({ ...body, items: [{ ...items[0], quantity: 3 }] })).status, 409);
    assert.equal(await Order.countDocuments({ checkoutAttemptId: body.checkoutAttemptId }), 1);
  });

  await t.test("cart and favorites follow the customer into a second session", async () => {
    const login = await post("/api/auth/login", { email: customer.email, password });
    const secondToken = (await login.json()).accessToken;
    const cartItem = { id: items[0].productId, qty: 2, data: { id: items[0].productId, name: product.name, qty: 2 } };
    for (const [type, products] of [["cart", [cartItem]], ["favorites", [cartItem.id]]]) {
      assert.equal((await post("/api/me/products", { type, products }, accessToken)).status, 200);
      const response = await httpFetch(origin + "/api/me/products?type=" + type, { headers: { Authorization: `Bearer ${secondToken}` } });
      assert.equal(response.status, 200);
      const saved = await response.json();
      assert.deepEqual(saved.ids, [cartItem.id]);
      if (type === "cart") assert.equal(saved.products[0].qty, 2);
    }
  });

  await t.test("reopens the original gateway order after a lost provider response", async () => {
    const body = checkout("Razorpay");
    createGateway.mock.mockImplementationOnce(async (data) => {
      gatewayOrders.set(data.receipt, { ...data, id: "order_lost_response" });
      throw new Error("Simulated timeout after provider accepted the order");
    });
    assert.equal((await submit(body)).status, 503);
    const local = await Order.findOne({ checkoutAttemptId: body.checkoutAttemptId });
    await Order.updateOne({ _id: local._id }, { $set: { gatewayClaimUntil: new Date(0) } });
    const retry = await submit(body);
    assert.equal(retry.status, 200);
    const result = await retry.json();
    assert.equal(result.razorpay.orderId, "order_lost_response");
    assert.equal(result.order._id, String(local._id));
  });

  for (const cancelFirst of [true, false]) {
    await t.test(cancelFirst ? "late capture and repeated webhook after cancellation" : "paid order subsequently cancelled", async () => {
      const body = checkout("Razorpay");
      const calls = createGateway.mock.callCount();
      const response = await submit(body);
      assert.equal(response.status, 201);
      const { order, razorpay } = await response.json();
      assert.equal((await (await submit(body)).json()).razorpay.orderId, razorpay.orderId);
      assert.equal(createGateway.mock.callCount(), calls + 1);
      const cancel = () => post(`/api/orders/${order._id}/cancel`, {}, accessToken);
      const payment = { id: "pay_" + randomUUID(), order_id: razorpay.orderId, amount: 20000, currency: "INR", status: "captured" };
      const event = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: payment } } });
      const notify = () => httpFetch(origin + "/api/orders/razorpay/webhook", {
        method: "POST", body: event, headers: { "Content-Type": "application/json", "x-razorpay-signature": createHmac("sha256", "test-webhook").update(event).digest("hex") },
      });
      if (cancelFirst) assert.equal((await cancel()).status, 200);
      assert.equal((await notify()).status, 200);
      if (!cancelFirst) assert.equal((await cancel()).status, 200);
      const saved = await Order.findById(order._id).lean();
      assert.equal(saved.orderStatus, "Cancelled");
      assert.equal(saved.paymentStatus, "paid");
      assert.equal(saved.razorpayPaymentId, payment.id);
      assert.equal(saved.paymentDetails.refundStatus, "pending");
      assert.equal((await notify()).status, 200);
      assert.equal((await Order.findById(order._id)).updatedAt.getTime(), saved.updatedAt.getTime());
    });
  }
  await t.test("regional catalogue IDs cannot become order items", async () => {
    const body = checkout("Cash on delivery");
    body.items[0] = { productId: "1000", quantity: 1 };
    assert.equal((await submit(body)).status, 400);
  });
  await t.test("studio receives the image and the admin can retrieve the brief", async () => {
    const image = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
    const brief = { customer: { ...customer, quantity: 1, approval: "Yes" }, design: { notes: "Keep the glaze blue" } };
    delete brief.customer.pincode;
    const upload = (bytes) => {
      const data = new FormData();
      data.append("brief", JSON.stringify(brief));
      data.append("reference", new Blob([bytes], { type: "image/png" }), "reference.png");
      return httpFetch(origin + "/api/studio-briefs", { method: "POST", body: data });
    };
    assert.equal((await upload(Buffer.from("invalid"))).status, 400);
    const response = await upload(image);
    assert.equal(response.status, 201);
    const { requestId } = await response.json();
    const reference = origin + `/api/admin/studio-briefs/${requestId}/reference`;
    assert.equal((await httpFetch(reference)).status, 401);
    const { adminToken } = await (await post("/api/admin/login", { email: "admin@example.com", password: "Admin-Example-Password" })).json();
    const options = { headers: { Authorization: `Bearer ${adminToken}` } };
    const list = await (await httpFetch(origin + "/api/admin/studio-briefs", options)).json();
    assert.equal(list.briefs[0]._id, requestId);
    assert.equal(list.briefs[0].design.notes, brief.design.notes);
    assert.equal(list.briefs[0].referenceImage, undefined);
    const stored = await httpFetch(reference, options);
    assert.equal(stored.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await stored.arrayBuffer()), image);
  });
});
