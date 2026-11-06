const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load(relative, dependencies) {
  const filename = path.join(__dirname, "..", relative);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, console, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}

const nearest = {
  product: { _id: "product", name: "Coffee", price: 17, countInStock: 4, storefrontId: "store", inventoryManaged: true },
  store: { _id: "store", name: "Nearby shop" }, distanceKm: 1.25,
};
const helper = (request) => load("assets\\common\\catalog.js", { "./storefront": { apiRequest: request } });

test("catalog settings use shared region/auth transport and never silently default OFF on errors", async () => {
  const calls = [];
  const api = helper(async (...args) => { calls.push(args); return { nearestStorePricingEnabled: false }; });
  assert.equal((await api.getCatalogSettings()).nearestStorePricingEnabled, false);
  await api.saveCatalogSettings(true);
  assert.equal(calls[0][0], "products");
  assert.equal(calls[0][1], "catalog-settings");
  assert.equal(calls[1][2].method, "put");
  assert.equal(calls[1][2].data.nearestStorePricingEnabled, true);
  for (const data of [null, {}, { nearestStorePricingEnabled: "false" }]) {
    await assert.rejects(helper(async () => data).getCatalogSettings(), /could not be verified/);
  }
  await assert.rejects(helper(async () => { throw new Error("offline"); }).getCatalogSettings(), /offline/);
});

test("coordinates require both fields and enforce exact geographic bounds without rejecting zero", () => {
  const api = helper();
  for (const [lat, lng] of [["", 0], [" ", 3], [0, null], [undefined, 3], [91, 0], [0, -181], ["bad", 1], [Infinity, 0]]) {
    assert.throws(() => api.parseCatalogCoordinates(lat, lng));
  }
  for (const [lat, lng] of [[0, 0], [-90, 180], [90, -180], ["9.03", "38.74"]]) {
    const point = api.parseCatalogCoordinates(lat, lng);
    assert.equal(point.latitude, Number(lat));
    assert.equal(point.longitude, Number(lng));
  }
});

test("nearest lookup preserves the actual store price and refuses invalid or unavailable stock", async () => {
  let called;
  const result = await helper(async (...args) => { called = args; return nearest; })
    .getNearestStoreProduct("product", { latitude: 0, longitude: 38 });
  assert.equal(called[1], "product/nearest-store?latitude=0&longitude=38");
  assert.equal(result.product.price, 17);
  assert.equal(result.product.storefrontId, "store");
  for (const data of [{}, { ...nearest, product: { ...nearest.product, price: "17" } },
    { ...nearest, product: { ...nearest.product, _id: "wrong-product" } },
    { ...nearest, product: { ...nearest.product, inventoryManaged: false } },
    { ...nearest, product: { ...nearest.product, price: -1 } },
    { ...nearest, product: { ...nearest.product, countInStock: 0 } },
    { ...nearest, product: { ...nearest.product, storefrontId: "wrong-store" } },
    { ...nearest, distanceKm: -1 }]) {
    await assert.rejects(helper(async () => data).getNearestStoreProduct("product", { latitude: 0, longitude: 0 }), /invalid price or stock/);
  }
  await assert.rejects(helper(async () => { throw new Error("No eligible store"); })
    .getNearestStoreProduct("product", { latitude: 0, longitude: 0 }), /No eligible store/);
});

test("toggle OFF preserves catalog carts; ON requires a resolved storefront for every product", () => {
  const api = helper();
  assert.equal(api.requiresStoreSelection([{}], false), false);
  assert.equal(api.requiresStoreSelection([{}], true), true);
  assert.equal(api.requiresStoreSelection([{ storefrontId: "one" }, {}], true), true);
  assert.equal(api.requiresStoreSelection([{ storefrontId: "one" }], true), false);
});

test("notification failures remain visible even after a successful save", () => {
  const api = helper();
  assert.equal(api.catalogNotificationWarning({}), "");
  assert.equal(api.catalogNotificationWarning({ notification: { error: "Push unavailable" } }), "Push unavailable");
  assert.match(api.catalogNotificationWarning({ notificationWarnings: ["inbox failed"] }), /notifications failed/);
});

function hooks() {
  const values = [], deps = [], cleanups = [], pending = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = { current: initial };
      return values[index];
    },
    useMemo: (fn) => fn(), useCallback: (fn) => fn,
    useEffect(effect, next) {
      const index = cursor++;
      if (!deps[index] || next.some((value, at) => !Object.is(value, deps[index][at]))) {
        deps[index] = next;
        pending.push(() => { cleanups[index]?.(); cleanups[index] = effect(); });
      }
    },
  };
  return { react, render(component, props) {
    cursor = 0;
    const tree = component(props);
    pending.splice(0).forEach((effect) => effect());
    return tree;
  } };
}
const native = new Proxy({
  StyleSheet: { create: (styles) => styles }, Dimensions: { get: () => ({ width: 390 }) },
  Platform: { OS: "android" },
}, { get: (target, key) => target[key] || key });
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  return text(tree?.props?.children || []);
}
const tick = () => new Promise(setImmediate);
const button = (tree, label) => nodes(tree).find((node) => ["TouchableOpacity", "EasyButton"].includes(node.type) && text(node) === label);

