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
test("international maps separate final delivery and collection using only the saved destination snapshot", () => {
  const filename = path.join(__dirname, "..", "assets", "common", "internationalShipping.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports });
  const dispatch = { country: "Ethiopia", location: { coordinates: [38.75, 9.02] } };
  const recipient = { country: "Ethiopia", location: { coordinates: [38.8, 8.98] } };
  const group = {
    international: { hub: { location: { coordinates: [-87.65, 41.95] } },
      tariff: { ethiopiaPickup: dispatch }, shipments: [{ id: "home", recipient }] },
    deliveries: [{ address: { id: "home" } }, { address: { id: "home" }, fulfillmentMethod: "pickup" }],
  };
  let legs = exports.internationalDestinationLegs(group);
  assert.equal(legs[0].origin, dispatch);
  assert.equal(legs[0].destination, recipient);
  assert.equal(legs[1].kind, "collection");
  assert.equal(legs[1].destination, dispatch);
  group.deliveries.shift();
  assert.equal(exports.internationalDestinationLegs(group).length, 1);
  group.deliveries[0].fulfillmentMethod = "delivery";
  delete group.international.tariff.ethiopiaPickup;
  legs = exports.internationalDestinationLegs(group);
  assert.equal(legs[0].origin, undefined);
  assert.equal(legs[0].destination, recipient);
  group.international.direction = "ethiopia-to-usa";
  group.international.tariff.usaPickup = { country: "USA" };
  assert.equal(exports.internationalDestinationLegs(group)[0].origin, group.international.tariff.usaPickup);
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

test("payment switches retain their strict body through the database interceptor", async () => {
  const calls = [];
  const fetchCalls = [];
  let intercept;
  const methods = { cash: true, bank: true, card: true, telebirr: true };
  const axios = async (options) => {
    calls.push(await intercept(options));
    return { data: { success: true, methods } };
  };
  axios.interceptors = { request: { use: (handler) => { intercept = handler; } } };
  const baseUrl = "https://api.example.test/api/v1/";
  const database = { getDatabaseNameFromStorage: async () => "E_Shopping" };
  const storage = { getItem: async () => "admin-fixture" };
  const globals = { fetch: async (url, options) => { fetchCalls.push({ url, options }); } };
  const load = (relative, dependencies) => {
    const file = path.join(__dirname, "..", relative);
    const { code } = babel.transformSync(fs.readFileSync(file, "utf8"), {
      filename: file, configFile: false, babelrc: false,
      plugins: ["@babel/plugin-transform-modules-commonjs"],
    });
    const exports = {};
    vm.runInNewContext(code, { exports, global: globals, require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    } });
    return exports;
  };
  const dependencies = {
    axios,
    "@react-native-async-storage/async-storage": storage,
    "./baseUrl": baseUrl,
    "./databaseConfig": database,
  };
  load("assets\\common\\attachDatabaseInterceptor.js", dependencies).attachDatabaseInterceptor();
  const api = load("assets\\common\\paymentSettings.js", dependencies);

  for (const [region, enabled] of [["E_ShopUSA", false], ["E_Shopping", true]]) {
    await api.paymentSettings(region, { card: enabled });
    const request = calls.at(-1);
    assert.equal(JSON.stringify(request.data), JSON.stringify({ methods: { card: enabled } }));
    assert.equal(request.headers["x-database-name"], region);
    assert.equal(request.headers.Authorization, "Bearer admin-fixture");
    assert.match(request.url, new RegExp(`db=${region}$`));
  }
  await globals.fetch(`${baseUrl}settings/payment-methods/?view=admin`, {
    method: "PUT", body: JSON.stringify({ methods: { cash: false } }),
  });
  assert.equal(fetchCalls[0].options.body, JSON.stringify({ methods: { cash: false } }));
  assert.equal(fetchCalls[0].options.headers["x-database-name"], "E_Shopping");
  assert.match(fetchCalls[0].url, /view=admin&db=E_Shopping$/);
  const other = await intercept({ url: `${baseUrl}orders`, method: "post", data: { example: true } });
  assert.equal(other.data.databaseName, "E_Shopping");
});
