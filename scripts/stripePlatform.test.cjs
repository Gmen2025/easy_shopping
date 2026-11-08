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
