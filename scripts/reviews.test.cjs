const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load(file, dependencies, globals = {}) {
  const filename = path.join(__dirname, "..", file);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, console, ...globals, require(name) {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
function nodes(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}
function text(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  return text(value?.props?.children || []);
}
function harness(file, overrides = {}, initialProps = {}) {
  const values = [], effects = [], timers = [], calls = [];
  let cursor = 0, settings = { products: true, deliveries: true, rides: true, services: true }, database = "E_Shopping";
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const at = cursor++;
      if (!(at in values)) values[at] = typeof initial === "function" ? initial() : initial;
      return [values[at], (value) => { values[at] = typeof value === "function" ? value(values[at]) : value; }];
    },
    useRef(initial) { const at = cursor++; if (!(at in values)) values[at] = { current: initial }; return values[at]; },
    useEffect: (effect) => effects.push(effect),
    useCallback: (callback) => callback,
    useContext: () => ({ settings }),
  };
  const component = load(file, {
    react, "react-native": { View: "View", Text: "Text", Image: "Image", ActivityIndicator: "ActivityIndicator" },
    "react-native-paper": { Button: "Button", TextInput: "TextInput" },
    "@react-navigation/native": { useFocusEffect: (effect) => effects.push(effect) },
    "../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => database },
    "../assets/common/reviews": {
      ReviewAvailabilityContext: {}, reviewFeature: { product: "products", delivery: "deliveries", rideDriver: "rides", rideCustomer: "rides", service: "services" },
      reviewError: (error) => error.response?.data?.message || error.message,
      reviewQuery: () => "context",
      reviewRequest: async (route, options) => {
        calls.push({ route, options });
        return overrides.reviewRequest ? overrides.reviewRequest(route, options) : { review: null };
      },
    },
    "../assets/common/rides": { rideRequest: async (route, options) => {
      calls.push({ route, options });
      return overrides.rideRequest ? overrides.rideRequest(route, options) : { prompted: false, profilePhotoUrl: "" };
    } },
    "../assets/common/baseUrl": { __esModule: true, default: "https://api.example.test/api/v1/" },
    "@react-native-async-storage/async-storage": { getItem: async () => "token" },
    "expo-image-picker": {
      CameraType: { front: "front" },
      requestCameraPermissionsAsync: async () => ({ granted: overrides.cameraGranted !== false }),
      requestMediaLibraryPermissionsAsync: async () => ({ granted: true }),
      launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: "file:///photo.jpg", mimeType: "image/jpeg" }] }),
      launchImageLibraryAsync: async () => ({ canceled: false, assets: [{ uri: "file:///photo.jpg", mimeType: "image/jpeg" }] }),
    },
    "./CloudinaryUploader": { __esModule: true, default: {
      getSignature: async (url) => { calls.push({ signature: url }); return {}; },
      uploadToCloudinary: async () => ({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1/photo.jpg" }),
    } },
  }, { setInterval: (callback) => { timers.push(callback); return timers.length; }, clearInterval() {} }).default;
  const render = () => { cursor = 0; effects.length = 0; return component(initialProps); };
  const settle = async () => { for (let i = 0; i < 5; i++) await new Promise(setImmediate); };
  const refresh = async () => { render(); effects.forEach((effect) => effect()); await settle(); };
  const button = (label) => nodes(render()).find((node) => node.type === "Button" && text(node) === label);
  return { render, refresh, settle, calls, button, timers, setSettings: (value) => { settings = value; }, setDatabase: (value) => { database = value; } };
}

test("review client validates all four switches instead of silently defaulting on malformed data", async () => {
  let result = { products: true, deliveries: false, rides: true, services: false };
  const helpers = load("assets\\common\\reviews.js", {
    react: { createContext: (value) => value },
    "./storefront": { apiRequest: async () => result },
  });
  assert.equal((await helpers.reviewRequest("settings")).rides, true);
  assert.equal(helpers.productRating({ rating: 1, numReviews: 99, verifiedRating: 4.5, verifiedReviewCount: 2 }), 4.5);
  assert.equal(helpers.productReviewCount({ numReviews: 99, verifiedReviewCount: 2 }), 2);
  result = { products: true };
  await assert.rejects(helpers.reviewRequest("settings"), /could not be verified/);
  assert.match(helpers.reviewQuery("product", "order a", "coffee/one"), /transaction=order%20a&product=coffee%2Fone/);
});

