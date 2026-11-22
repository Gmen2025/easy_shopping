const test = require("node:test");
const assert = require("node:assert/strict");
const babel = require("@babel/core");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const vm = require("node:vm");

const filename = path.resolve(__dirname, "..", "assets", "common", "storeLogo.js");
const compiled = babel.transformFileSync(filename, {
  babelrc: false, configFile: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
}).code;
const loaded = new Module(filename, module);
loaded._compile(compiled, filename);
const { storeInitials, normalizeStoreLogo } = loaded.exports;

test("mobile store initials use the registered name and match website behavior", () => {
  for (const [name, expected] of [["Bole Market", "BM"], ["Addu Genet Easy Shop", "AS"],
    [" Sunshine ", "S"], ["ሐበሻ ገበያ", "ሐገ"], ["Fresh-Food Market", "FM"], ["", "ST"]]) {
    assert.equal(storeInitials(name), expected);
  }
});

test("mobile logos remain optional and removable, with secure URLs for persisted images", () => {
  assert.equal(normalizeStoreLogo(), "");
  assert.equal(normalizeStoreLogo(" "), "");
  assert.equal(normalizeStoreLogo(" https://example.test/logo.png "), "https://example.test/logo.png");
  for (const value of ["file:///local.png", "http://example.test/logo.png", "data:image/png;base64,abc",
    "https://user:password@example.test/logo.png", "https://example.test/image one.png",
    `https://example.test/${"a".repeat(500)}`]) assert.throws(() => normalizeStoreLogo(value), /HTTPS/);
});

test("all modified mobile logo and store screens compile with the installed Expo preset", () => {
  for (const file of ["Shared/StoreLogo.js", "Shared/StoreLogoField.js", "Screens/Admin/AdminStores.js",
    "Screens/Store/StoreManagement.js", "Screens/Store/StoreDirectory.js", "Screens/Store/Storefront.js"]) {
    assert.ok(babel.transformFileSync(path.resolve(__dirname, "..", ...file.split("/")), {
      presets: ["babel-preset-expo"],
    }).code, file);
  }
});

test("company store country choices remain visible and update the address form without losing input", () => {
  const file = path.resolve(__dirname, "..", "Screens", "Admin", "AdminStores.js");
  const { code } = babel.transformSync(fs.readFileSync(file, "utf8"), {
    filename: file, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const state = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in state)) state[index] = initial;
      return [state[index], (next) => {
        state[index] = typeof next === "function" ? next(state[index]) : next;
      }];
    },
    useCallback: (callback) => callback,
    useEffect: () => {},
  };
  const Picker = Object.assign(() => null, { Item: "PickerItem" });
  const dependencies = {
    react,
    "react-native": {
      ...Object.fromEntries(["ActivityIndicator", "FlatList", "Modal", "ScrollView", "Text", "TextInput",
        "TouchableOpacity", "View"].map((name) => [name, name])),
      Alert: { alert() {} },
      StyleSheet: { create: (styles) => styles },
    },
    "@react-navigation/native": { useFocusEffect() {} },
    "@react-native-picker/picker": { Picker },
    "expo-location": {},
    "react-native-vector-icons/FontAwesome": "Icon",
    "@react-native-async-storage/async-storage": {},
    axios: {},
    "../../assets/common/baseUrl": "",
    "../../assets/common/databaseConfig": {},
    "../../assets/common/storefront": {},
    "../../Shared/StoreLogo": "StoreLogo",
    "../../Shared/StoreLogoField": "StoreLogoField",
    "../../assets/common/storeLogo": {},
  };
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  const nodes = (tree) => {
    if (!tree || typeof tree !== "object") return [];
    if (Array.isArray(tree)) return tree.flatMap(nodes);
    return [tree, ...nodes(tree.props?.children)];
  };
  const header = () => {
    cursor = 0;
    const tree = exports.default({ navigation: {} });
    const list = nodes(tree).find((node) => node.type === "FlatList");
    return nodes(list.props.ListHeaderComponent);
  };
  const country = (items, label) => items.find((node) =>
    node.props?.accessibilityRole === "radio" && node.props.accessibilityLabel === label);
  let items = header();
  assert.equal(country(items, "Ethiopia").props.accessibilityState.checked, true);
  assert.equal(country(items, "USA").props.accessibilityState.checked, false);
  items.find((node) => node.props?.placeholder === "Store name").props.onChangeText("Market");
  items = header();
  country(items, "USA").props.onPress();
  items = header();
  assert.equal(country(items, "USA").props.accessibilityState.checked, true);
  assert.equal(country(items, "Ethiopia").props.accessibilityState.checked, false);
  assert.equal(items.find((node) => node.props?.placeholder === "Store name").props.value, "Market");
  assert.ok(items.some((node) => node.props?.placeholder === "Zip Code"));
  country(items, "Ethiopia").props.onPress();
  items = header();
  assert.equal(country(items, "Ethiopia").props.accessibilityState.checked, true);
  assert.ok(!items.some((node) => node.props?.placeholder === "Zip Code"));
  assert.equal(items.find((node) => node.props?.placeholder === "Store name").props.value, "Market");
});
