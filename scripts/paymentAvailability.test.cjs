const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

const filename = path.join(__dirname, "..", "assets", "common", "paymentAvailability.js");
const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
  filename, configFile: false, babelrc: false,
  plugins: ["@babel/plugin-transform-modules-commonjs"],
});
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject });
const { isCashOnDeliveryAvailable, isCashOnDeliveryMethod, deliveryPaymentMethods } = exportsObject;

test("domestic Telebirr requires configured Ethiopia ETB products and the regional switch", () => {
  const all = { cash: true, bank: true, card: true, telebirr: true };
  const group = { currency: "etb", kind: "products" };
  assert.deepEqual(Array.from(deliveryPaymentMethods(group, "E_Shopping", true, true, all)), ["bank", "telebirr", "cash"]);
  for (const [value, database, gateway, settings] of [
    [group, "E_ShopUSA", true, all], [{ ...group, currency: "usd" }, "E_Shopping", true, all],
    [group, "E_Shopping", false, all], [group, "E_Shopping", true, { ...all, telebirr: false }],
    [{ ...group, exchangeRate: {} }, "E_Shopping", true, all],
  ]) assert.equal(deliveryPaymentMethods(value, database, true, gateway, settings).includes("telebirr"), false);
});

test("converted product methods honor currency, gateway support, native card builds and independent admin switches", () => {
  const all = { cash: true, bank: true, card: true, telebirr: true };
  const options = (group, database, card, telebirr, settings = all) =>
    Array.from(deliveryPaymentMethods(group, database, card, telebirr, settings));
  assert.deepEqual(options({ exchangeRate: {} }, "E_Shopping", true, true), ["bank", "card"]);
  assert.deepEqual(options({ exchangeRate: {} }, "E_Shopping", false, true), ["bank"]);
  assert.deepEqual(options({ exchangeRate: {} }, "E_Shopping", true, true, { ...all, card: false }), ["bank"]);
  assert.deepEqual(options({ international: {}, exchangeRate: {} }, "E_ShopUSA", true, true), ["bank", "telebirr"]);
  assert.deepEqual(options({ international: {} }, "E_ShopUSA", true, false), ["bank"]);
  assert.deepEqual(options({ international: {} }, "E_ShopUSA", true, true, { ...all, bank: false }), ["telebirr"]);
  assert.deepEqual(options({ international: {} }, "E_ShopUSA", true, true, { ...all, telebirr: false }), ["bank"]);
  assert.deepEqual(options({}, "E_ShopUSA", true, true), ["bank", "card", "cash"]);
  const reverse = { international: { direction: "ethiopia-to-usa" }, exchangeRate: {} };
  assert.deepEqual(options(reverse, "E_Shopping", true, true), ["bank", "card"]);
  assert.deepEqual(options(reverse, "E_Shopping", false, true), ["bank"]);
  assert.deepEqual(options(reverse, "E_Shopping", true, true, { ...all, bank: false }), ["card"]);
  assert.deepEqual(options(reverse, "E_Shopping", true, true, { ...all, card: false, bank: false }), []);
});

test("reverse export preview combines USD shipping/delivery with one native conversion and uses USA arrival tracking", () => {
  const filename = path.join(__dirname, "..", "assets", "common", "internationalShipping.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports });
  const quote = { itemsSubtotal: 40, exchangeRate: { birrPerUsd: 3 },
    international: { direction: "ethiopia-to-usa", shippingFee: 30 }, finalDeliveryFee: 8.01 };
  assert.equal(exports.internationalPreview(quote, 4).payment, 52.68);
  assert.equal(exports.internationalPreview(quote, 4).total, 158.03);
  assert.equal(exports.internationalPreview(quote, 10).payment, 54.68);
  assert.equal(exports.internationalPreview({ ...quote, itemsSubtotal: 0.01, exchangeRate: { birrPerUsd: 150.31 },
    international: { direction: "ethiopia-to-usa", shippingFee: 1.01 }, finalDeliveryFee: 0 }, 0).payment, 1.01);
  assert.equal(exports.shippingRoute(quote.international.direction).stages[3], "arrived_usa");
  assert.equal(exports.shippingRoute().stages[3], "arrived_ethiopia");
  assert.equal(exports.isUSA("United States"), true);
  assert.equal(exports.isUSA("Ethiopia"), false);
});
test("USA cash eligibility is independent of the app build", () => {
  for (const database of ["E_ShopUSA", "E_ShoppingUSA"]) {
    assert.equal(isCashOnDeliveryAvailable(database, true), true);
    for (const flag of [false, undefined, null, "true"]) {
      assert.equal(isCashOnDeliveryAvailable(database, flag), true);
    }
  }
});

test("Ethiopia cash checkout is unchanged for development and release", () => {
  for (const database of ["E_Shopping", "E_Shopping_2"]) {
    assert.equal(isCashOnDeliveryAvailable(database, true), true);
    assert.equal(isCashOnDeliveryAvailable(database, false), true);
  }
});

test("confirmation recognizes existing cash method representations but not other payments", () => {
  for (const method of [1, "1", "cash", " CASH ", "Cash on delivery", " CASH ON DELIVERY "]) {
    assert.equal(isCashOnDeliveryMethod(method), true);
  }
  for (const method of [2, 3, 4, "Card Payment", "Bank Transfer", undefined, null]) {
    assert.equal(isCashOnDeliveryMethod(method), false);
  }
});

test("payment settings requests preserve explicit region, Admin token, and partial switch bodies", async () => {
  const filename = path.join(__dirname, "..", "assets", "common", "paymentSettings.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const calls = [];
  const methods = { cash: false, bank: true, card: true, telebirr: false };
  const dependencies = {
    axios: { __esModule: true, default: async (options) => { calls.push(options); return { data: { success: true, methods } }; } },
    "@react-native-async-storage/async-storage": { __esModule: true, default: { getItem: async () => "admin-fixture" } },
    "./baseUrl": { __esModule: true, default: "https://api.example.test/api/v1/" },
    "./databaseConfig": { getDatabaseNameFromStorage: async () => "E_Shopping" },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => dependencies[name] });
  await exports.paymentSettings();
  await exports.paymentSettings("E_ShopUSA", { cash: false });
  assert.equal(calls[0].headers["x-database-name"], "E_Shopping");
  assert.equal(calls[0].method, "get");
  assert.equal(calls[1].headers["x-database-name"], "E_ShopUSA");
  assert.equal(calls[1].headers.Authorization, "Bearer admin-fixture");
  assert.equal(calls[1].method, "put");
  assert.equal(JSON.stringify(calls[1].data), JSON.stringify({ methods: { cash: false } }));
  for (const data of [null, {}, { success: false, methods }, { success: true, methods: {} },
    { success: true, methods: { ...methods, card: "true" } }]) {
    assert.throws(() => exports.parsePaymentSettings(data), /Unable to load payment availability/);
  }
});