function details({ enabled = true, lookup = async () => nearest, storefrontId, location = {} } = {}) {
  const h = hooks(), added = [];
  const component = load("Screens\\Products\\SingleProduct.js", {
    react: h.react, "react-native": native,
    "expo-location": location,
    "../../Shared/StyledComponenets/EasyButton": "EasyButton",
    "../../Shared/StyledComponenets/TrafficLight": "TrafficLight",
    "../../Shared/ReviewPanel": "ReviewPanel",
    "react-native-toast-message": { show() {} },
    "../../assets/common/getImageUrl": (value) => typeof value === "string" ? value : value.image,
    "../../assets/common/currency": { useCurrency: () => ({ formatPrice: (value) => `ETB ${value}` }) },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_Shopping" },
    "../../assets/common/baseUrl": "",
    axios: { get: async () => ({ data: [] }) },
    "../../assets/common/storefront": {
      useStoreCart: () => (product) => { added.push(product); return true; },
      storeRequest: async () => ({ products: [] }),
    },
    "../../assets/common/useCatalogPricing": () => ({ enabled, error: "", reload() {} }),
    "../../assets/common/catalog": {
      ...helper(), getCatalogSettings: async () => ({ nearestStorePricingEnabled: enabled }),
      getNearestStoreProduct: lookup,
    },
  }).default;
  const props = { route: { params: { item: {
    _id: "product", name: "Coffee", price: 99, countInStock: 8, image: "image", storefrontId,
  } } } };
  return { added, props, render: () => h.render(component, props) };
}

test("product details ON require location, show only nearest-store price, and cart carries that store", async () => {
  const ui = details();
  let tree = ui.render();
  assert.doesNotMatch(text(tree), /ETB 99/);
  assert.equal(button(tree, "Add to Cart"), undefined);
  nodes(tree).find((node) => node.props?.accessibilityLabel === "Customer latitude").props.onChangeText("0");
  nodes(ui.render()).find((node) => node.props?.accessibilityLabel === "Customer longitude").props.onChangeText("0");
  button(ui.render(), "Find nearest price").props.onPress();
  ui.render(); await tick();
  tree = ui.render();
  assert.match(text(tree), /Nearby shop/);
  assert.match(text(tree), /ETB 17/);
  assert.doesNotMatch(text(tree), /ETB 99/);
  await button(tree, "Add to Cart").props.onPress();
  assert.equal(ui.added.length, 1);
  assert.equal(ui.added[0].price, 17);
  assert.equal(ui.added[0].storefrontId, "store");
  assert.equal(ui.added[0].storefrontName, "Nearby shop");
  assert.equal(ui.added[0].databaseName, "E_Shopping");
  nodes(ui.render()).find((node) => node.props?.accessibilityLabel === "Customer latitude").props.onChangeText("1");
  tree = ui.render();
  assert.equal(button(tree, "Add to Cart"), undefined);
  assert.doesNotMatch(text(tree), /ETB 17/);
});

test("OFF and explicit storefront detail pricing retain current behavior; loading settings never leaks catalog price", () => {
  for (const options of [{ enabled: false }, { enabled: true, storefrontId: "chosen" }]) {
    const tree = details(options).render();
    assert.match(text(tree), /ETB 99/);
    assert.ok(button(tree, "Add to Cart"));
  }
  const tree = details({ enabled: null }).render();
  assert.doesNotMatch(text(tree), /ETB 99/);
  assert.equal(button(tree, "Add to Cart"), undefined);
});

test("no eligible nearest store surfaces an error without falling back to catalog price", async () => {
  const ui = details({ lookup: async () => { throw new Error("No eligible store has stock."); } });
  ui.render();
  nodes(ui.render()).find((node) => node.props?.accessibilityLabel === "Customer latitude").props.onChangeText("9");
  nodes(ui.render()).find((node) => node.props?.accessibilityLabel === "Customer longitude").props.onChangeText("38");
  button(ui.render(), "Find nearest price").props.onPress();
  ui.render(); await tick();
  const tree = ui.render();
  assert.match(text(tree), /No eligible store has stock/);
  assert.doesNotMatch(text(tree), /ETB 99/);
  assert.equal(button(tree, "Add to Cart"), undefined);
});

