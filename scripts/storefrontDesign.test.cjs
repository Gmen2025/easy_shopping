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
  vm.runInNewContext(code, { exports, console, global: {}, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports.default;
}

function hooks() {
  const values = [], effects = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      const at = cursor++;
      if (!(at in values)) values[at] = typeof initial === "function" ? initial() : initial;
      return [values[at], (next) => { values[at] = typeof next === "function" ? next(values[at]) : next; }];
    },
    useRef: (initial) => {
      const at = cursor++;
      if (!(at in values)) values[at] = { current: initial };
      return values[at];
    },
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useEffect: (effect) => effects.push(effect),
    useContext: () => ({}),
  };
  return { react, effects, render: (component, props = {}) => { cursor = 0; return component(props); } };
}
const native = {
  View: "View", Text: "Text", Image: "Image", TouchableOpacity: "TouchableOpacity",
  TouchableWithoutFeedback: "TouchableWithoutFeedback", ScrollView: "ScrollView",
  FlatList: "FlatList", ActivityIndicator: "ActivityIndicator", Modal: "Modal",
  StyleSheet: { create: (styles) => styles }, Platform: { OS: "android" }, UIManager: {},
  LayoutAnimation: { configureNext() {}, Presets: { easeInEaseOut: {} } },
};
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children), ...nodes(tree.props?.ListHeaderComponent),
    ...nodes(tree.props?.topContent), ...nodes(tree.props?.ListFooterComponent)];
}
function text(tree) {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  return text(tree?.props?.children || []);
}
const labeled = (tree, label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label);
const products = [
  { _id: "one", name: "Jacket", brand: "Local", category: "clothes", price: 30, countInStock: 4, image: "jacket.png", isFeatured: true },
  { _id: "two", name: "Cooking pot", category: { _id: "home" }, price: 12, countInStock: 2, image: "pot.png" },
];
const categories = [{ _id: "clothes", name: "Clothes" }, { _id: "home", name: "Home" }];

