const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load() {
  const filename = path.join(__dirname, "..", "assets", "common", "internationalHub.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const trackingFile = path.join(__dirname, "..", "assets", "common", "orderTracking.js");
  const trackingCode = babel.transformSync(fs.readFileSync(trackingFile, "utf8"), {
    filename: trackingFile, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  }).code;
  const tracking = {};
  vm.runInNewContext(trackingCode, { exports: tracking });
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    if (name === "./orderTracking") return tracking;
    assert.fail(`Unexpected dependency: ${name}`);
  } });
  return exports;
}

const hub = load();

test("driver route uses the actual hub address and recipient pin or address, never an implicit origin", () => {
  const shipment = { pickupFrom: { address: "Bole hub" }, destinationCountry: "Ethiopia",
    recipient: { address1: "Main St", city: "Addis", location: { coordinates: [38.8, 8.98] } } };
  const route = hub.driverDeliveryRoute(shipment);
  assert.equal(route.pickup, "Bole hub, Ethiopia");
  assert.match(route.url, /origin=Bole%20hub%2C%20Ethiopia&destination=8.98%2C38.8&travelmode=driving/);
  shipment.recipient.location = null;
  assert.match(hub.driverDeliveryRoute(shipment).url, /destination=Main%20St%2C%20Addis%2C%20Ethiopia/);
  shipment.pickupFrom.address = "";
  assert.equal(hub.driverDeliveryRoute(shipment).url, "");
  shipment.pickupFrom.address = "Hub";
  shipment.recipient.address1 = "";
  assert.equal(hub.driverDeliveryRoute(shipment).url, "");
});

test("driver card keeps hub pickup and proof confirmation alongside its route", () => {
  const filename = path.join(__dirname, "..", "Screens", "International", "DriverInternationalDeliveries.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  let proof = "";
  const alerts = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: () => [proof, (value) => { proof = value; }],
  };
  const deps = {
    react,
    "react-native": { View: "View", Text: "Text", StyleSheet: { create: (styles) => styles }, Alert: { alert: (...args) => alerts.push(args) } },
    "react-native-paper": { Button: "Button", TextInput: "TextInput" },
    "@react-navigation/native": {},
    "../../assets/common/storefront": {},
    "../../assets/common/internationalHub": hub,
    "../../Shared/InternationalDriverMap": { __esModule: true, default: "InternationalDriverMap" },
  };
  const exports = {};
  vm.runInNewContext(`${code}\nexports.DeliveryCard = DeliveryCard;`, { exports, require: (name) => {
    assert.ok(name in deps, `Unexpected dependency: ${name}`);
    return deps[name];
  } });
  const shipment = { trackingCode: "AG-TEST", pickupFrom: { address: "Hub" }, recipient: {}, packages: [], actions: ["pickup"] };
  const calls = [];
  const render = () => exports.DeliveryCard({ shipment, busy: false, act: (...args) => calls.push(args) });
  const nodes = (node) => !node || typeof node !== "object" ? []
    : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const button = (label) => nodes(render()).find((node) => node.type === "Button" && node.props.children.join("").includes(label));
  assert.equal(nodes(render()).find((node) => node.type === "InternationalDriverMap").props.shipment, shipment);
  button("Confirm pickup from hub").props.onPress();
  alerts.pop()[2][1].onPress();
  assert.equal(calls[0][1], "pickup");
  shipment.actions = ["deliver"];
  button("Confirm delivery").props.onPress();
  assert.equal(alerts.pop()[0], "Proof required");
  nodes(render()).find((node) => node.type === "TextInput").props.onChangeText(" Received by Sara ");
  button("Confirm delivery").props.onPress();
  alerts.pop()[2][1].onPress();
  assert.equal(calls[1][1], "deliver");
  assert.equal(calls[1][2].note, "Received by Sara");
});

