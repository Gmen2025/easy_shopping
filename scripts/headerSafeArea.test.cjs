const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function nodes(value) {
  if (!value || typeof value !== "object") return [];
  return Array.isArray(value) ? value.flatMap(nodes) : [value, ...nodes(value.props?.children)];
}

function renderHeader(platform, width) {
  const filename = path.join(__dirname, "..", "Shared", "Header.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const states = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => {
        states[index] = typeof value === "function" ? value(states[index]) : value;
      }];
    },
    useContext: () => ({}),
    useEffect: () => {},
    useRef: (initial) => ({ current: initial }),
  };
  const native = {
    StyleSheet: { create: (styles) => styles },
    Platform: { OS: platform },
    useWindowDimensions: () => ({ width }),
  };
  const dependencies = {
    react,
    "react-native": new Proxy(native, { get: (target, key) => target[key] || key }),
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "../Context/store/Auth": { AuthContext: {} },
    "react-native-vector-icons/FontAwesome5": "Icon",
    axios: {},
    "@react-native-async-storage/async-storage": {},
    "../assets/common/baseUrl": "",
    "../assets/common/databaseConfig": { COUNTRY_DB_MAP: {} },
    "./CartIcon": "CartIcon",
    "../assets/common/useServiceAvailability": () => ({ settings: {} }),
    "../assets/addugenet-header.png": "logo",
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  const destinations = [];
  return {
    destinations,
    render: () => {
      cursor = 0;
      return exports.default({ onNavigate: (...args) => destinations.push(args) });
    },
  };
}

test("root safe area is available before the navigation container is ready", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "App.js"), "utf8");
  assert.match(app, /<SafeAreaProvider initialMetrics=\{initialWindowMetrics\}>/);
  assert.ok(app.indexOf("<SafeAreaProvider") < app.indexOf("<Header"));
  assert.ok(app.indexOf("<Header") < app.indexOf("<NavigationContainer"));
  assert.ok(app.indexOf("</NavigationContainer>") < app.indexOf("</SafeAreaProvider>"));
});

for (const platform of ["android", "ios"]) {
  test(`${platform} header remains below the safe area with accessible tap targets`, () => {
    for (const width of [320, 390, 768]) {
      const ui = renderHeader(platform, width);
      let tree = ui.render();
      assert.equal(tree.type, "SafeAreaView");
      assert.deepEqual(Array.from(tree.props.edges), ["top", "left", "right"]);
      assert.equal(tree.props.style.paddingTop, 8);

      const find = (label) => nodes(tree).find((node) => node.props?.accessibilityLabel === label);
      const menu = find("Open shopping menu");
      const bell = find("Notifications, 0 unread");
      const cart = find("Open cart");
      const country = find("Shopping country: Ethiopia. Change country");
      for (const button of [menu, bell, cart]) {
        assert.ok(button.props.style.width >= 44);
        assert.ok((button.props.style.minHeight || button.props.style.height) >= 44);
      }
      assert.ok(country.props.style.minHeight >= 44);

      menu.props.onPress();
      tree = ui.render();
      assert.ok(nodes(tree).some((node) => node.type === "Modal" && node.props.visible));
      bell.props.onPress();
      tree = ui.render();
      assert.ok(nodes(tree).filter((node) => node.type === "Modal" && node.props.visible).length >= 2);
      cart.props.onPress();
      assert.equal(ui.destinations[0][0], "Cart");
    }
  });
}
