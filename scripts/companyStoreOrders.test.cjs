const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function loadComponent(relativePath, { dashboard, navigation } = {}) {
  const filename = path.join(__dirname, "..", relativePath);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  let stateIndex = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useCallback: (fn) => fn,
    useContext: () => ({ user: { name: "Store owner" }, logout: () => {} }),
    useState: (initial) => {
      const value = dashboard && stateIndex === 1 ? dashboard
        : dashboard && initial === true ? false : initial;
      stateIndex += 1;
      return [value, () => {}];
    },
  };
  const dependencies = {
    react,
    "react-native": new Proxy({ StyleSheet: { create: (styles) => styles } }, {
      get: (target, name) => target[name] || name,
    }),
    "@react-navigation/native": { useFocusEffect: () => {} },
    "react-native-vector-icons/FontAwesome": "Icon",
    "@react-native-async-storage/async-storage": {},
    axios: {},
    "../../Context/store/Auth": { AuthContext: {} },
    "../../assets/common/baseUrl": "",
    "../../assets/common/currency": { useCurrency: () => ({ formatPrice: (value) => `$${value}` }) },
    "../../assets/common/databaseConfig": {},
    "../../assets/common/delivery": { formatScheduledDeliveryDate: (order) => order.scheduledFor || null },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  }, { filename });
  return (props) => exports.default({ navigation, ...props });
}

function nodes(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(nodes);
  return [value, ...nodes(value.props?.children)];
}

function text(value) {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(text).join("");
  return text(value?.props?.children || []);
}

test("tapping a dashboard order navigates to its products with the exact scoped summary", () => {
  const order = { _id: "order123456", units: 2, sales: 10, orderItems: [] };
  let destination;
  const component = loadComponent("Screens\\Store\\CompanyStoreDashboard.js", {
    dashboard: { store: { name: "Company store" }, recentOrders: [order] },
    navigation: { navigate: (screen, params) => { destination = { screen, params }; } },
  });
  const list = nodes(component({})).find((node) => node.type === "FlatList" && node.props.ListHeaderComponent);
  const button = nodes(list.props.ListHeaderComponent).find((node) => node.props?.accessibilityRole === "button");
  button.props.onPress();
  assert.equal(destination.screen, "CompanyStoreOrderDetails");
  assert.equal(destination.params.order, order);
  assert.equal(destination.params.storeName, "Company store");
});

test("order details display scoped products, quantities, status, schedule and clearly labeled totals", () => {
  const component = loadComponent("Screens\\Store\\CompanyStoreOrderDetails.js");
  const item = { quantity: 3, product: { _id: "product1", name: "Coffee", price: 4 } };
  const tree = component({ route: { params: {
    storeName: "Company store",
    order: { _id: "order123456", status: "2", deliveryStatus: "Pending", scheduledFor: "2026-10-04",
      orderItems: [item], units: 3, sales: 12, deliveryFee: 5, totalPrice: 30 },
  } } });
  assert.equal(tree.props.data[0], item);
  assert.match(text(tree.props.ListHeaderComponent), /Processing/);
  assert.match(text(tree.props.ListHeaderComponent), /2026-10-04/);
  const product = text(tree.props.renderItem({ item }));
  assert.match(product, /Coffee/);
  assert.match(product, /Quantity: 3/);
  assert.match(product, /Line total: \$12/);
  assert.match(text(tree.props.ListFooterComponent), /Store product total: \$12/);
  assert.match(text(tree.props.ListFooterComponent), /Whole-order total: \$30/);
});

test("missing orders, removed products and absent prices are explicit, not zero-priced", () => {
  const component = loadComponent("Screens\\Store\\CompanyStoreOrderDetails.js");
  assert.match(text(component({ route: {} })), /Order details unavailable/);
  const tree = component({ route: { params: { order: { _id: "order1", orderItems: [] } } } });
  assert.equal(tree.props.data.length, 0);
  assert.match(text(tree.props.ListEmptyComponent), /No product details/);
  const product = text(tree.props.renderItem({ item: { quantity: 2, product: null } }));
  assert.match(product, /Product no longer available/);
  assert.match(product, /Unit price: Unavailable/);
  assert.match(product, /Line total: Unavailable/);
});
