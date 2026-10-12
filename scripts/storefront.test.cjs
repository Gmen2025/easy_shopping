const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load({ items = [], request = async () => ({ data: [] }), actions = [], dialogs = [] } = {}) {
  const filename = path.join(__dirname, "..", "assets", "common", "storefront.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  const dependencies = {
    "react-native": { Alert: { alert: (...args) => dialogs.push(args) } },
    "react-redux": { useDispatch: () => (action) => actions.push(action), useSelector: () => items },
    "@react-native-async-storage/async-storage": { getItem: async () => "session" },
    axios: request, "./baseUrl": "https://example.invalid/api/",
    "./databaseConfig": { getDatabaseNameFromStorage: async () => "E_ShopUSA" },
    "../../store/cartSlice": {
      addToCart: (payload) => ({ type: "add", payload }), clearCart: () => ({ type: "clear" }),
    },
  };
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

test("legacy single-store checkout redirects mixed scopes to multi-delivery checkout", () => {
  const { getStorefrontScope } = load();
  assert.equal(getStorefrontScope([{ storefrontId: "one" }, { storefrontId: "one" }]), "one");
  assert.equal(getStorefrontScope([{}]), null);
  assert.throws(() => getStorefrontScope([{ storefrontId: "one" }, {}]), /multi-delivery checkout/);
  assert.throws(() => getStorefrontScope([{ storefrontId: "one" }, { storefrontId: "two" }]), /multi-delivery checkout/);
});

test("switching storefronts adds products without discarding the existing cart", () => {
  const actions = [];
  const dialogs = [];
  const { useStoreCart } = load({ items: [{ storefrontId: "one" }], actions, dialogs });
  const product = { _id: "product", storefrontId: "two", price: 12 };
  assert.equal(useStoreCart()(product), true);
  assert.equal(dialogs.length, 0);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].type, "add");
  assert.equal(actions[0].payload, product);
});

test("store API requests preserve the active region and authentication, and propagate failures", async () => {
  const { storeRequest } = load({ request: async (config) => {
    assert.equal(config.url, "https://example.invalid/api/stores/checkout-availability");
    assert.equal(config.headers["x-database-name"], "E_ShopUSA");
    assert.equal(config.headers.Authorization, "Bearer session");
    assert.equal(config.data.storefrontId, "one");
    return { data: { inventoryManaged: true } };
  } });
  assert.equal((await storeRequest("checkout-availability", { method: "post", data: { storefrontId: "one" } })).inventoryManaged, true);
  const failure = load({ request: async () => { throw new Error("offline"); } });
  await assert.rejects(failure.storeRequest("directory"), /offline/);
});