test("charges payload skips blank rows, totals in cents and keeps the note", () => {
  const { body, total } = hub.chargesPayload([
    { type: "customs_duty", amount: "10.10", label: "" },
    { type: "tariff", amount: " 0.20 ", label: "" },
    { type: "tax", amount: "", label: "" },
    { type: "other", amount: "5", label: " Port fee " },
  ], " Paid at Bole ");
  assert.equal(total, 15.3);
  assert.deepEqual(JSON.parse(JSON.stringify(body)), {
    charges: [
      { type: "customs_duty", amount: "10.10" },
      { type: "tariff", amount: "0.20" },
      { type: "other", amount: "5", label: "Port fee" },
    ],
    note: "Paid at Bole",
  });
  assert.equal(hub.chargesPayload([{ type: "tax", amount: "" }]).total, 0);
});

test("charges payload rejects invalid amounts and unlabeled other costs", () => {
  for (const amount of ["-1", "1.234", "abc"]) {
    assert.throws(() => hub.chargesPayload([{ type: "tax", amount }]), /non-negative number/);
  }
  assert.throws(() => hub.chargesPayload([{ type: "other", amount: "3", label: " " }]), /other related cost/);
  assert.throws(() => hub.chargesPayload([{ type: "other", amount: "", label: "Storage" }]), /non-negative number/);
});

test("payment methods follow the shipment currency and lock to the started method", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(hub.chargeMethods("USD").map((entry) => entry.value))), ["card", "bank"]);
  assert.deepEqual(JSON.parse(JSON.stringify(hub.chargeMethods("etb").map((entry) => entry.value))), ["telebirr", "bank"]);
  assert.deepEqual({ ...hub.chargePaymentState({ status: "awaiting_payment" }) }, { payable: true, started: null });
  assert.deepEqual({ ...hub.chargePaymentState({ status: "awaiting_payment", method: "telebirr" }) }, { payable: true, started: "telebirr" });
  for (const status of ["bank_review", "paid", "waived"]) assert.equal(hub.chargePaymentState({ status }).payable, false);
  assert.equal(hub.chargePaymentState(null).payable, false);
});

test("hub steps walk arrive, charges, customs, release and completion with waiting hints", () => {
  const byKey = (steps) => Object.fromEntries(steps.map((step) => [step.key, step]));
  const shipped = byKey(hub.hubSteps({ status: "shipped", destination: { stage: "in_transit" }, packages: [] }));
  assert.deepEqual([shipped.arrive.state, shipped.charges.state], ["current", "pending"]);
  assert.match(shipped.arrive.hint, /mark it arrived/);

  const legacy = byKey(hub.hubSteps({ status: "arrived_ethiopia", destination: null, packages: [] }));
  assert.equal(legacy.arrive.state, "current");
  assert.match(legacy.arrive.hint, /start hub processing/);

  const inCustoms = byKey(hub.hubSteps({ status: "arrived_ethiopia", destination: { stage: "in_customs" }, packages: [] }));
  assert.deepEqual([inCustoms.arrive.state, inCustoms.charges.state, inCustoms.clear.state], ["done", "current", "pending"]);

  const unpaid = byKey(hub.hubSteps({ status: "arrived_ethiopia",
    destination: { stage: "cleared", charges: { status: "awaiting_payment" } }, packages: [] }));
  assert.deepEqual([unpaid.charges.state, unpaid.clear.state, unpaid.ready.state], ["done", "done", "current"]);
  assert.match(unpaid.ready.hint, /customer to pay/);

  const dispatched = byKey(hub.hubSteps({ status: "arrived_ethiopia",
    destination: { stage: "dispatched", charges: { status: "paid" }, driver: { name: "Abebe" } }, packages: [] }));
  assert.deepEqual([dispatched.ready.state, dispatched.complete.state], ["done", "current"]);
  assert.match(dispatched.complete.hint, /driver to pick up/);

  const delivered = byKey(hub.hubSteps({ status: "delivered",
    destination: { stage: "delivered", charges: { status: "waived" } }, packages: [] }));
  assert.ok(Object.values(delivered).every((step) => step.state !== "current"));
  assert.equal(delivered.complete.state, "done");
});

