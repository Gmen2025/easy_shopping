const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load(relative, dependencies = {}, warnings = []) {
  const filename = path.join(__dirname, "..", relative);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports, process: { env: {} },
    console: { warn: (...args) => warnings.push(args) },
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return typeof dependencies[name] === "function" ? dependencies[name]() : dependencies[name];
    },
  });
  return exports;
}

test("web Stripe bridge has no dependencies and disables native card entry", () => {
  const stripe = load("assets\\common\\stripe.web.js");
  assert.equal(stripe.default, null);
  const card = load("Shared\\CheckoutCardPayment.js", {
    react: {}, "react-native": {}, "react-native-paper": {},
    "expo-constants": { expoConfig: { extra: { stripePublishableKey: "pk_test_example" } } },
    "../assets/common/stripe": stripe,
  });
  assert.equal(card.canPayByCard, false);
  assert.equal(card.nativeCardAvailable, false);
  assert.equal(card.default({}), null);
});

test("native bridge preserves SDK exports in development and release builds", () => {
  const sdk = { StripeProvider: "StripeProvider", CardField: "CardField", useStripe: () => {} };
  const stripe = load("assets\\common\\stripe.js", {
    "expo-constants": { executionEnvironment: "bare" },
    "@stripe/stripe-react-native": sdk,
  });
  assert.equal(stripe.default, sdk);
});

test("Expo Go never loads the native Stripe SDK", () => {
  for (const constants of [{ appOwnership: "expo" }, { executionEnvironment: "storeClient" }]) {
    const stripe = load("assets\\common\\stripe.js", { "expo-constants": constants });
    assert.equal(stripe.default, null);
  }
});

test("missing native SDK reports an explicit warning and disables card entry", () => {
  const warnings = [];
  const stripe = load("assets\\common\\stripe.js", {
    "expo-constants": {},
    "@stripe/stripe-react-native": () => { throw new Error("Native module missing"); },
  }, warnings);
  assert.equal(stripe.default, null);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0].join(" "), /Stripe module unavailable: Native module missing/);
});

test("embedded card confirmation uses the saved intent once and only finalizes a completed payment", async () => {
  const alerts = [];
  let created = 0;
  let finished = 0;
  let handlerResult;
  let paymentStatus = "completed";
  const sdk = {
    initStripe: async () => {},
    useEmbeddedPaymentElement: (config) => ({
      embeddedPaymentElementView: { type: "StripeView", props: {} },
      paymentOption: { label: "Card" }, isLoaded: true, loadingError: null,
      confirm: async () => {
        await config.confirmationTokenConfirmHandler({ id: "ct_fixture" }, (result) => { handlerResult = result; });
        return handlerResult.error ? { status: "failed", error: handlerResult.error } : { status: paymentStatus };
      },
    }),
  };
  let stateIndex = 0;
  const request = {};
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useEffect: () => {},
    useMemo: (factory) => { const value = factory(); return Object.keys(value).length ? value : request; },
    useRef: (value) => ({ current: value }),
    useState: (initial) => {
      const index = stateIndex++;
      return [index === 0 ? "pk_test_example" : index === 2 ? { request, key: "pk_test_example" } : initial, () => {}];
    },
  };
  const component = load("Shared\\EmbeddedStripePayment.js", {
    react,
    "react-native": { ActivityIndicator: "ActivityIndicator", Alert: { alert: (...args) => alerts.push(args) }, Text: "Text", View: "View" },
    "react-native-paper": { Button: "Button" },
    "expo-constants": { expoConfig: { extra: { stripePublishableKey: "pk_test_example" } } },
    "../assets/common/stripe": { __esModule: true, default: sdk },
    "../assets/common/storefront": { apiRequest: async () => ({ mode: "test", publishableKey: "pk_test_example" }) },
  }).default;
  const props = {
    amount: 1250, currency: "usd", label: "Pay", publishableKey: "pk_test_example",
    createIntent: async () => { created++; return { clientSecret: "secret", paymentId: "pi_test" }; },
    onCompleted: async (payment) => { assert.equal(payment.paymentId, "pi_test"); finished++; },
  };
  const wrapper = component(props);
  stateIndex = 3;
  const view = wrapper.type(wrapper.props);
  const button = view.props.children.find((child) => child?.type === "Button");
  assert.equal(button.props.disabled, false);
  await Promise.all([button.props.onPress(), button.props.onPress()]);
  assert.equal(created, 1);
  assert.equal(handlerResult.clientSecret, "secret");
  assert.equal(finished, 1);
  paymentStatus = "canceled";
  await button.props.onPress();
  assert.equal(finished, 1);
  props.createIntent = async () => ({});
  stateIndex = 0;
  const secondWrapper = component(props);
  stateIndex = 3;
  const secondView = secondWrapper.type(secondWrapper.props);
  await secondView.props.children.find((child) => child?.type === "Button").props.onPress();
  assert.match(handlerResult.error.message, /no client secret/i);
  assert.equal(finished, 1);
  assert.equal(alerts.length, 1);
});

test("native embedded payments initialize matching keys and reject stale saved modes", async () => {
  for (const [mode, key, valid, explicitKey] of [
    ["test", "pk_test_server", true], ["live", "pk_live_server", true], ["test", "pk_live_server", false],
    ["test", "pk_test_saved", true, "pk_test_saved"], ["test", "pk_live_saved", false, "pk_live_saved"],
  ]) {
    const values = [], pending = [], initialized = [];
    let cursor = 0;
    const changed = (a, b) => !a || a.length !== b.length || a.some((value, index) => value !== b[index]);
    const react = {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useState: (initial) => {
        const index = cursor++;
        if (!(index in values)) values[index] = initial;
        return [values[index], (value) => { values[index] = value; }];
      },
      useRef: (initial) => { const index = cursor++; if (!(index in values)) values[index] = { current: initial }; return values[index]; },
      useMemo: (factory, deps) => {
        const index = cursor++;
        if (!values[index] || changed(values[index].deps, deps)) values[index] = { deps, value: factory() };
        return values[index].value;
      },
      useEffect: (effect, deps) => {
        const index = cursor++;
        if (!values[index] || changed(values[index], deps)) { values[index] = deps; pending.push(effect); }
      },
    };
    const sdk = { initStripe: async ({ publishableKey }) => initialized.push(publishableKey), useEmbeddedPaymentElement() {} };
    const component = load("Shared\\EmbeddedStripePayment.js", {
      react, "react-native": { ActivityIndicator: "ActivityIndicator", Alert: { alert() {} }, Text: "Text", View: "View" },
      "react-native-paper": { Button: "Button" }, "expo-constants": { expoConfig: { extra: {} } },
      "../assets/common/stripe": { __esModule: true, default: sdk },
      "../assets/common/storefront": { apiRequest: async (resource, route) => {
        assert.equal(resource, "stripe");
        assert.equal(route, explicitKey ? "mode" : "config");
        return { mode, publishableKey: key };
      } },
    }).default;
    const render = () => { cursor = 0; return component({ amount: 100, currency: "USD", publishableKey: explicitKey }); };
    const flush = async () => { while (pending.length) pending.shift()(); await new Promise((resolve) => setImmediate(resolve)); };
    assert.equal(render().type, "ActivityIndicator"); await flush(); render(); await flush();
    const result = render();
    if (valid) {
      assert.deepEqual(initialized, [key]);
      assert.equal(typeof result.type, "function");
    } else {
      assert.equal(result.type, "Text");
      assert.match(result.props.children[0], explicitKey ? /does not match/ : /invalid card payment configuration/);
      assert.deepEqual(initialized, []);
    }
  }
});
