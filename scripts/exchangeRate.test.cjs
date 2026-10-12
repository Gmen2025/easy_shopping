const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");
function load(relative, dependencies) {
  const filename = path.join(__dirname, "..", relative);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, console, process: { env: {} }, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name];
  }, setInterval: () => 1, clearInterval() {} });
  return exports;
}
function tree(node) {
  if (!node || typeof node !== "object") return [];
  return Array.isArray(node) ? node.flatMap(tree) : [node, ...tree(node.props?.children)];
}
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return text(node?.props?.children || []);
}
function hooks() {
  const values = []; let cursor = 0; const effects = [];
  const react = {
    createElement: (type, props, ...children) => typeof type === "function" ? type({ ...props, children }) : { type, props: { ...props, children } },
    useState: (initial) => { const index = cursor++; if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (value) => { values[index] = typeof value === "function" ? value(values[index]) : value; }]; },
    useRef: (initial) => { const index = cursor++; if (!(index in values)) values[index] = { current: initial }; return values[index]; },
    useEffect: (fn) => effects.push(fn),
  };
  return { react, effects, reset: () => { cursor = 0; } };
}
test("client rate freshness expires at the exact server boundary and never relabels ETB values", async () => {
  const calls = [];
  const fx = load("assets\\common\\exchangeRate.js", { "./storefront": { apiRequest: (...args) => calls.push(args) } });
  const appliedAt = "2026-06-01T12:00:00Z";
  const expiresAt = "2026-06-02T12:00:00Z";
  const state = { active: true, enabled: true, birrPerUsd: 150, appliedAt, expiresAt };
  assert.equal(fx.rateIsActive(state, +new Date(expiresAt) - 1), true);
  assert.equal(fx.rateIsActive(state, +new Date(expiresAt)), false);
  assert.equal(fx.rateIsActive({ ...state, enabled: false }, +new Date(appliedAt)), false);
  assert.equal(fx.usdAmount(100, 150), 0.67);
  assert.equal(fx.usdText(0.67), "USD $0.67");
  assert.equal(fx.birrAmount(10.03, 150), 1504.5);
  assert.equal(fx.paymentText({ exchangeRate: { direction: "usd-to-etb" }, paymentAmount: 1504.5 }), "ETB 1504.50");
  await fx.exchangeRequest("apply", { method: "post", data: { birrPerUsd: 150 } });
  assert.equal(calls[0][0], "exchange-rate");
  assert.equal(calls[0][1], "apply");
});
test("Admin same-rate Apply remains an explicit action and displays successful update history", async () => {
  const h = hooks(); const calls = []; const alerts = [];
  const fx = load("assets\\common\\exchangeRate.js", { "./storefront": { apiRequest: async () => {} } });
  let config = { active: true, enabled: true, autoRefresh: false, birrPerUsd: 150, revision: 1, source: "manual",
    appliedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString(), providers: [], history: [] };
  const Component = load("Screens\\Admin\\ExchangeRateSettings.js", {
    react: h.react,
    "react-native": { ActivityIndicator: "ActivityIndicator", Alert: { alert: (...args) => alerts.push(args) }, ScrollView: "ScrollView", Text: "Text", View: "View" },
    "react-native-paper": { Button: "Button", Switch: "Switch", TextInput: "TextInput" },
    "@react-native-picker/picker": { Picker: Object.assign((props) => ({ type: "Picker", props }), { Item: "Item" }) },
    "../../assets/common/exchangeRate": { ...fx, exchangeRequest: async (endpoint, options) => {
      calls.push({ endpoint, options });
      if (endpoint === "apply") { config = { ...config, revision: 2, history: [{ birrPerUsd: 150, appliedAt: config.appliedAt, source: "manual", changed: false }] }; }
      return config;
    } },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_Shopping" },
    "../../Shared/DeliveryCheckout": { styles: {} },
  }).default;
  const render = () => { h.reset(); return Component({ navigation: { navigate() {} } }); };
  render(); h.effects[0]();
  for (let index = 0; index < 10; index++) await new Promise((resolve) => setImmediate(resolve));
  const button = tree(render()).find((entry) => entry.type === "Button" && text(entry) === "Apply rate / renew 24 hours");
  assert.equal(button.props.disabled, false);
  await button.props.onPress();
  assert.equal(calls.find((call) => call.endpoint === "apply").options.data.birrPerUsd, "150");
  assert.match(text(render()), /Unchanged rate; update applied/);
  assert.match(text(render()), /Revision: 2/);
  assert.equal(alerts.at(-1)[0], "Rate update applied");
});
test("card checkout explicitly selects the saved USD merchant then restores the normal app key", async () => {
  const h = hooks(); const keys = [];
  const confirmation = () => {};
  const stripe = { CardField: "CardField", useStripe: () => ({ confirmPayment: confirmation }),
    initStripe: async (options) => keys.push(options.publishableKey) };
  const module = load("Shared\\CheckoutCardPayment.js", {
    react: h.react, "react-native": { View: "View", Alert: { alert: () => assert.fail("No alert expected") } },
    "react-native-paper": { Button: "Button" }, "expo-constants": { expoConfig: { extra: { stripePublishableKey: "pk_live_normal" } } },
    "@stripe/stripe-react-native": stripe,
  });
  const render = () => { h.reset(); return module.default({ publishableKey: "pk_live_usd", pay: async (confirm) => assert.equal(confirm, confirmation) }); };
  tree(render()).find((entry) => entry.type === "CardField").props.onCardChange({ complete: true });
  await tree(render()).find((entry) => entry.type === "Button").props.onPress();
  assert.deepEqual(keys, ["pk_live_usd", "pk_live_normal"]);
});
test("Admin US shipping saves the tariff/hub and explicitly controls product export approval", async () => {
  const h = hooks(); const calls = []; const alerts = [];
  const policy = { enabled: false, hub: { label: "US hub", address1: "1 Street", city: "City", zip: "123", country: "USA", phone: "123" },
    baseUsd: 10, perKgUsd: 5, minimumUsd: 15, volumetricDivisor: 5000, maxWeightKg: 100, maxDimensionCm: 200 };
  const Component = load("Screens\\Admin\\InternationalShippingSettings.js", {
    react: h.react, "react-native": { ActivityIndicator: "ActivityIndicator", ScrollView: "ScrollView", Text: "Text", View: "View", Alert: { alert: (...args) => alerts.push(args) } },
    "react-native-paper": { Button: "Button", Switch: "Switch", TextInput: "TextInput" },
    "../../assets/common/storefront": {
      apiRequest: async (resource) => { assert.equal(resource, "products"); return [{ _id: "us-box", name: "US box", exportToEthiopia: false }]; },
      storeRequest: async (path, options) => {
        calls.push({ path, options });
        if (path === "international-products/us-box") return { _id: "us-box", name: "US box", exportToEthiopia: options.data.exportToEthiopia };
        return options?.data || policy;
      },
    },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_ShopUSA" },
    "../../Shared/DeliveryCheckout": { styles: {} },
  }).default;
  const render = () => { h.reset(); return Component({ navigation: { navigate() {} } }); };
  const button = (label) => tree(render()).find((entry) => entry.type === "Button" && text(entry) === label);
  render(); h.effects[0]();
  for (let index = 0; index < 10; index++) await new Promise((resolve) => setImmediate(resolve));
  tree(render()).find((entry) => entry.type === "TextInput" && entry.props.label === "USD per billable kg").props.onChangeText("7.50");
  await button("Save hub & shipping tariff").props.onPress();
  const save = calls.find((entry) => entry.options?.method === "put");
  assert.equal(save.options.data.perKgUsd, "7.50");
  assert.equal(save.options.data.hub.country, "USA");
  assert.equal(alerts.at(-1)[0], "Saved");
  await button("Approve for Ethiopia export").props.onPress();
  assert.equal(calls.at(-1).options.data.exportToEthiopia, true);
  assert.ok(button("Remove export approval"));
});
test("USD entry points, native-currency receipts and service payment recovery are wired", () => {
  const read = (relative) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
  assert.match(read("Navigators\\AdminNavigator.js"), /name="ExchangeRateSettings"/);
  for (const file of ["Navigators\\UserNavigator.js", "Navigators\\CartNavigator.js"]) {
    assert.match(read(file), /name="ServiceUsdCheckout"/);
    assert.match(read(file), /name="DeliveryCheckouts"/);
  }
  assert.match(read("Shared\\OrderCard.js"), /ExchangeReceipt value=\{props.order \|\| props\}/);
  assert.match(read("Screens\\Admin\\BankAccountSettings.js"), /currency: formData.currency/);
  assert.match(read("Navigators\\AdminNavigator.js"), /name="InternationalShippingSettings"/);
  assert.match(read("Shared\\OrderCard.js"), /InternationalReceipt value=\{props.order \|\| props\}/);
});