test("customs collection submits only selected pending packages and rejects stale selections", () => {
  const shipment = { destination: { stage: "in_customs", charges: { status: "paid" } }, packages: [
    { orderId: "one", customsCollected: true },
    { orderId: "two", customsCollected: false },
    { orderId: "three", customsCollected: false },
    { orderId: "cancelled", cancelled: true },
  ] };
  assert.deepEqual(Array.from(hub.pendingCustomsPackages(shipment), (entry) => entry.orderId), ["two", "three"]);
  assert.deepEqual(JSON.parse(JSON.stringify(hub.customsCollectionPayload(shipment, ["three"], " Received one "))),
    { orderIds: ["three"], note: "Received one" });
  assert.deepEqual(JSON.parse(JSON.stringify(hub.customsCollectionPayload(shipment, ["two", "three"]))),
    { orderIds: ["two", "three"] });
  for (const ids of [[], ["one"], ["cancelled"], ["two", "two"], ["missing"]]) {
    assert.throws(() => hub.customsCollectionPayload(shipment, ids), /awaiting customs/);
  }
  const clear = hub.hubSteps(shipment).find((step) => step.key === "clear");
  assert.equal(clear.hint, "1 of 3 active packages collected.");
});

test("inbound hub lets the operator select packages before submitting a partial customs collection", async () => {
  const filename = path.join(__dirname, "..", "Screens", "International", "InboundHub.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const states = [];
  let stateIndex = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useCallback: (fn) => fn,
    useRef: (value) => ({ current: value }),
  };
  const deps = {
    react,
    "react-native": new Proxy({ StyleSheet: { create: (styles) => styles }, Alert: { alert: () => assert.fail("Unexpected alert") } },
      { get: (target, key) => target[key] || key }),
    "react-native-paper": { Button: "Button", TextInput: "TextInput" },
    "@react-navigation/native": { useFocusEffect: () => {} },
    "../../assets/common/storefront": { apiRequest: () => assert.fail("Unexpected request") },
    "../../assets/common/internationalHub": hub,
  };
  const exports = {};
  vm.runInNewContext(`${code}\nexports.ShipmentCard = ShipmentCard;`, { exports, require: (name) => {
    assert.ok(name in deps, `Unexpected dependency: ${name}`);
    return deps[name];
  } });
  const shipment = { shipmentId: "home", actions: ["clear"], destination: { stage: "in_customs" }, packages: [
    { orderId: "one", items: [], customsCollected: true },
    { orderId: "two", items: [{ name: "Shirt", quantity: 1 }] },
    { orderId: "three", items: [{ name: "Shoes", quantity: 1 }] },
    { orderId: "cancelled", items: [], cancelled: true },
  ] };
  const calls = [];
  const render = () => {
    stateIndex = 0;
    return exports.ShipmentCard({ shipment, busy: false, act: async (...args) => { calls.push(args); return true; }, drivers: [] });
  };
  const nodes = (node) => !node || typeof node !== "object" ? []
    : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const button = (text) => nodes(render()).find((node) => node.type === "Button" && node.props.children.join("").includes(text));
  button("Mark collected from customs").props.onPress();
  assert.equal(button("Mark selected packages collected").props.disabled, true);
  const options = nodes(render()).filter((node) => node.props?.accessibilityRole === "checkbox");
  assert.deepEqual(options.map((node) => node.props.accessibilityLabel), ["Select package two", "Select package three"]);
  options[1].props.onPress();
  assert.equal(button("Mark selected packages collected").props.disabled, false);
  button("Mark selected packages collected").props.onPress();
  await new Promise(setImmediate);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], "clear");
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][2])), { orderIds: ["three"] });
});

test("unpaid charges surface only shipments awaiting payment or bank review", () => {
  const shipments = [
    { destination: { charges: { status: "awaiting_payment", total: 150.25, currency: "etb" } } },
    { destination: { charges: { status: "bank_review", total: 10, currency: "etb" } } },
    { destination: { charges: { status: "paid", total: 5, currency: "etb" } } },
    { destination: { charges: { status: "waived", total: 0, currency: "etb" } } },
    { destination: null },
    {},
  ];
  assert.deepEqual(JSON.parse(JSON.stringify(hub.unpaidCharges(shipments).map((charges) => charges.status))), ["awaiting_payment", "bank_review"]);
  assert.equal(hub.unpaidCharges(undefined).length, 0);
});