test("GPS lookup requires explicit permission; denial keeps prices blocked and permits manual coordinates", async () => {
  let positions = 0;
  const ui = details({ location: {
    requestForegroundPermissionsAsync: async () => ({ granted: false }),
    getCurrentPositionAsync: async () => { positions += 1; },
  } });
  let tree = ui.render();
  assert.equal(positions, 0);
  await button(tree, "Use my current location").props.onPress();
  tree = ui.render();
  assert.match(text(tree), /Location access was denied/);
  assert.equal(positions, 0);
  assert.equal(button(tree, "Add to Cart"), undefined);
  assert.ok(nodes(tree).find((node) => node.props?.accessibilityLabel === "Customer latitude"));
});

test("GPS coordinates including zero resolve the store price only after the customer requests it", async () => {
  const points = [];
  const ui = details({
    location: {
      requestForegroundPermissionsAsync: async () => ({ granted: true }),
      getCurrentPositionAsync: async () => ({ coords: { latitude: 0, longitude: 0 } }),
    },
    lookup: async (id, point) => { points.push({ id, point }); return nearest; },
  });
  ui.render();
  assert.equal(points.length, 0);
  await button(ui.render(), "Use my current location").props.onPress();
  ui.render(); await tick();
  assert.match(text(ui.render()), /ETB 17/);
  assert.equal(points[0].id, "product");
  assert.equal(points[0].point.latitude, 0);
  assert.equal(points[0].point.longitude, 0);
});

test("changing location ignores a late quote for the previous location", async () => {
  const resolve = [];
  const ui = details({ lookup: () => new Promise((done) => resolve.push(done)) });
  ui.render();
  const setPoint = (latitude) => {
    nodes(ui.render()).find((node) => node.props?.accessibilityLabel === "Customer latitude").props.onChangeText(latitude);
    nodes(ui.render()).find((node) => node.props?.accessibilityLabel === "Customer longitude").props.onChangeText("38");
    button(ui.render(), "Find nearest price").props.onPress();
    ui.render();
  };
  setPoint("1");
  setPoint("2");
  assert.equal(resolve.length, 2);
  resolve[1]({ ...nearest, product: { ...nearest.product, price: 21 }, store: { ...nearest.store, name: "Second shop" } });
  await tick();
  assert.match(text(ui.render()), /ETB 21/);
  resolve[0](nearest);
  await tick();
  const tree = ui.render();
  assert.match(text(tree), /Second shop/);
  assert.match(text(tree), /ETB 21/);
  assert.doesNotMatch(text(tree), /ETB 17|Nearby shop/);
});

test("pricing hook invalidates settings while reloading and ignores out-of-order results", async () => {
  const h = hooks(), requests = [], listeners = [];
  let focus;
  const hook = load("assets\\common\\useCatalogPricing.js", {
    react: h.react,
    "react-native": { AppState: { addEventListener: (event, callback) => {
      listeners.push(callback);
      return { remove() {} };
    } } },
    "@react-navigation/native": { useFocusEffect: (callback) => { focus = callback; } },
    "./catalog": { getCatalogSettings: () => new Promise((resolve) => requests.push(resolve)) },
  }).default;
  h.render(hook);
  const cleanup = focus();
  requests[0]({ nearestStorePricingEnabled: false }); await tick();
  assert.equal(h.render(hook).enabled, false);
  listeners[0]("active");
  assert.equal(h.render(hook).enabled, null);
  const pending = h.render(hook).reload();
  requests[2]({ nearestStorePricingEnabled: true }); await pending;
  requests[1]({ nearestStorePricingEnabled: false }); await tick();
  assert.equal(h.render(hook).enabled, true);
  cleanup();
});

