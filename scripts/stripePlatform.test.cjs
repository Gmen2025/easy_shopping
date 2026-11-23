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
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useEffect: () => {},
    useMemo: (factory) => factory(),
    useRef: (value) => ({ current: value }),
    useState: (initial) => [stateIndex++ === 0 ? "pk_test_example" : initial, () => {}],
  };
  const component = load("Shared\\EmbeddedStripePayment.js", {
    react,
    "react-native": { ActivityIndicator: "ActivityIndicator", Alert: { alert: (...args) => alerts.push(args) }, Text: "Text", View: "View" },
    "react-native-paper": { Button: "Button" },
    "expo-constants": { expoConfig: { extra: { stripePublishableKey: "pk_test_example" } } },
    "../assets/common/stripe": { __esModule: true, default: sdk },
  }).default;
  const props = {
    amount: 1250, currency: "usd", label: "Pay",
    createIntent: async () => { created++; return { clientSecret: "secret", paymentId: "pi_test" }; },
    onCompleted: async (payment) => { assert.equal(payment.paymentId, "pi_test"); finished++; },
  };
  const wrapper = component(props);
  stateIndex = 1;
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
  stateIndex = 1;
  const secondView = secondWrapper.type(secondWrapper.props);
  await secondView.props.children.find((child) => child?.type === "Button").props.onPress();
  assert.match(handlerResult.error.message, /no client secret/i);
  assert.equal(finished, 1);
  assert.equal(alerts.length, 1);
});
