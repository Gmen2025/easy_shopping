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
