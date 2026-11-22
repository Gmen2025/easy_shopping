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
    useState: (initial) => [typeof initial === "function" ? initial() : initial, () => {}], useRef: (initial) => ({ current: initial }), Fragment: "Fragment" };
  const dependencies = {
    react: React,
    "react-native": new Proxy({ StyleSheet: { create: (styles) => styles } }, { get: (target, key) => target[key] || key }),
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

test("driver and store deposit methods show bank details, fall back to available gateways, and submit the selected method", async () => {
  const file = path.join(__dirname, "..", "Screens", "Finance", "DepositWallet.js");
  const { code } = babel.transformSync(fs.readFileSync(file, "utf8"), {
    filename: file, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const nodes = (node) => !node || typeof node !== "object" ? [] : Array.isArray(node) ? node.flatMap(nodes) :
    [node, ...nodes(node.props?.children)];
  for (const kind of ["driver", "store"]) {
    const state = [], calls = [], opened = [];
    let cursor = 0;
    const React = {
      createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
      useState: (initial) => {
        const index = cursor++;
        if (!(index in state)) state[index] = typeof initial === "function" ? initial() : initial;
        return [state[index], (next) => { state[index] = typeof next === "function" ? next(state[index]) : next; }];
      },
      useRef: (initial) => {
        const index = cursor++;
        if (!(index in state)) state[index] = { current: initial };
        return state[index];
      },
      Fragment: "Fragment",
    };
    const dependencies = {
      react: React,
      "react-native": new Proxy({
        StyleSheet: { create: (styles) => styles }, Alert: { alert() {} },
        Linking: { openURL: async (url) => opened.push(url) },
      }, { get: (target, key) => target[key] || key }),
      "expo-crypto": { randomUUID: () => "unique-request-1" },
      "../../assets/common/finance": {
        financeMoney: (value, currency) => `${currency} ${value.toFixed(2)}`,
        financeError: (error) => error.message,
        financeRequest: async (url, options) => {
          calls.push({ url, ...options });
          return options.data.method === "bank" ? {} : { paymentUrl: "https://gateway.example.test/pay" };
        },
      },
    };
    const result = {};
    vm.runInNewContext(code, { exports: result, require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    } });
    let currentWallet = { ...wallet, bankAccounts: [{ _id: "bank1", bankName: "Example Bank",
      accountNumber: "123456", accountHolderName: "Company", bankCode: "CODE", additionalInfo: "Use reference" }],
    methods: { bank: true, card: false, telebirr: true } };
    const render = () => {
      cursor = 0;
      return nodes(result.default({ wallet: currentWallet, account: { _id: kind, depositPolicy: policy },
        path: `accounts/${kind}/me`, admin: false, reload: async () => {} }));
    };
    const method = (tree, label) => tree.find((node) => node.props?.accessibilityRole === "radio" && node.props.accessibilityLabel === label);
    let tree = render();
    const text = tree.filter((node) => node.type === "Text").flatMap((node) => node.props.children);
    assert.ok(text.includes("123456"));
    assert.ok(text.includes("Company"));
    assert.equal(method(tree, "Bank transfer / company receipt").props.accessibilityState.checked, true);
    assert.equal(method(tree, "Card").props.disabled, true);
    tree.find((node) => node.props?.accessibilityLabel === "Deposit amount (ETB)").props.onChangeText("10");
    render().find((node) => node.props?.accessibilityLabel === "Transfer / company receipt reference").props.onChangeText("receipt");
    render().find((node) => node.props?.accessibilityLabel === "Actual deposit local date/time (YYYY-MM-DDTHH:mm)").props.onChangeText("2026-01-01T10:00");
    await render().find((node) => node.props?.accessibilityLabel === "Submit deposit / open payment").props.onPress();
    assert.equal(calls[0].data.method, "bank");
    assert.equal(calls[0].data.reference, "receipt");
    assert.ok(calls[0].data.depositedAt);
    assert.equal(opened.length, 0);
    currentWallet = { ...currentWallet, methods: { bank: false, card: false, telebirr: true } };
    tree = render();
    assert.equal(method(tree, "Telebirr").props.accessibilityState.checked, true);
    assert.ok(!tree.some((node) => node.props?.accessibilityLabel === "Transfer / company receipt reference"));
    tree.find((node) => node.props?.accessibilityLabel === "Deposit amount (ETB)").props.onChangeText("20");
    tree = render();
    await tree.find((node) => node.props?.accessibilityLabel === "Submit deposit / open payment").props.onPress();
    assert.equal(calls[1].url, `accounts/${kind}/me/wallet/deposits`);
    assert.equal(calls[1].data.method, "telebirr");
    assert.equal(calls[1].data.amount, 20);
    assert.equal(calls[1].data.reference, undefined);
    assert.deepEqual(opened, ["https://gateway.example.test/pay"]);
    currentWallet = { ...currentWallet, currency: "USD", methods: { bank: true, card: true, telebirr: false } };
    tree = render();
    method(tree, "Card").props.onPress();
    tree = render();
    assert.equal(method(tree, "Card").props.accessibilityState.checked, true);
    tree.find((node) => node.props?.accessibilityLabel === "Deposit amount (USD)").props.onChangeText("30");
    await render().find((node) => node.props?.accessibilityLabel === "Submit deposit / open payment").props.onPress();
    assert.equal(calls[2].data.method, "card");
    assert.equal(calls[2].data.currency, "USD");
    currentWallet = { ...currentWallet, bankAccounts: [], methods: { bank: false, card: false, telebirr: false } };
    tree = render();
    assert.equal(tree.find((node) => node.props?.accessibilityLabel === "Submit deposit / open payment").props.disabled, true);
    assert.ok(tree.some((node) => node.props?.accessibilityRole === "alert" &&
      node.props.children.includes("No deposit payment method is currently available. Contact Admin.")));
    assert.ok(tree.some((node) => node.type === "Text" && node.props.children.includes("No company bank account is configured for ")));
  }
});
