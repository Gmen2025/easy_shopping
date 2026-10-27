const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function fixture(order, { admin = false } = {}) {
  const filename = path.join(__dirname, "..", "Screens", "Store", "StoreAssignments.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const states = [];
  const calls = [];
  const alerts = [];
  const ref = { current: false };
  let stateIndex = 0;
  let request = async () => [];
  const dependencies = {
    react: {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useState: (initial) => {
        const index = stateIndex++;
        if (!(index in states)) states[index] = index === 0 ? [order] : initial;
        return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
      },
      useRef: () => ref,
      useCallback: (callback) => callback,
    },
    "react-native": new Proxy({
      StyleSheet: { create: (styles) => styles },
      Alert: { alert: (...args) => alerts.push(args) },
    }, { get: (target, key) => target[key] || key }),
    "@react-navigation/native": { useFocusEffect: () => {} },
    "../../assets/common/currency": { useCurrency: () => ({ formatPrice: (value) => `$${value}` }) },
    "../../assets/common/storefront": {
      storeRequest: (...args) => { calls.push(args); return request(...args); },
      apiRequest: (...args) => { calls.push(args); return request(...args); },
    },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, Date, require: (name) => dependencies[name] }, { filename });
  const renderList = () => {
    stateIndex = 0;
    return exports.default({ route: { params: { admin } }, navigation: { navigate() {} } });
  };
  const render = () => renderList().props.renderItem({ item: order });
  const text = (node) => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node)
    ? node.map(text).join("") : text(node?.props?.children || []);
  const nodes = (node) => !node || typeof node !== "object" ? []
    : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const button = (label) => nodes(render()).find((node) => node.type === "TouchableOpacity" && text(node) === label);
  const headerButton = (label) => nodes(renderList().props.ListHeaderComponent)
    .find((node) => node.type === "TouchableOpacity" && text(node) === label);
  const input = () => nodes(render()).find((node) => node.type === "TextInput");
  return { calls, alerts, render, text, button, input, headerButton, setRequest: (value) => { request = value; } };
}

const fallbackOrder = () => ({
  _id: "order123456", fallbackStore: { _id: "default-store", name: "Default store", address: "Pickup" },
  fulfillmentStatus: "unassigned", fulfillmentDeadline: null,
  orderItems: [{ _id: "line", quantity: 2, unitPrice: 10, product: { name: "Coffee" } }],
  itemsSubtotal: 20,
});

test("default-store fallback cards have Claim, Reroute and final Reject without an expired deadline", () => {
  const f = fixture(fallbackOrder());
  assert.equal(f.button("Claim order").props.disabled, false);
  assert.ok(f.button("Reroute"));
  assert.ok(f.button("Reject"));
  assert.match(f.text(f.render()), /awaiting a decision \(no expiry\)/);
  assert.match(f.text(f.render()), /Default store/);
  assert.match(f.text(f.render()), /2 x Coffee - \$10/);
});

test("ordinary timed assignments still disable acceptance at the deadline", () => {
  const f = fixture({ ...fallbackOrder(), fallbackStore: null, fulfillmentStatus: "pending", fulfillmentDeadline: new Date(0) });
  assert.equal(f.button("Accept order").props.disabled, true);
  assert.equal(f.button("Reroute"), undefined);
});

test("fallback claim guards duplicate taps and uses the authenticated store assignment API", async () => {
  const f = fixture(fallbackOrder());
  let release;
  f.setRequest((resource) => resource.endsWith("/accept")
    ? new Promise((resolve) => { release = resolve; }) : Promise.resolve([]));
  const button = f.button("Claim order");
  const claim = button.props.onPress();
  await button.props.onPress();
  assert.equal(f.calls.length, 1);
  assert.equal(f.button("Reroute").props.disabled, true);
  release({ success: true });
  await claim;
  assert.deepEqual(f.calls.map(([resource]) => resource), ["me/assignments/order123456/accept", "me/assignments"]);
});

test("fallback reroute is distinct from final rejection, which requires confirmation", async () => {
  const f = fixture(fallbackOrder());
  await f.button("Reroute").props.onPress();
  assert.equal(f.calls[0][0], "me/assignments/order123456/reroute");
  f.button("Reject").props.onPress();
  assert.match(f.alerts[0][1], /Admin to claim, reroute/);
  await f.alerts[0][2].find((option) => option.text === "Reject").onPress();
  assert.equal(f.calls[2][0], "me/assignments/order123456/reject");
});

