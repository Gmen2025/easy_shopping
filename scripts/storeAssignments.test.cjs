const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function fixture(order) {
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
    "../../assets/common/storefront": { storeRequest: (...args) => { calls.push(args); return request(...args); } },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, Date, require: (name) => dependencies[name] }, { filename });
  const render = () => {
    stateIndex = 0;
    const list = exports.default();
    return list.props.renderItem({ item: order });
  };
  const text = (node) => typeof node === "string" || typeof node === "number" ? String(node) : Array.isArray(node)
    ? node.map(text).join("") : text(node?.props?.children || []);
  const nodes = (node) => !node || typeof node !== "object" ? []
    : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
  const button = (label) => nodes(render()).find((node) => node.type === "TouchableOpacity" && text(node) === label);
  return { calls, alerts, render, text, button, setRequest: (value) => { request = value; } };
}

const fallbackOrder = () => ({
  _id: "order123456", fallbackStore: { _id: "default-store", name: "Default store", address: "Pickup" },
  fulfillmentStatus: "unassigned", fulfillmentDeadline: null,
  orderItems: [{ _id: "line", quantity: 2, unitPrice: 10, product: { name: "Coffee" } }],
  itemsSubtotal: 20,
});

test("default-store fallback cards have Claim, Reroute and final Reject without an expired deadline", () => {
  const f = fixture(fallbackOrder());
  assert.equal(f.button("Claim & prepare").props.disabled, false);
  assert.ok(f.button("Reroute"));
  assert.ok(f.button("Reject"));
  assert.match(f.text(f.render()), /awaiting a decision \(no expiry\)/);
  assert.match(f.text(f.render()), /Default store/);
  assert.match(f.text(f.render()), /2 x Coffee - \$10/);
});

test("ordinary timed assignments still disable acceptance at the deadline", () => {
  const f = fixture({ ...fallbackOrder(), fallbackStore: null, fulfillmentStatus: "pending", fulfillmentDeadline: new Date(0) });
  assert.equal(f.button("Accept & prepare").props.disabled, true);
  assert.equal(f.button("Reroute"), undefined);
});

test("fallback claim guards duplicate taps and uses the authenticated store assignment API", async () => {
  const f = fixture(fallbackOrder());
  let release;
  f.setRequest((resource) => resource.endsWith("/accept")
    ? new Promise((resolve) => { release = resolve; }) : Promise.resolve([]));
  const button = f.button("Claim & prepare");
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
  assert.match(f.alerts[0][1], /Admin to cancel or delete/);
  await f.alerts[0][2].find((option) => option.text === "Reject").onPress();
  assert.equal(f.calls[2][0], "me/assignments/order123456/reject");
});
