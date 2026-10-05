const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function loadModule(relativePath, dependencies, jsx = false) {
  const filename = path.join(__dirname, "..", relativePath);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: [
      "@babel/plugin-transform-modules-commonjs",
      ...(jsx ? ["@babel/plugin-transform-react-jsx"] : []),
    ],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    }, console: { warn: () => {} },
  }, { filename });
  return exports;
}

const { toLatLng } = loadModule("assets\\common\\orderTracking.js", {});
const delivery = { latitude: 9.03, longitude: 38.74 };
const pickup = { latitude: 9.01, longitude: 38.76 };
const addressText = "Delivery landmark, Addis Ababa, Ethiopia";
const plain = (value) => JSON.parse(JSON.stringify(value));

function loadPreview({ geocode, assign } = {}) {
  return loadModule("assets\\common\\checkoutLocationPreview.js", {
    "./deliveryLocation": { resolveDeliveryLocation: geocode || (async () => delivery) },
    "./stores": { buildStoreAssignmentPayload: assign || (async () => ({
      storeLocation: pickup, pickupStoreName: "Selected store", storeId: "store",
    })) },
    "./orderTracking": { toLatLng },
  });
}

test("preview resolves Ethiopian delivery and pickup locations without calling distance API", async () => {
  const helper = loadPreview({
    geocode: async (address, country) => {
      assert.equal(address, addressText);
      assert.equal(country, "Ethiopia");
      return delivery;
    },
    assign: async (point, token) => {
      assert.deepEqual(plain(point), delivery);
      assert.equal(token, "session-token");
      return { storeId: "store", storeLocation: pickup };
    },
  });
  const preview = await helper.resolveCheckoutLocationPreview({
    addressText, country: "Ethiopia", token: "session-token",
  });
  assert.deepEqual(plain(preview.customerLocation), delivery);
  assert.deepEqual(plain(preview.storeAssignment.storeLocation), pickup);
});

test("unchanged address reuses previewed delivery coordinates but refreshes pickup selection", async () => {
  let assignments = 0;
  const helper = loadPreview({
    geocode: async () => assert.fail("Must reuse previewed delivery coordinates"),
    assign: async () => { assignments += 1; return { storeId: "refreshed" }; },
  });
  const preview = await helper.resolveCheckoutLocationPreview({
    addressText, country: "Ethiopia",
    previousPreview: { addressText, country: "Ethiopia", customerLocation: delivery },
  });
  assert.deepEqual(plain(preview.customerLocation), delivery);
  assert.equal(preview.storeAssignment.storeId, "refreshed");
  assert.equal(assignments, 1);
});

test("changed address, changed country or invalid previous pin requires a fresh lookup", async () => {
  let calls = 0;
  const helper = loadPreview({ geocode: async () => { calls += 1; return delivery; } });
  for (const previousPreview of [
    { addressText: "Old address", country: "Ethiopia", customerLocation: pickup },
    { addressText, country: "United States", customerLocation: pickup },
    { addressText, country: "Ethiopia", customerLocation: { latitude: 91, longitude: 38 } },
  ]) {
    const result = await helper.resolveCheckoutLocationPreview({
      addressText, country: "Ethiopia", previousPreview,
    });
    assert.deepEqual(plain(result.customerLocation), delivery);
  }
  assert.equal(calls, 3);
});

test("preview validation and lookup errors propagate instead of substituting locations", async () => {
  const helper = loadPreview({ geocode: async () => { throw new Error("Address lookup failed"); } });
  for (const input of [
    { addressText: "", country: "Ethiopia" },
    { addressText, country: "" },
  ]) await assert.rejects(helper.resolveCheckoutLocationPreview(input), /Enter your shipping/);
  await assert.rejects(helper.resolveCheckoutLocationPreview({
    addressText, country: "Ethiopia",
  }), /Address lookup failed/);
});

test("map links preserve latitude-longitude order and reject invalid pins", () => {
  const helper = loadPreview();
  assert.equal(new URL(helper.getGoogleMapsPinUrl(delivery)).searchParams.get("query"), "9.03,38.74");
  assert.equal(new URL(helper.getGoogleMapsPinUrl({ coordinates: [38.76, 9.01] }))
    .searchParams.get("query"), "9.01,38.76");
  for (const invalid of [null, {}, { latitude: 91, longitude: 38 }, { latitude: 0, longitude: 0 }]) {
    assert.equal(helper.getGoogleMapsPinUrl(invalid), null);
  }
});

function renderPreview({ mapsAvailable = true, openURL = async () => {} } = {}) {
  const errors = [];
  const createElement = (type, props, ...children) => ({ type, props: props || {}, children });
  const component = loadModule("Shared\\CheckoutLocationPreview.js", {
    react: { createElement, useRef: () => ({ current: null }) },
    "react-native": {
      Linking: { openURL }, StyleSheet: { create: (styles) => styles },
      Text: "Text", View: "View", TouchableOpacity: "TouchableOpacity",
    },
    "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker" },
    "../assets/common/mapsConfiguration": {
      canRenderNativeMap: mapsAvailable, MAP_UNAVAILABLE_MESSAGE: "Native map unavailable",
    },
    "../assets/common/orderTracking": { toLatLng },
    "../assets/common/checkoutLocationPreview": loadPreview(),
  }, true).default;
  const tree = component({
    preview: {
      addressText, customerLocation: delivery,
      storeAssignment: { storeLocation: pickup, pickupStoreName: "Selected store" },
    },
    onError: (message) => errors.push(message),
  });
  const elements = [];
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    elements.push(node);
    node.children?.forEach(visit);
  };
  visit(tree);
  return { elements, errors };
}

test("preview renders both pins, never draws a substitute route, and opens the selected pin", async () => {
  const opened = [];
  const { elements } = renderPreview({ openURL: async (url) => opened.push(url) });
  const markers = elements.filter((node) => node.type === "Marker");
  assert.equal(markers.length, 2);
  assert.deepEqual(plain(markers.map((node) => node.props.coordinate)), [pickup, delivery]);
  assert.equal(elements.filter((node) => node.type === "Polyline").length, 0);
  for (const link of elements.filter((node) => node.type === "TouchableOpacity")) {
    await link.props.onPress();
  }
  assert.deepEqual(opened.map((url) => new URL(url).searchParams.get("query")), ["9.01,38.76", "9.03,38.74"]);
});

test("without a native map, pin links remain usable and linking errors are visible", async () => {
  const { elements, errors } = renderPreview({
    mapsAvailable: false,
    openURL: async () => { throw new Error("No map app"); },
  });
  assert.equal(elements.filter((node) => node.type === "MapView").length, 0);
  const links = elements.filter((node) => node.type === "TouchableOpacity");
  assert.equal(links.length, 2);
  await links[0].props.onPress();
  assert.match(errors[0], /Unable to open Google Maps/);
});
