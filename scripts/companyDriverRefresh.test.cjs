const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function fixture() {
  const filename = path.join(__dirname, "..", "Screens", "Driver", "CompanyDriverDashboard.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const states = [];
  const refs = [];
  let stateIndex;
  let refIndex;
  let focused;
  const pending = [];
  const alerts = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useContext: () => ({ user: {}, logout: () => {} }),
    useCallback: (fn) => fn,
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = value; }];
    },
    useRef: (initial) => {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
  };
  const dependencies = {
    react,
    "react-native": new Proxy({
      StyleSheet: { create: (styles) => styles },
      Alert: { alert: (...args) => alerts.push(args) },
    }, { get: (target, key) => target[key] || key }),
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@react-navigation/native": { useFocusEffect: (callback) => { focused = callback; } },
    "@react-native-async-storage/async-storage": { getItem: async () => "token" },
    axios: { get: (url, config) => new Promise((resolve, reject) => pending.push({ url, config, resolve, reject })) },
    "../../Context/store/Auth": { AuthContext: {} },
    "../../assets/common/baseUrl": "https://example.invalid/api/",
    "../../assets/common/currency": { useCurrency: () => ({ formatPrice: String }) },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_Shopping" },
    "../../assets/common/delivery": { formatScheduledDeliveryDate: () => "" },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports, console: { warn: () => {} },
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    return exports.default({ navigation: {} });
  };
  const nodes = (value) => !value || typeof value !== "object" ? []
    : Array.isArray(value) ? value.flatMap(nodes)
      : [value, ...nodes(value.props?.children)];
  const button = () => nodes(render()).find((node) =>
    node.type === "TouchableOpacity" && node.props.accessibilityRole === "button");
  return { pending, alerts, button, focus: () => focused() };
}

test("driver refresh is bounded, prevents overlap and becomes available after timeout", async () => {
  const fixtureInstance = fixture();
  const { button, pending, alerts } = fixtureInstance;
  button();
  fixtureInstance.focus();
  await new Promise(setImmediate);
  assert.equal(pending.length, 4);
  for (const request of pending) {
    assert.equal(request.config.timeout, 20000);
    assert.equal(request.config.headers["x-database-name"], "E_Shopping");
  }
  assert.equal(button().props.disabled, true);
  const duplicate = button().props.onPress();
  await duplicate;
  assert.equal(pending.length, 4);
  for (const request of pending) request.reject(new Error("timeout"));
  await new Promise(setImmediate);
  assert.equal(button().props.disabled, false);
  assert.equal(alerts.length, 2);
  const retry = button().props.onPress();
  await new Promise(setImmediate);
  assert.equal(pending.length, 8);
  for (const request of pending.slice(4)) request.resolve({ data: { orders: [], queue: [] } });
  await retry;
  assert.equal(button().props.disabled, false);
});
