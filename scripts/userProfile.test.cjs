const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");
const root = path.join(__dirname, "..");
const filename = path.join(root, "assets", "common", "profileOrders.js");
const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
  filename, configFile: false, babelrc: false,
  plugins: ["@babel/plugin-transform-modules-commonjs"],
});
const helpers = {};
vm.runInNewContext(code, { exports: helpers });

test("profile includes only the signed-in user's populated or unpopulated orders", () => {
  const orders = [
    { _id: "one", user: { _id: "customer" } },
    { _id: "two", user: "customer" },
    { _id: "three", user: { id: "customer" } },
    { _id: "other", user: { _id: "another-user" } },
    { _id: "missing", user: null },
  ];
  assert.deepEqual(Array.from(helpers.getProfileUserOrders(orders, "customer"), (order) => order._id),
    ["one", "two", "three"]);
  assert.throws(() => helpers.getProfileUserOrders({ message: "error" }, "customer"), /invalid order list/);
});

test("delivered shortcut supports legacy and grouped delivery statuses without cancelled orders", () => {
  const orders = [
    { _id: "legacy", status: "3" },
    { _id: "numeric", status: 3 },
    { _id: "delivery", deliveryStatus: "Delivered" },
    { _id: "completed", fulfillmentStatus: "completed" },
    { _id: "cancelled", status: "3", fulfillmentStatus: "cancelled" },
    { _id: "active", deliveryStatus: "Picked Up" },
  ];
  assert.deepEqual(Array.from(helpers.filterProfileOrders(orders, "delivered"), (order) => order._id),
    ["legacy", "numeric", "delivery", "completed"]);
  assert.deepEqual(Array.from(helpers.filterProfileOrders(orders, "tracking"), (order) => order._id), ["active"]);
  assert.equal(helpers.filterProfileOrders(orders, "all"), orders);
});

test("profile preserves actual contact details, navigation, order cards and explicit loading errors", () => {
  const source = fs.readFileSync(path.join(root, "Screens", "User", "UserProfile.js"), "utf8");
  babel.parseSync(source, { configFile: false, babelrc: false, parserOpts: { plugins: ["jsx"] } });
  for (const route of ["EditProfile", "ServiceRequests", "SecuritySettings", "DeliveryCheckouts"]) {
    assert.ok(source.includes(`"${route}"`), `Missing ${route}`);
  }
  for (const text of ["girmahalie2026@gmail.com", "+251954141473", "https://t.me/BettyT58",
    "https://wa.me/251954141473", "<OrderCard {...order}", "ordersLoading", "ordersError",
    "Retry loading orders", "user?.name", "user?.email", "user?.phone", "await logout()"]) {
    assert.ok(source.includes(text), `Missing ${text}`);
  }
  for (const fake of ["Girma Halie", "support@addugeneteshop.com", "+1 (555)", "manage methods"]) {
    assert.ok(!source.includes(fake), `Reference placeholder leaked: ${fake}`);
  }
});
