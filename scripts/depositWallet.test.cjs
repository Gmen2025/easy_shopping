const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const babel = require("@babel/core");

const filename = path.join(__dirname, "..", "assets", "common", "finance.js");
const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
  filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
});
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject, require: () => ({}) });
const policy = { enabled: true, lowBalance: 50, minimumBalance: 0 };
const wallet = { enabled: true, currency: "ETB", balance: -2, state: "blocked", transactions: [], legacyTransactions: [],
  bankAccounts: [], methods: { bank: true, card: false, telebirr: false } };
test("mobile deposit wallets preserve negative balances and explicit disabled/blocked states", () => {
  assert.equal(exportsObject.validateDepositWallet(wallet, policy), wallet);
  assert.equal(exportsObject.validateDepositWallet({ ...wallet, enabled: false, state: "off" }, policy).state, "off");
});
test("mobile wallet validation rejects missing availability, balances, history, currency and invalid thresholds", () => {
  for (const value of [undefined, { ...wallet, balance: NaN }, { ...wallet, currency: "EUR" },
    { ...wallet, transactions: null }, { ...wallet, methods: {} }]) {
    assert.throws(() => exportsObject.validateDepositWallet(value, policy), /deposit wallet/);
  }
  assert.throws(() => exportsObject.validateDepositWallet(wallet, { ...policy, lowBalance: 0 }), /deposit wallet/);
});
test("mobile Admin sees both regional switch states and deposits remain possible when blocked, not when disabled", () => {
  const filename = path.join(__dirname, "..", "Screens", "Finance", "DepositWallet.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const React = { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => [initial, () => {}], useRef: (initial) => ({ current: initial }), Fragment: "Fragment" };
  const dependencies = {
    react: React,
    "react-native": new Proxy({ StyleSheet: { create: (styles) => styles } }, { get: (target, key) => target[key] || key }),
    "@react-native-picker/picker": { Picker: { Item: "PickerItem" } },
    "expo-crypto": {},
    "../../assets/common/finance": { financeMoney: (value, currency) => `${currency} ${value.toFixed(2)}` },
  };
  const result = {};
  vm.runInNewContext(code, { exports: result, require: (name) => dependencies[name] });
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) :
    [node, ...nodes(node.props?.children)];
  for (const enabled of [true, false]) {
    const tree = result.default({ wallet: { ...wallet, enabled }, account: { _id: "store1", depositPolicy: policy },
      path: "accounts/store/me", admin: true, reload: async () => {} });
    const buttons = nodes(tree).filter((node) => node.type === "TouchableOpacity");
    assert.ok(buttons.some((button) => button.props.accessibilityLabel === `Turn ${enabled ? "OFF" : "ON"} regional cash deposit requirement`));
    assert.equal(buttons.find((button) => button.props.accessibilityLabel === "Submit deposit / open payment").props.disabled, !enabled);
  }
});
