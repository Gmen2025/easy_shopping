const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function fixture(order, party = "customer") {
  const filename = path.join(__dirname, "..", "Shared", "PickupConfirmation.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const states = [], calls = [];
  let cursor = 0, reloads = 0, failure = "";
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = { current: initial };
      return states[index];
    },
  };
  const dependencies = {
    react, "react-native": { Text: "Text", View: "View" }, "react-native-paper": { Button: "Button", TextInput: "TextInput" },
    "../assets/common/rides": { addressText: (address) => [address?.address1, address?.city].filter(Boolean).join(", ") },
    "../assets/common/storefront": { storeRequest: async (...args) => { calls.push(args); if (failure) throw new Error(failure); } },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => { assert.ok(name in dependencies, name); return dependencies[name]; } });
  const render = () => { cursor = 0; return exports.default({ order, party, onSaved: async () => { reloads++; } }); };
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const text = (node) => typeof node === "string" ? node : Array.isArray(node) ? node.map(text).join("") : text(node?.props?.children || []);
  const button = () => nodes(render()).find((node) => node.type === "Button");
  const input = () => nodes(render()).find((node) => node.type === "TextInput");
  return { render, text, calls, button, input, reloads: () => reloads, fail: (message) => { failure = message; } };
}

test("mobile customer/operator collection shows the address, validates notes, surfaces payment errors and prevents duplicate taps", async () => {
  for (const party of ["customer", "operator"]) {
    const order = { _id: "order", checkoutGroup: "checkout", fulfillmentMethod: "pickup",
      pickupAddress: { address: "Store collection street" } };
    const f = fixture(order, party);
    assert.match(f.text(f.render()), /Store collection street/);
    assert.equal(f.button().props.disabled, true);
    f.input().props.onChangeText("  Handover 123  ");
    f.fail("Payment must be verified");
    await f.button().props.onPress();
    assert.match(f.text(f.render()), /Payment must be verified/);
    assert.equal(f.reloads(), 0);
    f.fail("");
    const button = f.button();
    await Promise.all([button.props.onPress(), button.props.onPress()]);
    assert.equal(f.calls.length, 2);
    assert.deepEqual(JSON.parse(JSON.stringify(f.calls.at(-1))), [
      "checkouts/checkout/orders/order/pickup-confirmation", { method: "post", data: { party, note: "Handover 123" } },
    ]);
    assert.equal(f.reloads(), 1);
    order.pickupConfirmation = { [party === "customer" ? "customerAt" : "operatorAt"]: new Date().toISOString() };
    assert.equal(f.button(), undefined);
  }
});

test("mobile international collection waits for Ethiopia arrival and completed collection hides its confirmation button", () => {
  const order = { fulfillmentMethod: "pickup", internationalShipping: { status: "shipped" },
    pickupAddress: { address1: "Bole collection office", city: "Addis Ababa" } };
  const f = fixture(order);
  assert.match(f.text(f.render()), /Bole collection office/);
  assert.match(f.text(f.render()), /Awaiting arrival in Ethiopia/);
  assert.equal(f.button(), undefined);
  order.internationalShipping.status = "arrived_ethiopia";
  assert.ok(f.button());
  order.pickupConfirmation = { customerAt: new Date(), operatorAt: new Date() };
  assert.match(f.text(f.render()), /Collection cross-checked and complete/);
  assert.equal(f.button(), undefined);
});
