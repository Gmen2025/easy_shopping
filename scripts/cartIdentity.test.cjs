const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");
const toolkit = require("@reduxjs/toolkit");

function load(relative, dependencies) {
  const filename = path.join(__dirname, "..", relative);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
const database = { DEFAULT_DB_NAME: "E_Shopping", sanitizeDatabaseName: (value) =>
  !value ? "E_Shopping" : value === "E_ShoppingUSA" ? "E_ShopUSA" : value };
const identity = load("assets\\common\\cartIdentity.js", { "./databaseConfig": database });
const slice = load("store\\cartSlice.js", { "@reduxjs/toolkit": toolkit,
  "../assets/common/databaseConfig": database, "../assets/common/cartIdentity": identity });
const product = { _id: "product", price: 10, databaseName: "E_ShopUSA" };

test("cart identity distinguishes product, storefront, regional aliases and quoted prices", () => {
  assert.equal(identity.cartItemKey(product), identity.cartItemKey({ ...product, databaseName: "E_ShoppingUSA" }));
  for (const different of [{ storefrontId: "store" }, { price: 11 }, { databaseName: "E_Shopping" }, { _id: "other" }]) {
    assert.notEqual(identity.cartItemKey(product), identity.cartItemKey({ ...product, ...different }));
  }
});

test("same product at two storefronts or prices stays separate and decrement removes only the selected variant", () => {
  let state = slice.default(undefined, slice.addToCart(product));
  const storeProduct = { ...product, storefrontId: "store", price: 12 };
  state = slice.default(state, slice.addToCart(storeProduct));
  state = slice.default(state, slice.addToCart(storeProduct));
  assert.equal(state.cartItems.length, 2);
  assert.equal(state.cartItems[1].quantity, 2);
  state = slice.default(state, slice.deductQuantity({ cartKey: identity.cartItemKey(storeProduct) }));
  assert.equal(state.cartItems[1].quantity, 1);
  state = slice.default(state, slice.deductQuantity({ cartKey: identity.cartItemKey(storeProduct) }));
  assert.equal(state.cartItems.length, 1);
  assert.equal(state.cartItems[0].price, 10);
});

test("checkout completion subtracts only purchased units once and preserves items added during payment", () => {
  let state;
  for (let index = 0; index < 3; index++) state = slice.default(state, slice.addToCart(product));
  const other = { ...product, storefrontId: "other" };
  state = slice.default(state, slice.addToCart(other));
  state = slice.default(state, slice.beginCheckout({ id: "checkout" }));
  const action = slice.completeCheckout({ id: "checkout", items: [{ key: identity.cartItemKey(product), quantity: 2 }] });
  state = slice.default(state, action);
  state = slice.default(state, action);
  assert.equal(state.cartItems.length, 2);
  assert.equal(state.cartItems[0].quantity, 1);
  assert.equal(state.cartItems[1].quantity, 1);
});

test("recovering another device's checkout or clearing the original cart does not discard a new cart", () => {
  let state = slice.default(undefined, slice.addToCart(product));
  const action = slice.completeCheckout({ id: "other-device", items: [{ key: identity.cartItemKey(product), quantity: 1 }] });
  state = slice.default(state, action);
  assert.equal(state.cartItems.length, 1);
  state = slice.default(state, slice.beginCheckout({ id: "other-device" }));
  state = slice.default(state, slice.clearCart());
  state = slice.default(state, slice.addToCart(product));
  state = slice.default(state, action);
  assert.equal(state.cartItems.length, 1);
});
