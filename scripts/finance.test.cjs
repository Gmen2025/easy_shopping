const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");
const root = path.join(__dirname, "..");

test("finance requests use the authenticated selected database and propagate failures", async () => {
  const filename = path.join(root, "assets", "common", "finance.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const calls = [];
  let token = "test-token";
  const dependencies = {
    "@react-native-async-storage/async-storage": { getItem: async () => token },
    axios: async (options) => { calls.push(options); return { data: { ok: true } }; },
    "./baseUrl": "https://example.invalid/api/v1/",
    "./databaseConfig": { getDatabaseNameFromStorage: async () => "E_ShopUSA" },
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`);
    return dependencies[name];
  } });
  assert.equal((await exports.financeRequest("admin/report")).ok, true);
  assert.equal(calls[0].headers.Authorization, "Bearer test-token");
  assert.equal(calls[0].headers["x-database-name"], "E_ShopUSA");
  assert.equal(calls[0].timeout, 30000);
  assert.equal(calls[0].url, "https://example.invalid/api/v1/finance/admin/report");
  token = null;
  await assert.rejects(() => exports.financeRequest("admin/report"), /Sign in/);
  assert.equal(calls.length, 1);
  assert.equal(exports.financeMoney(12.5, "ETB"), "ETB 12.50");
});

test("shared website/mobile finance screens and navigators compile", () => {
  for (const relative of [
    ["Shared", "OwnershipReport.js"], ["Screens", "Admin", "FinanceAccounts.js"],
    ["Screens", "Finance", "IncomeDashboard.js"], ["Screens", "Admin", "Payouts.js"],
    ["Screens", "Admin", "AdminDashboard.js"], ["Screens", "Store", "CompanyStoreDashboard.js"],
    ["Screens", "Driver", "CompanyDriverDashboard.js"], ["Navigators", "AdminNavigator.js"],
    ["Navigators", "CompanyStoreNavigator.js"], ["Navigators", "CompanyDriverNavigator.js"], ["Navigators", "Main.js"],
  ]) {
    const filename = path.join(root, ...relative);
    assert.ok(babel.transformSync(fs.readFileSync(filename, "utf8"), {
      filename, configFile: false, babelrc: false,
      plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
    }).code);
  }
});
