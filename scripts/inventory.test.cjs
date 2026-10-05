const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load(relativePath, dependencies, globals = {}) {
  const filename = path.join(__dirname, "..", relativePath);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports, console: { warn: () => {} }, ...globals,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

function fixture(get) {
  const axios = { get };
  const retry = load("assets\\common\\requestRetry.js", { axios }, {
    setTimeout: (callback) => callback(),
  });
  const database = load("assets\\common\\databaseConfig.js", {
    "@react-native-async-storage/async-storage": { getItem: async () => "E_Shopping" },
  });
  return load("assets\\common\\inventory.js", {
    axios, "./requestRetry": retry, "./databaseConfig": database,
    "./baseUrl": "https://example.invalid/api/",
  });
}

const cartItem = { _id: "product-id", name: "Selected item", quantity: 2, databaseName: "E_Shopping" };

test("stock check verifies live inventory with authentication and selected database", async () => {
  const helper = fixture(async (url, config) => {
    assert.equal(url, "https://example.invalid/api/products/product-id");
    assert.equal(config.headers.Authorization, "Bearer session-token");
    assert.equal(config.headers["x-database-name"], "E_Shopping");
    assert.equal(config.params.db, "E_Shopping");
    return { data: { countInStock: 5 } };
  });
  assert.equal((await helper.validateOrderStock({
    orderItems: [cartItem], token: "session-token",
  })).ok, true);
});

test("temporary inventory service and network failures retry before verifying stock", async () => {
  for (const error of [
    { response: { status: 503 } },
    { code: "ECONNABORTED", message: "timeout" },
  ]) {
    let calls = 0;
    const helper = fixture(async () => {
      calls += 1;
      if (calls < 3) throw error;
      return { data: { countInStock: 5 } };
    });
    assert.equal((await helper.validateOrderStock({ orderItems: [cartItem] })).ok, true);
    assert.equal(calls, 3);
  }
});

test("request failures stay blocked with actionable item-specific diagnostics", async () => {
  for (const [error, expected, attempts] of [
    [{ response: { status: 401 } }, /Selected item.*sign in again/, 1],
    [{ response: { status: 403 } }, /Selected item.*rejected access/, 1],
    [{ response: { status: 404 } }, /Selected item.*selected region/, 1],
    [{ response: { status: 503 } }, /Selected item.*HTTP 503/, 3],
    [{ message: "Network Error" }, /Selected item.*connection/, 3],
  ]) {
    let calls = 0;
    const helper = fixture(async () => { calls += 1; throw error; });
    const result = await helper.validateOrderStock({ orderItems: [cartItem] });
    assert.equal(result.ok, false);
    assert.equal(result.unverified.length, 1);
    assert.equal(result.overLimit.length, 0);
    assert.match(result.message, expected);
    assert.equal(calls, attempts);
  }
});

test("missing and malformed inventory is not interpreted as valid stock", async () => {
  for (const data of [null, {}, { countInStock: null }, { countInStock: "" },
    { countInStock: "invalid" }, { countInStock: -1 }, { countInStock: 1.5 }]) {
    const helper = fixture(async () => ({ data }));
    const result = await helper.validateOrderStock({ orderItems: [cartItem] });
    assert.equal(result.ok, false);
    assert.equal(result.unverified.length, 1);
    assert.match(result.message, /invalid inventory/);
  }
});

test("numeric stock, wrapped products and genuine quantity limits remain supported", async () => {
  for (const data of [{ countInStock: "5" }, { product: { countInStock: 5 } }]) {
    const helper = fixture(async () => ({ data }));
    assert.equal((await helper.validateOrderStock({ orderItems: [cartItem] })).ok, true);
  }
  for (const available of [0, 1]) {
    const helper = fixture(async () => ({ data: { countInStock: available } }));
    const result = await helper.validateOrderStock({ orderItems: [cartItem] });
    assert.equal(result.overLimit.length, 1);
    assert.equal(result.unverified.length, 0);
    assert.match(result.message, new RegExp(`only ${available} left`));
  }
});

test("populated order items look up product ID, not order-item ID", async () => {
  for (const product of ["actual-product", { _id: "actual-product" }, { id: "actual-product" }]) {
    const helper = fixture(async (url) => {
      assert.match(url, /products\/actual-product$/);
      return { data: { countInStock: 5 } };
    });
    assert.equal((await helper.validateOrderStock({
      orderItems: [{ _id: "order-item-id", product, quantity: 1 }],
    })).ok, true);
  }
});

test("invalid cart entries and cross-region items cannot silently pass stock checks", async () => {
  const helper = fixture(async () => assert.fail("Invalid item should not make a request"));
  for (const item of [
    {}, { _id: {} }, { ...cartItem, quantity: 0 },
    { ...cartItem, quantity: -1 }, { ...cartItem, quantity: "invalid" },
    { ...cartItem, quantity: 1.5 },
    { ...cartItem, databaseName: "E_ShopUSA" },
  ]) {
    const result = await helper.validateOrderStock({ orderItems: [item] });
    assert.equal(result.ok, false);
    assert.equal(result.unverified.length, 1);
  }
});
