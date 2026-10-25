const test = require("node:test");
const assert = require("node:assert/strict");
const babel = require("@babel/core");
const Module = require("node:module");
const path = require("node:path");

const filename = path.resolve(__dirname, "..", "assets", "common", "storeLogo.js");
const compiled = babel.transformFileSync(filename, {
  babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const { storeInitials, normalizeStoreLogo } = loaded.exports;

test("mobile store initials use the registered name and match website behavior", () => {
  for (const [name, expected] of [["Bole Market", "BM"], ["Addu Genet Easy Shop", "AS"],
    [" Sunshine ", "S"], ["ሐበሻ ገበያ", "ሐገ"], ["Fresh-Food Market", "FM"], ["", "ST"]]) {
    assert.equal(storeInitials(name), expected);
  }
});

test("mobile logos remain optional and removable, with secure URLs for persisted images", () => {
  assert.equal(normalizeStoreLogo(), "");
  assert.equal(normalizeStoreLogo(" "), "");
  assert.equal(normalizeStoreLogo(" https://example.test/logo.png "), "https://example.test/logo.png");
  for (const value of ["file:///local.png", "http://example.test/logo.png", "data:image/png;base64,abc",
    "https://user:password@example.test/logo.png", "https://example.test/image one.png",
    `https://example.test/${"a".repeat(500)}`]) assert.throws(() => normalizeStoreLogo(value), /HTTPS/);
});

test("all modified mobile logo and store screens compile with the installed Expo preset", () => {
  for (const file of ["Shared/StoreLogo.js", "Shared/StoreLogoField.js", "Screens/Admin/AdminStores.js",
    "Screens/Store/StoreManagement.js", "Screens/Store/StoreDirectory.js", "Screens/Store/Storefront.js"]) {
    assert.ok(babel.transformFileSync(path.resolve(__dirname, "..", ...file.split("/")), {
      presets: ["babel-preset-expo"],
    }).code, file);
  }
});
