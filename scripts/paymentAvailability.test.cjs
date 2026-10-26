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
const { isCashOnDeliveryAvailable, isCashOnDeliveryMethod } = exportsObject;

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