function catalog(width = 390, fail = false) {
  const h = hooks();
  const component = load("Screens\\Products\\ProductContainer.js", {
    react: h.react, "react-native": { ...native, useWindowDimensions: () => ({ width }) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@react-navigation/native": { useFocusEffect: (effect) => { if (!h.effects.length) h.effects.push(effect); } },
    "react-native-paper": { Searchbar: "Searchbar" },
    "react-native-vector-icons/FontAwesome5": "Icon",
    "../../assets/common/baseUrl": "https://example.invalid/",
    "../../assets/common/requestRetry": {
      getWithRetry: async (url) => {
        if (fail) throw new Error("Offline");
        return { data: url.endsWith("products") ? products : categories };
      }, isServiceUnavailableError: () => false,
    },
    "../../assets/common/getImageUrl": (product) => product.image,
    "./ProductList": "ProductList", "./SearchedProducts": "SearchedProducts",
    "./CategoriesFilter": "CategoriesFilter", "./AdvancedFilters": "AdvancedFilters",
  });
  const routes = [];
  const render = () => h.render(component, { navigation: { navigate: (...args) => routes.push(args) } });
  return { ...h, render, routes, start: async () => {
    render();
    h.effects[0]();
    await new Promise(setImmediate);
    return render();
  } };
}

test("home uses real catalog data, responsive columns and working service shortcuts", async () => {
  for (const [width, columns] of [[390, 2], [768, 4]]) {
    const ui = catalog(width);
    const tree = await ui.start();
    const list = nodes(tree).find((node) => node.type === "FlatList" && node.props.numColumns);
    assert.equal(list.props.numColumns, columns);
    assert.equal(list.props.data.length, 2);
    assert.equal(list.props.renderItem({ item: products[0] }).props.columns, columns);
    const top = nodes(tree);
    assert.ok(top.findIndex((node) => node.type === "Searchbar") < top.findIndex((node) => node.props?.accessibilityLabel === "Ride"));
    assert.ok(top.some((node) => text(node) === "Popular Products"));
    assert.ok(top.some((node) => text(node) === "Secure Payment"));
    for (const [label, route] of [["Ride", "RideBooking"], ["Store", "Stores"], ["Service Request", "Service Request"]]) {
      labeled(tree, label).props.onPress();
      assert.equal(ui.routes.at(-1)[0], route);
    }
  }
});

test("redesigned catalog preserves category, search and advanced filtering; view all resets them", async () => {
  const ui = catalog();
  let tree = await ui.start();
  nodes(tree).find((node) => node.type === "CategoriesFilter").props.categoryFilter("Home");
  tree = ui.render();
  assert.equal(nodes(tree).find((node) => node.props?.numColumns).props.data[0]._id, "two");
  nodes(tree).find((node) => node.type === "Searchbar").props.onChangeText("Jacket");
  tree = ui.render();
  assert.equal(nodes(tree).find((node) => node.props?.numColumns).props.data.length, 0);
  labeled(tree, "View all products").props.onPress();
  tree = ui.render();
  assert.equal(nodes(tree).find((node) => node.props?.numColumns).props.data.length, 2);
  nodes(tree).find((node) => node.type === "AdvancedFilters").props.onFilterChange("minPrice", "20");
  tree = ui.render();
  assert.equal(nodes(tree).find((node) => node.props?.numColumns).props.data[0]._id, "one");
  labeled(tree, "View all products").props.onPress();
  tree = ui.render();
  nodes(tree).find((node) => node.type === "Searchbar").props.onFocus();
  tree = ui.render();
  assert.ok(nodes(tree).find((node) => node.type === "SearchedProducts"));
});

test("catalog failures remain visible rather than being replaced by reference products", async () => {
  const tree = await catalog(390, true).start();
  assert.ok(nodes(tree).some((node) => text(node).includes("Could not load products")));
  assert.equal(nodes(tree).find((node) => node.props?.numColumns).props.data.length, 0);
});

test("category circles use matching real products, preserve selection, and provide an all button", () => {
  const h = hooks(), selected = [];
  const component = load("Screens\\Products\\CategoriesFilter.js", {
    react: h.react, "react-native": native, "react-native-vector-icons/FontAwesome5": "Icon",
    "../../assets/common/getImageUrl": (product) => product.image,
  });
  const tree = h.render(component, { categories, products, active: 1,
    categoryFilter: (name) => selected.push(name), setActive() {} });
  assert.ok(nodes(tree).some((node) => node.type === "Image" && node.props.source.uri === "pot.png"));
  assert.equal(labeled(tree, "Home").props.accessibilityState.selected, true);
  labeled(tree, "Clothes").props.onPress();
  labeled(tree, "All categories").props.onPress();
  assert.deepEqual(selected, ["Clothes", "all"]);
});

test("product cards retain regional cart identity, stop detail-navigation bubbling and show only actual ratings", async () => {
  const h = hooks(), added = [], toasts = [];
  const component = load("Screens\\Products\\ProductCard.js", {
    react: h.react, "react-native": native, "react-native-vector-icons/FontAwesome5": "Icon",
    "react-native-toast-message": { show: (value) => toasts.push(value) },
    "../../assets/common/getImageUrl": (product) => product.image,
    "../../assets/common/currency": { useCurrency: () => ({ formatPrice: (price) => `$${price.toFixed(2)}` }) },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_ShopUSA" },
    "../../assets/common/storefront": { useStoreCart: () => (product) => { added.push(product); return true; } },
  });
  let tree = h.render(component, { ...products[0], storefrontId: "store", inventoryManaged: true });
  assert.ok(!text(tree).includes("4.8"));
  assert.match(text(tree), /\$30\.00/);
  let stopped = false;
  await labeled(tree, "Add Jacket to cart").props.onPress({ stopPropagation: () => { stopped = true; } });
  assert.equal(stopped, true);
  assert.equal(added[0].databaseName, "E_ShopUSA");
  assert.equal(added[0].storefrontId, "store");
  assert.equal(added[0].inventoryManaged, true);
  assert.equal(toasts.length, 1);
  tree = h.render(component, { ...products[0], countInStock: 0, rating: 4.7, numReviews: 9 });
  assert.equal(labeled(tree, "Add Jacket to cart"), undefined);
  assert.match(text(tree), /Out of Stock/);
  assert.match(text(tree), /4\.7 \(9\)/);
});

test("header provides country, notification, menu and cart controls without dropping inbox actions", () => {
  const h = hooks(), routes = [];
  const component = load("Shared\\Header.js", {
    react: h.react, "react-native": { ...native, useWindowDimensions: () => ({ width: 390 }) },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "../Context/store/Auth": { AuthContext: {} }, "react-native-vector-icons/FontAwesome5": "Icon",
    axios: {}, "@react-native-async-storage/async-storage": {},
    "../assets/common/baseUrl": "https://example.invalid/",
    "../assets/common/databaseConfig": { COUNTRY_DB_MAP: {}, getDatabaseNameFromStorage: async () => "E_ShopUSA" },
    "./CartIcon": "CartIcon",
  });
  const props = { onNavigate: (...args) => routes.push(args), notificationCount: 3 };
  let tree = h.render(component, props);
  assert.match(text(tree), /Addu Genet Eshop/);
  assert.ok(labeled(tree, "Notifications, 3 unread"));
  labeled(tree, "Open cart").props.onPress();
  assert.equal(routes.at(-1)[0], "Cart");
  labeled(tree, "Open shopping menu").props.onPress();
  tree = h.render(component, props);
  assert.ok(nodes(tree).some((node) => node.type === "Modal" && node.props.visible));
  const ride = nodes(tree).find((node) => node.type === "TouchableOpacity" && text(node) === "Book a ride");
  ride.props.onPress();
  assert.equal(routes.at(-1)[0], "Home");
  assert.equal(routes.at(-1)[1].screen, "RideBooking");
  labeled(tree, "Notifications, 3 unread").props.onPress();
  tree = h.render(component, props);
  assert.ok(nodes(tree).some((node) => node.type === "Modal" && node.props.visible));
  assert.ok(nodes(tree).some((node) => text(node) === "Mark all as read"));
});
