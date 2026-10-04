const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");
const configureApp = require("../app.config");

function loadConfiguration(os, nativeModule) {
  const filename = path.join(__dirname, "..", "assets", "common", "mapsConfiguration.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: () => ({ Platform: { OS: os }, NativeModules: { MapsConfiguration: nativeModule } }),
  });
  return exports;
}

test("Android maps require native manifest confirmation, not just a JavaScript key", () => {
  assert.equal(loadConfiguration("android", undefined).canRenderNativeMap, false);
  assert.equal(loadConfiguration("android", { isConfigured: false }).canRenderNativeMap, false);
  assert.equal(loadConfiguration("android", { isConfigured: true }).canRenderNativeMap, true);
});

test("iOS maps are unaffected by the Android manifest requirement", () => {
  assert.equal(loadConfiguration("ios", undefined).canRenderNativeMap, true);
});

test("directions failures preserve the diagnostic reason without exposing API keys or claiming tiles loaded", () => {
  const { formatDirectionsError } = loadConfiguration("android", { isConfigured: true });
  assert.match(formatDirectionsError("REQUEST_DENIED: API is not enabled"), /REQUEST_DENIED: API is not enabled/);
  assert.match(formatDirectionsError(new Error("Network request failed")), /Network request failed/);
  const secret = "AIzaExampleSecret123";
  const message = formatDirectionsError(`Denied ${secret} https://example.invalid?key=another-secret&mode=driving`);
  assert.ok(!message.includes(secret));
  assert.ok(!message.includes("another-secret"));
  assert.ok(!message.includes("Showing the map"));
  assert.match(formatDirectionsError(null), /Check your connection/);
});

test("delivery routes use Expo GPS and a driver marker instead of native user-location events", () => {
  const filename = path.join(__dirname, "..", "Screens", "Driver", "DeliveryRouteScreen.js");
  const { ast } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, ast: true, code: false,
    parserOpts: { plugins: ["jsx"] },
  });
  const maps = [];
  const markers = [];
  const locationCalls = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXOpeningElement" && node.name.name === "MapView") maps.push(node);
    if (node.type === "JSXOpeningElement" && node.name.name === "Marker") markers.push(node);
    if (node.type === "CallExpression" && node.callee.type === "MemberExpression" &&
      node.callee.object.name === "Location") locationCalls.push(node.callee.property.name);
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  visit(ast);
  assert.equal(maps.length, 1);
  for (const name of ["showsUserLocation", "followsUserLocation"]) {
    const prop = maps[0].attributes.find((attribute) => attribute.name?.name === name);
    assert.equal(prop?.value?.expression?.value, false, `${name} must explicitly disable the native location layer`);
  }
  assert.ok(locationCalls.includes("getCurrentPositionAsync"));
  assert.ok(locationCalls.includes("watchPositionAsync"));
  assert.ok(markers.some((marker) => marker.attributes.some((attribute) =>
    attribute.name?.name === "coordinate" && attribute.value?.expression?.name === "driverLocation")));
  const source = fs.readFileSync(filename, "utf8");
  assert.ok(!source.includes("react-native-maps-directions"));
  assert.ok(source.includes("drivers/me/orders/${orderId}/route"));
  assert.ok(source.includes('coordinates={routeCoordinates}'));
});

test("Expo config wires the same key to native Android config and JavaScript without discarding other settings", () => {
  const savedPublic = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  const savedPrivate = process.env.GOOGLE_MAPS_API_KEY;
  try {
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    const config = {
      android: { config: { googleMaps: { apiKey: "test-config-key" }, otherSetting: true } },
      extra: { otherExtra: true },
    };
    const configured = configureApp({ config });
    assert.equal(configured.android.config.googleMaps.apiKey, "test-config-key");
    assert.equal(configured.extra.googleMapsApiKey, "test-config-key");
    assert.equal(configured.android.config.otherSetting, true);
    assert.equal(configured.extra.otherExtra, true);
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = "test-env-key";
    assert.equal(configureApp({ config }).android.config.googleMaps.apiKey, "test-env-key");
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    assert.equal(configureApp({ config: {} }).android.config.googleMaps.apiKey, "");
  } finally {
    if (savedPublic === undefined) delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
    else process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = savedPublic;
    if (savedPrivate === undefined) delete process.env.GOOGLE_MAPS_API_KEY;
    else process.env.GOOGLE_MAPS_API_KEY = savedPrivate;
  }
});