test("claiming stays separate from preparation; marking ready automatically enables single-package dispatch", async () => {
  const order = { ...fallbackOrder(), storeRouteVersion: 1, deliveryStatus: "Pending" };
  const f = fixture(order);
  f.setRequest(async (resource) => {
    if (resource.endsWith("/accept")) {
      order.fallbackStore = null;
      order.store = "store1";
      order.fulfillmentStatus = "accepted";
    }
    if (resource.endsWith("/ready")) order.storeReadyAt = new Date().toISOString();
    return resource === "me/assignments" ? [order] : { success: true };
  });
  assert.equal(f.headerButton("Dispatch selected (0)").props.disabled, true);
  await f.button("Claim order").props.onPress();
  assert.equal(f.headerButton("Dispatch selected (0)").props.disabled, true);
  assert.match(f.text(f.render()), /Claimed - prepare the package/);
  assert.equal(f.button("Select for dispatch"), undefined);
  await f.button("Mark package ready").props.onPress();
  assert.equal(f.headerButton("Dispatch selected (1)").props.disabled, false);
  assert.ok(f.button("Selected"));
  f.button("Selected").props.onPress();
  assert.equal(f.headerButton("Dispatch selected (0)").props.disabled, true);
  f.button("Select for dispatch").props.onPress();
  await f.headerButton("Dispatch selected (1)").props.onPress();
  assert.equal(f.calls[4][0], "me/dispatch-batches");
  assert.equal(JSON.stringify(f.calls[4][1].data), JSON.stringify({ orderIds: [order._id] }));
  assert.match(f.alerts[0][1], /stay queued if no driver/);
});

test("failed preparation never selects a package or enables dispatch", async () => {
  const order = { ...fallbackOrder(), fallbackStore: null, storeRouteVersion: 1, store: "store1",
    fulfillmentStatus: "accepted", deliveryStatus: "Pending" };
  const f = fixture(order);
  f.setRequest(async () => { throw new Error("Package changed. Refresh assignments."); });
  await f.button("Mark package ready").props.onPress();
  assert.equal(f.headerButton("Dispatch selected (0)").props.disabled, true);
  assert.equal(f.button("Select for dispatch"), undefined);
  assert.equal(f.alerts[0][1], "Package changed. Refresh assignments.");
});

test("released packages show their durable batch and cannot be released again; failed release is explicit", async () => {
  const order = { ...fallbackOrder(), fallbackStore: null, storeRouteVersion: 1,
    fulfillmentStatus: "accepted", storeReadyAt: new Date().toISOString(), storeDispatchBatch: "batch1" };
  const released = fixture(order);
  assert.equal(released.button("Select for dispatch"), undefined);
  assert.match(released.text(released.render()), /Dispatched batch: batch1/);
  const pending = fixture({ ...order, storeDispatchBatch: null });
  pending.button("Select for dispatch").props.onPress();
  pending.setRequest(async () => { throw new Error("Capacity changed"); });
  await pending.headerButton("Dispatch selected (1)").props.onPress();
  assert.deepEqual(pending.alerts[0], ["Dispatch failed", "Capacity changed"]);
  assert.ok(pending.button("Selected"), "Failed release keeps the selection for retry");
});

test("Admin can claim rejected requests, reroute, then prepare and dispatch using Admin endpoints", async () => {
  const order = { ...fallbackOrder(), fallbackStore: null, storeRouteVersion: 1, adminReviewRequired: "store" };
  const f = fixture(order, { admin: true });
  assert.match(f.text(f.render()), /Rejected - Admin review/);
  await f.button("Claim for assigned/default store").props.onPress();
  assert.equal(f.calls[0][0], "admin/assignments/order123456/accept");
  await f.button("Admin reroute").props.onPress();
  assert.equal(f.calls[2][0], "admin/assignments/order123456/reroute");
  const accepted = fixture({ ...order, adminReviewRequired: undefined, fulfillmentStatus: "accepted", store: "default-store" }, { admin: true });
  const prepared = { ...order, adminReviewRequired: undefined, fulfillmentStatus: "accepted", store: "default-store",
    storeReadyAt: new Date().toISOString() };
  accepted.setRequest(async (resource) => resource === "admin/assignments" ? [prepared] : { success: true });
  await accepted.button("Mark package ready").props.onPress();
  assert.equal(accepted.calls[0][0], "admin/assignments/order123456/ready");
  assert.equal(accepted.headerButton("Dispatch selected (1)").props.disabled, false);
  const ready = fixture({ ...order, adminReviewRequired: undefined, fulfillmentStatus: "accepted", store: "default-store",
    storeReadyAt: new Date().toISOString() }, { admin: true });
  ready.button("Select for dispatch").props.onPress();
  await ready.headerButton("Dispatch selected (1)").props.onPress();
  assert.equal(ready.calls[0][0], "admin/dispatch-batches");
});

test("Admin deletion is confirmed and surfaces payment/refund safeguards instead of hiding the request", async () => {
  const order = { ...fallbackOrder(), fallbackStore: null, adminReviewRequired: "store" };
  const f = fixture(order, { admin: true });
  f.setRequest(async () => { throw new Error("Complete the refund before deleting"); });
  f.button("Delete rejected order").props.onPress();
  assert.match(f.alerts[0][1], /reconcile any refund/);
  await f.alerts[0][2].find((item) => item.text === "Delete").onPress();
  assert.equal(f.calls[0][0], "orders");
  assert.equal(f.calls[0][1], order._id);
  assert.equal(f.calls[0][2].method, "delete");
  assert.equal(f.alerts[1][1], "Complete the refund before deleting");
  assert.ok(f.button("Delete rejected order"));
});

