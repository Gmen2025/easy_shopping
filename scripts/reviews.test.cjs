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
      getSignature: async (url, params, options) => {
        calls.push({ signature: url });
        return overrides.getSignature ? overrides.getSignature(url, params, options) : {};
      },
      uploadToCloudinary: overrides.uploadToCloudinary ||
        (async () => ({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1/photo.jpg" })),
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

function reviewTransport() {
  const baseUrl = "https://api.example.test/api/v1/";
  const calls = [], fetchCalls = [];
  const settings = { products: false, deliveries: false, rides: false, services: false };
  let intercept, failure = "", database = "E_ShopUSA";
  const axios = async (config) => {
    const request = await intercept(config);
    calls.push(request);
    const url = new URL(request.url);
    assert.equal(request.headers["x-database-name"], database);
    assert.equal(url.searchParams.get("db"), database);
    if (failure) throw new Error(failure);
    if (url.pathname.endsWith("/reviews/settings")) {
      if (request.method === "put") {
        assert.ok(Object.keys(request.data).length);
        for (const [key, value] of Object.entries(request.data)) {
          assert.ok(key in settings, `Unexpected settings field: ${key}`);
          assert.equal(typeof value, "boolean");
        }
        Object.assign(settings, request.data);
      }
      return { data: { ...settings } };
    }
    if (request.method === "post") return { data: { review: request.data } };
    return { data: { reviews: [] } };
  };
  axios.interceptors = { request: { use: (handler) => { intercept = handler; } } };
  const globals = { global: { fetch: async (url, init) => { fetchCalls.push({ url, init }); return {}; } } };
  const databaseConfig = { getDatabaseNameFromStorage: async () => database };
  load("assets\\common\\attachDatabaseInterceptor.js", {
    axios, "./baseUrl": { __esModule: true, default: baseUrl }, "./databaseConfig": databaseConfig,
  }, globals).attachDatabaseInterceptor();
  const storefront = load("assets\\common\\storefront.js", {
    axios, "./baseUrl": { __esModule: true, default: baseUrl }, "./databaseConfig": databaseConfig,
    "react-redux": { useDispatch() {} }, "../../store/cartSlice": { addToCart() {} },
    "@react-native-async-storage/async-storage": { getItem: async () => "test-token" },
  });
  const helpers = load("assets\\common\\reviews.js", {
    react: { createContext: (value) => value }, "./storefront": storefront,
  });
  return { helpers, calls, fetchCalls, fetch: globals.global.fetch, baseUrl, databaseConfig,
    fail: (message) => { failure = message; }, region: (value) => { database = value; } };
}

test("Admin toggles save every boolean switch through the real request interceptor and retain saved state", async () => {
  const transport = reviewTransport();
  const values = [], effects = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      const at = cursor++;
      if (!(at in values)) values[at] = initial;
      return [values[at], (value) => { values[at] = typeof value === "function" ? value(values[at]) : value; }];
    },
    useRef: (initial) => {
      const at = cursor++;
      if (!(at in values)) values[at] = { current: initial };
      return values[at];
    },
    useEffect: (effect) => effects.push(effect),
  };
  const component = load("Screens\\Admin\\ReviewSettings.js", {
    react, "react-native": { ScrollView: "ScrollView", Switch: "Switch", Text: "Text", View: "View" },
    "react-native-paper": { Button: "Button" }, "@react-native-picker/picker": { Picker: "Picker" },
    "../../assets/common/reviews": transport.helpers,
    "../../assets/common/databaseConfig": transport.databaseConfig,
  }).default;
  const render = () => { cursor = 0; effects.length = 0; return component(); };
  const switches = () => nodes(render()).filter((node) => node.type === "Switch");
  render();
  effects.forEach((effect) => effect());
  for (let at = 0; at < 5; at++) await new Promise(setImmediate);
  const keys = ["products", "deliveries", "rides", "services"];
  for (let at = 0; at < keys.length; at++) {
    assert.equal(switches()[at].props.value, false);
    await switches()[at].props.onValueChange(true);
    assert.equal(switches()[at].props.value, true);
    assert.equal(JSON.stringify(transport.calls.at(-1).data), JSON.stringify({ [keys[at]]: true }));
  }
  await nodes(render()).find((node) => node.type === "Button" && text(node) === "Refresh settings").props.onPress();
  assert.ok(switches().every((node) => node.props.value === true));
  for (let at = 0; at < keys.length; at++) {
    await switches()[at].props.onValueChange(false);
    assert.equal(switches()[at].props.value, false);
    assert.equal(switches().filter((node) => node.props.value).length, keys.length - at - 1);
  }
  transport.fail("Unable to save review settings.");
  await switches()[0].props.onValueChange(true);
  assert.equal(switches()[0].props.value, false);
  assert.match(text(render()), /Unable to save review settings/);
  transport.fail("");
  transport.region("E_Shopping");
  const count = transport.calls.length;
  await switches()[0].props.onValueChange(true);
  assert.equal(transport.calls.length, count);
  assert.match(text(render()), /Region changed/);
});

test("Axios and fetch preserve strict review submission bodies while legacy writes still receive databaseName", async () => {
  const transport = reviewTransport();
  const body = { kind: "product", transaction: "order", product: "coffee", rating: 5, comment: "Great coffee" };
  await transport.helpers.reviewRequest("", { method: "post", data: body });
  assert.equal(JSON.stringify(transport.calls.at(-1).data), JSON.stringify(body));
  for (const route of ["reviews", "reviews/", "reviews/settings?existing=true"]) {
    const data = route.includes("settings") ? { rides: true } : body;
    await transport.fetch(`${transport.baseUrl}${route}`, { method: "PUT", body: JSON.stringify(data) });
    const request = transport.fetchCalls.at(-1);
    assert.equal(request.init.body, JSON.stringify(data));
    assert.equal(request.init.headers["x-database-name"], "E_ShopUSA");
    assert.equal(new URL(request.url).searchParams.get("db"), "E_ShopUSA");
  }
  await transport.fetch(`${transport.baseUrl}users/profile`, { method: "PUT", body: '{"name":"Shopper"}' });
  assert.equal(JSON.parse(transport.fetchCalls.at(-1).init.body).databaseName, "E_ShopUSA");
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

test("ride camera, library and skip complete signing, upload and strict profile saves through the interceptor", async () => {
  const baseUrl = "https://api.example.test/api/v1/";
  const requests = [], saves = [], uploads = [];
  const photoUrl = "https://res.cloudinary.com/demo/image/upload/v1/customer_profiles/photo.jpg";
  let profile = { prompted: false, profilePhotoUrl: "" };
  let intercept;
  const databaseConfig = { getDatabaseNameFromStorage: async () => "E_Shopping" };
  const axios = async (config) => {
    const request = await intercept(config);
    assert.equal(new URL(request.url).pathname, "/api/v1/rides/me/customer-profile");
    assert.equal(request.headers["x-database-name"], "E_Shopping");
    assert.equal(new URL(request.url).searchParams.get("db"), "E_Shopping");
    if (request.method === "put") {
      const body = request.data;
      if (Object.keys(body).some((key) => !["profilePhotoUrl", "skip"].includes(key)) ||
          (body.skip !== true && body.profilePhotoUrl !== photoUrl) ||
          (body.skip === true && body.profilePhotoUrl !== undefined)) {
        throw new Error("Upload a valid profile photo or choose skip.");
      }
      saves.push(body);
      profile = { prompted: true, profilePhotoUrl: body.skip ? profile.profilePhotoUrl : body.profilePhotoUrl };
    }
    return { data: { ...profile } };
  };
  axios.interceptors = { request: { use: (handler) => { intercept = handler; } } };
  const fetch = async (url, init) => {
    if (url === "https://api.cloudinary.com/v1_1/demo/image/upload") {
      uploads.push({ url, init });
      assert.equal(init.body.fields.folder, "customer_profiles");
      assert.equal(init.body.fields.signature, "signed");
      assert.equal(init.body.fields.file.uri, "file:///photo.jpg");
      assert.equal(init.headers, undefined);
      return { ok: true, text: async () => JSON.stringify({ secure_url: photoUrl }) };
    }
    requests.push({ url, init });
    const body = JSON.parse(init.body);
    if (new URL(url).pathname.replace(/\/$/, "") === "/api/v1/rides/me/customer-profile") {
      assert.equal(init.body, '{"skip":true}');
      assert.equal(init.headers["x-database-name"], "E_Shopping");
      assert.equal(new URL(url).searchParams.get("db"), "E_Shopping");
      return { ok: true };
    }
    assert.deepEqual(Object.keys(body), ["folder"]);
    assert.ok(["customer_profiles", "driver_profiles"].includes(body.folder));
    assert.equal(init.headers["x-database-name"], "E_Shopping");
    assert.equal(init.headers.Authorization, "Bearer token");
    assert.equal(new URL(url).searchParams.get("db"), "E_Shopping");
    return { ok: true, json: async () => ({ signature: "signed", api_key: "key", timestamp: 1, cloud_name: "demo" }) };
  };
  const globals = { global: { fetch } };
  load("assets\\common\\attachDatabaseInterceptor.js", {
    axios,
    "./baseUrl": { __esModule: true, default: baseUrl }, "./databaseConfig": databaseConfig,
  }, globals).attachDatabaseInterceptor();
  const storefront = load("assets\\common\\storefront.js", {
    axios, "./baseUrl": { __esModule: true, default: baseUrl }, "./databaseConfig": databaseConfig,
    "react-redux": { useDispatch() {} }, "../../store/cartSlice": { addToCart() {} },
    "@react-native-async-storage/async-storage": { getItem: async () => "token" },
  });
  const { rideRequest } = load("assets\\common\\rides.js", { "./storefront": storefront });
  const uploader = load("Shared\\CloudinaryUploader.js", {
    "react-native": { Platform: { OS: "android" } }, "../assets/common/databaseConfig": databaseConfig,
  }, { fetch: globals.global.fetch, FormData: class {
    constructor() { this.fields = {}; }
    append(key, value) { this.fields[key] = value; }
  } }).default;
  for (const label of ["Take photo", "Choose photo"]) {
    const h = harness("Shared\\RideCustomerPhoto.js", {
      getSignature: uploader.getSignature,
      uploadToCloudinary: uploader.uploadToCloudinary,
      rideRequest,
    });
    await h.refresh();
    await h.button(label).props.onPress();
    assert.equal(requests.at(-1).init.body, '{"folder":"customer_profiles"}');
    assert.equal(JSON.stringify(saves.at(-1)), JSON.stringify({ profilePhotoUrl: photoUrl }));
    assert.equal(nodes(h.render()).find((node) => node.type === "Image").props.source.uri, photoUrl);
    await h.refresh();
    assert.equal(nodes(h.render()).find((node) => node.type === "Image").props.source.uri, photoUrl);
    assert.doesNotMatch(text(h.render()), /Signature request failed|Upload a valid profile photo/);
    assert.equal(h.button("Skip for now"), undefined);
  }
  assert.equal(uploads.length, 2);
  profile = { prompted: false, profilePhotoUrl: "" };
  const skip = harness("Shared\\RideCustomerPhoto.js", { rideRequest });
  await skip.refresh();
  await skip.button("Skip for now").props.onPress();
  assert.equal(JSON.stringify(saves.at(-1)), '{"skip":true}');
  assert.equal(skip.button("Skip for now"), undefined);
  assert.equal(uploads.length, 2);
  for (const suffix of ["", "/", "?existing=true"]) {
    const body = '{"skip":true}';
    await globals.global.fetch(`${baseUrl}rides/me/customer-profile${suffix}`, { method: "PUT", body });
    assert.equal(requests.at(-1).init.body, body);
  }
  await uploader.getSignature(`${baseUrl}cloudinary/sign`, { folder: "driver_profiles" }, { token: "token" });
  assert.equal(requests.at(-1).init.body, '{"folder":"driver_profiles"}');
  for (const suffix of ["", "/", "?existing=true"]) {
    const data = { folder: "customer_profiles" };
    const request = await intercept({ url: `${baseUrl}cloudinary/sign${suffix}`, method: "post", data });
    assert.equal(request.data, data);
    assert.equal(request.headers["x-database-name"], "E_Shopping");
    assert.equal(new URL(request.url).searchParams.get("db"), "E_Shopping");
  }
  const productParams = { folder: "eshop/products", public_id: "coffee" };
  const product = await intercept({ url: `${baseUrl}cloudinary/sign`, method: "post", data: productParams });
  assert.equal(product.data, productParams);
  const legacy = await intercept({ url: `${baseUrl}users/profile`, method: "put", data: { name: "Shopper" } });
  assert.equal(legacy.data.databaseName, "E_Shopping");
});

test("all new review surfaces compile with the installed Expo preset", () => {
  for (const file of ["Shared\\ReviewPanel.js", "Shared\\ReviewAvailabilityProvider.js", "Shared\\RideCustomerPhoto.js",
    "Shared\\RideParticipantProfile.js", "Screens\\Admin\\ReviewSettings.js", "Screens\\Products\\AdvancedFilters.js"]) {
    const filename = path.join(__dirname, "..", file);
    assert.ok(babel.transformSync(fs.readFileSync(filename, "utf8"), { filename, presets: ["babel-preset-expo"] }).code);
  }
});
