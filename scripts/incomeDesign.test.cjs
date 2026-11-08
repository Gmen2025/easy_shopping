const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function nodes(value) {
  if (!value || typeof value !== "object") return [];
  return Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
}
function text(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  return text(value?.props?.children || []);
}

test("store income UI retains currencies, period totals and confirmed manual payout requests", async () => {
  const filename = path.join(__dirname, "..", "Screens", "Finance", "IncomeDashboard.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const data = {
    account: { _id: "store1", name: "Sample Market", payoutsEnabled: true, isCompanyOwned: false, financeFees: {} },
    balances: ["ETB", "USD"].map((currency) => ({ currency, totalEarned: 100, collected: 80, paidOut: 20, pending: 10, available: 50, cashReceived: 5, shortfall: 0 })),
    periods: Object.fromEntries(["daily", "weekly", "monthly", "quarterly", "yearly"].map((period, i) => [period,
      Object.fromEntries(["ETB", "USD"].map((currency) => [currency, { gross: 100 + i, adduGenetIncome: 10, independentIncome: 90, categories: {} }]))])),
    products: [], inventory: [], locations: [], payouts: [
      { _id: "payout-etb", currency: "ETB", amount: 20, payoutType: "early", status: "pending", dateRequested: "2026-11-01" },
      { _id: "payout-usd", currency: "USD", amount: 7, payoutType: "early", status: "paid", dateRequested: "2026-11-01" },
    ], entries: [], schedule: "Manual payment schedule",
  };
  const values = []; const calls = []; const alerts = [];
  let cursor = 0, focus;
  const react = {
    createElement: (type, props, ...children) => typeof type === "function" ? type({ ...props, children }) : { type, props: { ...props, children } },
    useState: (initial) => { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], (value) => { values[index] = typeof value === "function" ? value(values[index]) : value; }]; },
    useRef: (initial) => { const index = cursor++; if (!(index in values)) values[index] = { current: initial }; return values[index]; },
    useCallback: (fn) => fn, useEffect: () => {},
  };
  const dependencies = {
    react, "react-native-vector-icons/FontAwesome": "Icon",
    "react-native": new Proxy({ StyleSheet: { create: (styles) => styles }, Alert: { alert: (...args) => alerts.push(args) } }, { get: (target, key) => target[key] || key }),
    "@react-native-picker/picker": { Picker: Object.assign((props) => ({ type: "Picker", props }), { Item: "PickerItem" }) },
    "@react-navigation/native": { useFocusEffect: (callback) => { focus = callback; } },
    "expo-crypto": { randomUUID: () => "request-key" },
    "../../assets/common/finance": { financeMoney: (value, currency) => `${currency} ${value.toFixed(2)}`, financeError: (error) => error.message,
      financeRequest: async (url, options) => { calls.push({ url, options }); return options ? { message: "Manual payment requested" } : data; } },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`); return dependencies[name];
  } });
  const render = () => { cursor = 0; return exports.default({ route: { params: { kind: "store" } }, navigation: { navigate() {} } }); };
  render(); focus(); await new Promise((resolve) => setImmediate(resolve));
  let output = render();
  for (const title of ["Store Income & Payouts", "Sample Market", "Lifetime balance (ETB)", "Recent payouts", "Request early payment"]) assert.ok(text(output).includes(title));
  assert.ok(text(output).includes("ETB 101.00"));
  assert.ok(!text(output).includes("USD 7.00"));
  nodes(output).find((node) => node.props?.accessibilityLabel === "Income currency").props.onValueChange("USD");
  nodes(output).find((node) => node.props?.accessibilityLabel === "Income period").props.onValueChange("monthly");
  output = render();
  assert.ok(text(output).includes("USD 102.00"));
  assert.ok(text(output).includes("USD 7.00"));
  assert.ok(!text(output).includes("ETB 20.00"));
  nodes(output).find((node) => node.props?.accessibilityLabel === "Payment amount").props.onChangeText("10.25");
  output = render();
  nodes(output).find((node) => node.props?.accessibilityLabel === "Request early payment").props.onPress();
  assert.equal(calls.length, 1, "No request before explicit confirmation");
  const confirmation = alerts.at(-1);
  assert.match(confirmation[1], /USD 10.25/);
  await confirmation[2].find((button) => button.text === "Request").onPress();
  assert.equal(calls[1].url, "accounts/store/me/payouts");
  assert.equal(calls[1].options.data.amount, 10.25);
  assert.equal(calls[1].options.data.currency, "USD");
  assert.equal(calls[1].options.data.requestKey, "request-key");
  data.account.payoutsEnabled = false;
  assert.equal(nodes(render()).find((node) => node.props?.accessibilityLabel === "Request early payment").props.disabled, true);
});