test("a claimed package can reroute before dispatch without requesting Admin review", async () => {
  const f = fixture({ ...fallbackOrder(), fallbackStore: null, fulfillmentStatus: "accepted",
    store: "default-store", storeRouteVersion: 1, storeReadyAt: new Date().toISOString() });
  f.button("Select for dispatch").props.onPress();
  await f.button("Reroute").props.onPress();
  assert.equal(f.calls[0][0], "me/assignments/order123456/reroute");
  assert.equal(f.headerButton("Dispatch selected (0)").props.disabled, true);
  assert.equal(f.button("Delete rejected order"), undefined);
  assert.equal(f.button("Admin reroute"), undefined);
});

test("dispatching stores can reoffer a rejected batch and Admin can assign it to an offline driver", async () => {
  const order = { ...fallbackOrder(), fallbackStore: null, storeRouteVersion: 1, store: "store1",
    fulfillmentStatus: "accepted", deliveryStatus: "Pending", storeDispatchBatch: "batch1",
    companyDriverResponses: [{ driver: "driver1", status: "rejected", action: "reject" }] };
  const owner = fixture(order);
  assert.match(owner.text(owner.render()), /Driver rejection - Admin review/);
  owner.button("Reroute to another driver").props.onPress();
  await owner.alerts[0][2].find((item) => item.text === "Reroute").onPress();
  assert.equal(owner.calls[0][0], "me/assignments/order123456/drivers/reroute");
  assert.equal(owner.button("Admin assign / dispatch to driver"), undefined);
  const admin = fixture(order, { admin: true });
  assert.equal(admin.button("Admin assign / dispatch to driver").props.disabled, true);
  admin.input().props.onChangeText("  driver2  ");
  admin.button("Admin assign / dispatch to driver").props.onPress();
  await admin.alerts[0][2].find((item) => item.text === "Assign").onPress();
  assert.equal(admin.calls[0][0], "admin/assignments/order123456/drivers/assign");
  assert.equal(admin.calls[0][1].data.driverId, "driver2");
  const pickedUp = fixture({ ...order, deliveryStatus: "Picked Up" }, { admin: true });
  assert.equal(pickedUp.button("Reroute to another driver"), undefined);
  assert.equal(pickedUp.input(), undefined);
});

test("older accepted orders explain missing controls and explicitly upgrade before marking ready", async () => {
  for (const admin of [false, true]) {
    const scope = admin ? "admin" : "me";
    const order = { ...fallbackOrder(), fallbackStore: null, store: "store1",
      fulfillmentStatus: "accepted", deliveryStatus: "Pending" };
    const f = fixture(order, { admin });
    assert.equal(f.button("Mark package ready"), undefined);
    assert.match(f.text(f.render()), /older delivery workflow/);
    assert.equal(f.button("Enable store preparation").props.disabled, true);
    f.button("Use car").props.onPress();
    assert.equal(f.button("Enable store preparation").props.disabled, false);
    f.setRequest(async (resource) => {
      if (resource.endsWith("/enable-preparation")) {
        order.storeRouteVersion = 1;
        order.requiredVehicle = "car";
      }
      if (resource.endsWith("/ready")) order.storeReadyAt = new Date().toISOString();
      return resource === `${scope}/assignments` ? [order] : { success: true };
    });
    f.button("Enable store preparation").props.onPress();
    assert.equal(f.calls.length, 0, "Upgrading requires confirmation");
    await f.alerts[0][2].find((item) => item.text === "Enable").onPress();
    assert.equal(f.calls[0][0], `${scope}/assignments/order123456/enable-preparation`);
    assert.equal(f.calls[0][1].data.vehicle, "car");
    assert.equal(f.button("Enable store preparation"), undefined);
    assert.ok(f.button("Mark package ready"));
    assert.equal(f.headerButton("Dispatch selected (0)").props.disabled, true);
    await f.button("Mark package ready").props.onPress();
    assert.equal(f.headerButton("Dispatch selected (1)").props.disabled, false);
  }
});

test("older assigned deliveries cannot upgrade and failed upgrades keep preparation controls gated", async () => {
  const order = { ...fallbackOrder(), fallbackStore: null, store: "store1", requiredVehicle: "car",
    fulfillmentStatus: "accepted", deliveryStatus: "Pending" };
  const assigned = fixture({ ...order, driver: "driver1" });
  assert.equal(assigned.button("Enable store preparation"), undefined);
  const f = fixture(order);
  assert.equal(f.button("Enable store preparation").props.disabled, false);
  f.setRequest(async () => { throw new Error("All active cart packages must be claimed"); });
  f.button("Enable store preparation").props.onPress();
  await f.alerts[0][2].find((item) => item.text === "Enable").onPress();
  assert.equal(f.button("Mark package ready"), undefined);
  assert.equal(f.alerts[1][1], "All active cart packages must be claimed");
});
