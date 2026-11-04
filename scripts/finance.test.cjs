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
    ["Screens", "Admin", "AdminAccount.js"], ["Screens", "Admin", "ProductForm.js"],
    ["assets", "common", "operatorWorkspace.js"],
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

test("admin business paths retain explicit account scope and malformed responses fail visibly", () => {
  const filename = path.join(root, "assets", "common", "operatorWorkspace.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  });

  const exports = {};
  vm.runInNewContext(code, { exports });
  assert.equal(exports.businessPath("store", "a/b", "dashboard"), "stores/admin/a%2Fb/dashboard");
  assert.equal(exports.businessPath("driver", "driver1", "rides"), "rides/admin/drivers/driver1/dashboard");
  assert.throws(() => exports.businessPath("driver", "me", "wallet"), /Select/);
  assert.throws(() => exports.businessPath("user", "id", "profile"), /Select/);
  for (const view of ["dashboard", "profile", "rides", "wallet", "assignments", "queue", "reviews"]) {
    assert.throws(() => exports.validateBusiness({}, view), /Invalid|Incomplete|Missing/);
  }
  assert.equal(exports.validateBusiness({ queue: [] }, "queue").queue.length, 0);
});

test("admin account lists combine ownership/type filters and open the selected business workspace", () => {
    const filename = path.join(root, "Screens", "Admin", "FinanceAccounts.js");
    const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
      filename, configFile: false, babelrc: false,
      plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
    });
    const accounts = [
      { _id: "store1", name: "Independent market", kind: "store", isCompanyOwned: false, owner: { name: "Store holder" } },
      { _id: "store2", name: "Owned market", kind: "store", isCompanyOwned: true },
      { _id: "driver1", name: "Independent driver", kind: "driver", isCompanyOwned: false },
    ];
    let stateIndex = 0;
    const state = [accounts, false, "", "independent", "store", "holder"];
    const dependencies = {
      react: {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
        useState: () => [state[stateIndex++], () => {}], useCallback: (value) => value,
      },
      "react-native": new Proxy({ StyleSheet: { create: (styles) => styles } }, { get: (target, key) => target[key] || key }),
      "@react-navigation/native": { useFocusEffect: () => {} },
      "../../assets/common/finance": {},
    };
    const exports = {};
    vm.runInNewContext(code, { exports, require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    } });
    let destination;
    const tree = exports.default({ navigation: { navigate: (screen, params) => { destination = { screen, params }; } } });
    const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node)
      ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
    const list = nodes(tree).find((node) => node.type === "FlatList");
    assert.equal(list.props.data.length, 1);
    assert.equal(list.props.data[0]._id, "store1");
    list.props.renderItem({ item: list.props.data[0] }).props.onPress();
    assert.equal(destination.screen, "AdminAccount");
    assert.equal(destination.params.kind, "store");
    assert.equal(destination.params.accountId, "store1");
  });
