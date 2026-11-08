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

test("admin store design preserves scoped refresh, period selection and income navigation", async () => {
  const filename = path.join(__dirname, "..", "Screens", "Admin", "AdminAccount.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const periods = Object.fromEntries(["daily", "weekly", "monthly", "quarterly", "yearly"].map((period, index) =>
    [period, { sales: index + 10, earnings: index + 20, orders: 3, completedOrders: 2, unitsSold: 4,
      averageOrder: 5, reviews: 1, averageRating: 4.5, start: "2026-11-01T06:39:25.021Z", end: "2026-11-08T06:39:25.021Z" }]));
  const data = { periods, products: { total: 5, approved: 4, pending: 1, readyFulfillments: 2 },
    inventory: { unitsInStock: 12 }, orders: { pending: 1 }, activeOrders: [], recentOrders: [] };
  const profile = { account: { _id: "store1", name: "Scoped market" } };
  const values = [];
  let cursor = 0, focus, destination;
  const calls = [];
  const react = {
    createElement: (type, props, ...children) => typeof type === "function" ? type({ ...props, children }) : { type, props: { ...props, children } },
    useState: (initial) => { const index = cursor++; if (!(index in values)) values[index] = initial; return [values[index], (value) => { values[index] = value; }]; },
    useRef: (initial) => { const index = cursor++; if (!(index in values)) values[index] = { current: initial }; return values[index]; },
    useCallback: (fn) => fn,
  };
  const dependencies = {
    react, "react-native": new Proxy({ StyleSheet: { create: (styles) => styles } }, { get: (target, key) => target[key] || key }),
    "react-native-vector-icons/FontAwesome": "Icon",
    "@react-native-picker/picker": { Picker: Object.assign((props) => ({ type: "Picker", props }), { Item: "PickerItem" }) },
    "@react-navigation/native": { useFocusEffect: (callback) => { focus = callback; } },
    "../../assets/common/finance": { financeError: (error) => error.message, operatorRequest: async (url) => {
      calls.push(url); return url.endsWith("/profile") ? profile : data;
    } },
    "../../assets/common/operatorWorkspace": { businessPath: (kind, id, view) => `${kind}/${id}/${view}`, validateBusiness: (value) => value },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(name in dependencies, `Unexpected import: ${name}`); return dependencies[name];
  } });
  const render = () => { cursor = 0; return exports.default({ route: { params: { kind: "store", accountId: "store1" } },
    navigation: { navigate: (...args) => { destination = args; }, goBack() {} } }); };
  render(); focus();
  await new Promise((resolve) => setImmediate(resolve));
  let output = render();
  for (const title of ["Account Business Dashboard", "Scoped market", "Business Performance", "Gross Activity", "Products & Inventory", "Ready fulfillments"]) {
    assert.ok(text(output).includes(title), `Missing section: ${title}`);
  }
  const periodPicker = nodes(output).find((node) => node.props?.accessibilityLabel === "Analytics period");
  assert.equal(periodPicker.props.selectedValue, "weekly");
  periodPicker.props.onValueChange("monthly");
  output = render();
  assert.equal(nodes(output).find((node) => node.props?.accessibilityLabel === "Analytics period").props.selectedValue, "monthly");
  assert.ok(nodes(output).some((node) => node.type === "Text" && text(node) === "12"));
  const income = nodes(output).find((node) => node.type === "TouchableOpacity" && text(node).includes("Products, inventory & income"));
  income.props.onPress();
  assert.equal(destination[0], "IncomeDashboard");
  assert.equal(destination[1].accountId, "store1");
  assert.equal(destination[1].admin, true);
  await nodes(output).find((node) => node.props?.accessibilityLabel === "Refresh dashboard").props.onPress();
  assert.deepEqual(calls, ["store/store1/profile", "store/store1/dashboard", "store/store1/profile", "store/store1/dashboard"]);
});
