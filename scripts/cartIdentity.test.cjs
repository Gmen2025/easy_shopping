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
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
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
test("remove button removes every unit of only its exact cart variant", () => {
  const other = { ...product, storefrontId: "other" };
  let state = slice.default(undefined, slice.addToCart(product));
  state = slice.default(state, slice.addToCart(product));
  state = slice.default(state, slice.addToCart(other));
  state = slice.default(state, slice.removeFromCart({ cartKey: identity.cartItemKey(product) }));
  assert.equal(state.cartItems.length, 1);
  assert.equal(state.cartItems[0].storefrontId, "other");
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
test("cart quantity and removal controls preserve the exact storefront variant and checkout currency", async () => {
  const item = { ...product, storefrontId: "store", name: "Box", quantity: 3 };
  const states = [], effects = [], actions = [], navigations = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useContext: () => ({ isAuthenticated: true }),
    useState: (initial) => {
      const at = cursor++;
      if (!(at in states)) states[at] = initial;
      return [states[at], (next) => { states[at] = typeof next === "function" ? next(states[at]) : next; }];
    },
    useCallback: (action) => action,
  };
  const Component = load("Screens\\Cart\\CartView.js", {
    react, "react-native": { View: "View", Text: "Text", FlatList: "FlatList", StyleSheet: { create: (value) => value },
      Alert: { alert() {} } },
    "react-native-paper": { Button: "Button", Avatar: { Image: "Image" } },
    "react-redux": { useSelector: (selector) => selector({ cart: { cartItems: [item] } }),
      useDispatch: () => (action) => actions.push(action) },
    "../../store/cartSlice": slice,
    "../../Context/store/Auth": { AuthContext: {} },
    "../../Shared/StyledComponenets/EasyButton": "EasyButton",
    "../../Shared/DeliveryCheckout": { CheckoutHeader: "CheckoutHeader" },
    "../../assets/common/currency": { useCurrency: () => ({ formatPrice: (value) => `$${value.toFixed(2)}`, currencySymbol: "$" }) },
    "../../assets/common/cartIdentity": identity,
    "../../assets/common/storefront": { storeRequest: async () => ({ enabled: true }), getStorefrontScope() {} },
    "../../assets/common/databaseConfig": { ...database, getDatabaseNameFromStorage: async () => "E_ShopUSA" },
    "@react-navigation/native": { useFocusEffect: (effect) => effects.push(effect) },
    "@react-native-picker/picker": { Picker: Object.assign("Picker", { Item: "PickerItem" }) },
    "../../assets/common/exchangeRate": { exchangeRequest: async () => ({ active: true }), rateIsActive: (value) => value?.active },
  }).default;
  const render = () => { cursor = 0; return Component({ navigation: { push: (...args) => navigations.push(args), navigate() {}, goBack() {} } }); };
  function nodes(value) {
    if (!value || typeof value !== "object") return [];
    if (Array.isArray(value)) return value.flatMap(nodes);
    return [value, ...nodes(value.props?.children)];
  }
  render(); effects[0]();
  for (let at = 0; at < 5; at++) await new Promise(setImmediate);
  const list = nodes(render()).find((node) => node.type === "FlatList");
  const row = list.props.renderItem({ item });
  nodes(row).find((node) => node.props.accessibilityLabel === "Increase Box quantity").props.onPress();
  nodes(row).find((node) => node.props.accessibilityLabel === "Decrease Box quantity").props.onPress();
  nodes(row).find((node) => node.props.accessibilityLabel === "Remove Box").props.onPress();
  assert.equal(actions[0].type, "cart/addToCart");
  assert.equal(actions[0].payload.storefrontId, "store");
  assert.equal(actions[1].payload.cartKey, identity.cartItemKey(item));
  assert.equal(actions[2].type, "cart/removeFromCart");
  assert.equal(actions[2].payload.cartKey, identity.cartItemKey(item));
  const proceed = nodes(list.props.ListFooterComponent).find((node) => node.type === "EasyButton");
  await proceed.props.onPress();
  assert.equal(navigations[0][0], "MultiDeliveryCheckout");
  assert.equal(navigations[0][1].paymentCurrency, "usd");
});