test("completed transaction panel sends whole stars, optional text and the exact review identity", async () => {
  const h = harness("Shared\\ReviewPanel.js", { reviewRequest: async (route, options) => route === ""
    ? { review: { ...options.data, dateCreated: new Date().toISOString() } } : { review: null } },
  { kind: "product", transaction: "order", product: "coffee", title: "Review coffee" });
  await h.refresh();
  h.button("Review coffee").props.onPress();
  await h.refresh();
  assert.equal(h.button("Submit review").props.disabled, true);
  h.button("5").props.onPress();
  nodes(h.render()).find((node) => node.type === "TextInput").props.onChangeText("Great coffee");
  await h.button("Submit review").props.onPress();
  const submitted = h.calls.find((entry) => entry.options?.method === "post");
  assert.equal(JSON.stringify(submitted.options.data), JSON.stringify({ kind: "product", transaction: "order", product: "coffee", rating: 5, comment: "Great coffee" }));
  assert.match(text(h.render()), /Your review: 5\/5/);
  assert.equal(h.button("Submit review"), undefined);
});

test("availability hides the review panel and a cross-region submission is blocked with an explicit error", async () => {
  const h = harness("Shared\\ReviewPanel.js", {}, { kind: "rideDriver", transaction: "ride", title: "Review driver" });
  await h.refresh(); h.button("Review driver").props.onPress(); await h.refresh();
  h.button("4").props.onPress();
  h.setDatabase("E_ShopUSA");
  await h.button("Submit review").props.onPress();
  assert.match(text(h.render()), /Region changed/);
  assert.equal(h.calls.some((call) => call.options?.method === "post"), false);
  h.setSettings({ rides: false });
  assert.equal(h.render(), null);
});

test("duplicate or disabled submissions show server errors and do not pretend to save feedback", async () => {
  const h = harness("Shared\\ReviewPanel.js", { reviewRequest: async (route) => {
    if (!route) throw Object.assign(new Error("already reviewed"), { response: { status: 409, data: { message: "You already reviewed this transaction." } } });
    return { review: null };
  } }, { kind: "service", transaction: "service", title: "Review service" });
  await h.refresh(); h.button("Review service").props.onPress(); await h.refresh();
  h.button("3").props.onPress(); await h.button("Submit review").props.onPress();
  assert.match(text(h.render()), /already reviewed/);
  assert.doesNotMatch(text(h.render()), /Your review:/);
});

test("customer photo prompt permits skipping and never uploads without user action", async () => {
  const h = harness("Shared\\RideCustomerPhoto.js", { rideRequest: async (route, options) =>
    ({ prompted: options?.data?.skip === true, profilePhotoUrl: "" }) });
  await h.refresh();
  assert.match(text(h.render()), /You may skip/);
  assert.equal(h.calls.some((call) => call.signature), false);
  await h.button("Skip for now").props.onPress();
  assert.equal(JSON.stringify(h.calls.at(-1).options.data), '{"skip":true}');
  assert.equal(h.button("Skip for now"), undefined);
});

test("camera photos use the authorized signer and camera denial remains explicit without saving", async () => {
  const h = harness("Shared\\RideCustomerPhoto.js", { rideRequest: async (route, options) =>
    ({ prompted: Boolean(options), profilePhotoUrl: options?.data?.profilePhotoUrl || "" }) });
  await h.refresh();
  await h.button("Take photo").props.onPress();
  assert.match(h.calls.find((call) => call.signature).signature, /cloudinary\/sign$/);
  assert.match(h.calls.at(-1).options.data.profilePhotoUrl, /photo.jpg$/);
  const denied = harness("Shared\\RideCustomerPhoto.js", { cameraGranted: false });
  await denied.refresh(); await denied.button("Take photo").props.onPress();
  assert.match(text(denied.render()), /Allow photo access/);
  assert.equal(denied.calls.some((call) => call.options?.method === "put"), false);
});

test("all new review surfaces compile with the installed Expo preset", () => {
  for (const file of ["Shared\\ReviewPanel.js", "Shared\\ReviewAvailabilityProvider.js", "Shared\\RideCustomerPhoto.js",
    "Shared\\RideParticipantProfile.js", "Screens\\Admin\\ReviewSettings.js", "Screens\\Products\\AdvancedFilters.js"]) {
    const filename = path.join(__dirname, "..", file);
    assert.ok(babel.transformSync(fs.readFileSync(filename, "utf8"), { filename, presets: ["babel-preset-expo"] }).code);
  }
});