test("store product form creates a shared category and saves multiple uploaded images to the owner-scoped endpoint", async () => {
  const h = hooks(), requests = [], uploads = [], routes = [];
  const component = load("Screens\\Admin\\ProductForm.js", {
    react: h.react, "react-native": native,
    "@react-native-picker/picker": { Picker: "Picker" },
    "../../Shared/Form/FormContainer": "FormContainer", "../../Shared/Form/Input": "Input",
    "react-native-vector-icons/FontAwesome": "Icon", "../../Shared/Error": "Error",
    "react-native-toast-message": { show() {} },
    "@react-native-async-storage/async-storage": { getItem: async () => "token" },
    "../../assets/common/baseUrl": "https://example.invalid/",
    axios: { get: async () => ({ data: [{ _id: "shared", name: "Shared company category" }] }) },
    "../../Shared/CloudinaryUploader": {
      getSignature: async (url, params) => {
        assert.equal(url, "https://example.invalid/cloudinary/sign");
        assert.equal(params.folder, "eshop/products");
        return {};
      },
      uploadToCloudinary: async (uri) => { uploads.push(uri); return { secure_url: `https://images.invalid/${uploads.length}.jpg` }; },
    },
    "expo-image-picker": {
      requestMediaLibraryPermissionsAsync: async () => ({ status: "granted" }),
      launchImageLibraryAsync: async () => ({ canceled: false, assets: [
        { uri: "content://first", mimeType: "image/png" }, { uri: "file://second", mimeType: "image/jpeg" },
      ] }),
    },
    "../../assets/common/getImageUrl": () => "",
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_Shopping" },
    "../../assets/common/finance": {},
    "../../assets/common/storefront": { storeRequest: async (url, options) => {
      requests.push({ url, options });
      return url.endsWith("categories") ? { _id: "new-category", name: "Local foods" } : { _id: "new-product" };
    } },
    "../../assets/common/catalog": helper(),
  }).default;
  const props = { route: { params: { ownerStoreId: "my-store" } }, navigation: { goBack: () => routes.push("back") } };
  const render = () => h.render(component, props);
  render(); await tick();
  let tree = render();
  assert.ok(nodes(tree).some((node) => node.type === "Picker.Item" || node.props?.label === "Shared company category"));
  const input = (placeholder) => nodes(render()).find((node) => node.type === "Input" && node.props.placeholder === placeholder);
  input("New category name").props.onChangeText("Local foods");
  await button(render(), "Create or select category").props.onPress();
  for (const [field, value] of [["Brand", "Local"], ["Name", "Coffee"], ["Price", "17"], ["Description", "Fresh coffee"], ["Stock", "4"]]) {
    input(field).props.onChangeText(value);
  }
  await button(render(), "Add").props.onPress();
  await button(render(), "Add Product").props.onPress();
  assert.deepEqual(uploads, ["content://first", "file://second"]);
  assert.equal(requests[0].url, "me/locations/my-store/categories");
  assert.equal(requests[1].url, "me/locations/my-store/products");
  assert.equal(requests[1].options.data.category, "new-category");
  assert.equal(requests[1].options.data.price, 17);
  assert.equal(requests[1].options.data.images.length, 2);
  assert.equal(requests[1].options.data.image, "https://images.invalid/1.jpg");
  assert.equal(requests[1].options.data.rating, undefined);
  assert.equal(routes.length, 1);
});

test("store category management lists all shared categories but only exposes edit/delete for its own entries", async () => {
  const h = hooks(), requests = [];
  const categories = [
    { _id: "company", name: "Company category" },
    { _id: "other", name: "Another store", createdByStore: "other-store" },
    { _id: "mine", name: "Own category", createdByStore: { _id: "my-store" } },
  ];
  const component = load("Screens\\Admin\\Categories.js", {
    react: h.react, "react-native": { ...native, StyleSheet: native.StyleSheet, Dimensions: native.Dimensions,
      View: "View", Text: "Text", FlatList: "FlatList", TextInput: "TextInput",
      TouchableOpacity: "TouchableOpacity", ActivityIndicator: "ActivityIndicator",
      Alert: { alert() {} } },
    "react-native-vector-icons/FontAwesome": "Icon",
    "../../assets/common/catalog": helper(),
    "../../assets/common/storefront": {
      apiRequest: async () => categories,
      storeRequest: async (url, options) => { requests.push({ url, options }); return { _id: "mine", name: options.data.name }; },
    },
  }).default;
  const props = { route: { params: { ownerStoreId: "my-store" } } };
  const render = () => h.render(component, props);
  render(); await tick();
  const tree = render();
  const list = nodes(tree).find((node) => node.type === "FlatList");
  assert.equal(list.props.data.length, 3);
  const rows = list.props.data.map((item) => list.props.renderItem({ item }));
  assert.deepEqual(rows.map((row) => row.props.canEdit), [false, false, true]);
  rows[2].props.onEdit(categories[2]);
  nodes(render()).find((node) => node.type === "TextInput").props.onChangeText("Renamed");
  await button(render(), "Save").props.onPress();
  assert.equal(requests[0].url, "me/locations/my-store/categories/mine");
  assert.equal(requests[0].options.method, "put");
  assert.equal(requests[0].options.data.name, "Renamed");
});

test("independent store income landing screen exposes the store catalog workspace", () => {
  const filename = path.join(__dirname, "..", "Screens", "Finance", "IncomeDashboard.js");
  const { ast } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, ast: true, parserOpts: { plugins: ["jsx"] },
  });
  let action;
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "JSXElement" && node.openingElement.attributes.some((attribute) =>
      attribute.name?.name === "label" && attribute.value?.value === "My store, products & categories")) action = node;
    Object.values(node).forEach((value) => Array.isArray(value) ? value.forEach(visit) : visit(value));
  }
  visit(ast);
  assert.ok(action);
  const handler = action.openingElement.attributes.find((entry) => entry.name?.name === "onPress").value.expression;
  assert.equal(handler.body.callee.property.name, "navigate");
  assert.equal(handler.body.arguments[0].value, "StoreManagement");
});
