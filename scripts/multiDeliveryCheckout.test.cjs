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
  vm.runInNewContext(code, { exports, console, process: { env: {} }, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
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
function harness(request, { resumeId, database = "E_ShopUSA", params = {}, exchangeState } = {}) {
  const states = [];
  let cursor = 0;
  let effects = [];
  const actions = [];
  const dialogs = [];
  const item = { _id: "product", name: "Box", quantity: 3, price: 10, databaseName: database };
  const react = {
    createElement: (type, props, ...children) => {
      const passed = { ...props, children };
      return typeof type === "function" ? type(passed) : { type, props: passed };
    },
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef: (value) => {
      const index = cursor++;
      if (!(index in states)) states[index] = { current: value };
      return states[index];
    },
    useEffect: (effect) => effects.push(effect),
  };
  const native = new Proxy({ StyleSheet: { create: (value) => value }, Alert: { alert: (...args) => dialogs.push(args) } }, {
    get: (target, name) => target[name] || name,
  });
  const currency = { useCurrency: () => ({ formatPrice: (value) => `${/usa/i.test(database) ? "$" : "ETB "}${Number(value).toFixed(2)}` }) };
  const exchange = load("assets\\common\\exchangeRate.js", { "./storefront": { apiRequest: async () => exchangeState } });
  const summary = load("Shared\\DeliveryCheckout.js", { react, "react-native": native, "../assets/common/currency": currency, "../assets/common/exchangeRate": exchange });
  const { default: Component } = load("Screens\\Cart\\Checkout\\MultiDeliveryCheckout.js", {
    react, "react-native": native, "react-native-paper": { Button: "Button", TextInput: "TextInput" },
    "@react-native-picker/picker": { Picker: Object.assign((props) => ({ type: "Picker", props }), { Item: "PickerItem" }) },
    "react-redux": { useSelector: (selector) => selector({ cart: { cartItems: [item] } }), useDispatch: () => (action) => actions.push(action) },
    "../../../Shared/CheckoutCardPayment": { default: "CardPayment", canPayByCard: false, nativeCardAvailable: false, __esModule: true },
    "../../../assets/common/cartIdentity": { cartItemKey: (entry) => `key-${entry._id}` },
    "../../../assets/common/storefront": { storeRequest: request },
    "../../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => database, sanitizeDatabaseName: (value) => value },
    "../../../assets/common/exchangeRate": exchange,
    "../../../store/cartSlice": { beginCheckout: (payload) => ({ type: "begin", payload }), completeCheckout: (payload) => ({ type: "complete", payload }) },
    "../../../assets/common/currency": currency,
    "../../../Shared/DeliveryCheckout": summary,
  });
  const render = () => {
    cursor = 0;
    effects = [];
    return Component({ navigation: { navigate() {}, goBack() {} }, route: { params: { ...params, ...(resumeId ? { groupId: resumeId } : {}) } } });
  };
  const start = async () => {
    render();
    effects.forEach((effect) => effect());
    for (let index = 0; index < 10; index++) await new Promise((resolve) => setImmediate(resolve));
  };
  const button = (label) => nodes(render()).find((node) => node.type === "Button" && text(node) === label);
  const input = (label) => nodes(render()).find((node) => node.type === "TextInput" && node.props.label === label);
  return { start, render, button, input, actions, dialogs };
}

const freshExchange = () => ({ enabled: true, active: true, birrPerUsd: 3, revision: 5, source: "manual",
  appliedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() });
test("international product checkout adds shipping before converting to birr, only offers ETB bank and waits for verification", async () => {
  const policy = { ...freshExchange(), birrPerUsd: 150, direction: "usd-to-etb" };
  const recipient = { label: "Family", address1: "1 Addis Street", address2: "", city: "Addis Ababa", zip: "1000", country: "Ethiopia", phone: "123" };
  const hub = { label: "US hub", address1: "1 US Street", city: "US City", country: "USA" };
  const international = { shippingFee: 20, hub, customsNotice: "Customs/import charges are excluded and paid separately by the recipient.",
    shipments: [{ id: "current", recipient, billableKg: 3, shippingUsd: 20, status: "awaiting_hub", history: [] }] };
  let quote;
  const ui = harness(async (path, options) => {
    if (path === "delivery-current-address") return recipient;
    if (path === "delivery-addresses") return [];
    if (path === "delivery-bank-accounts?currency=ETB") return [{ _id: "etb-bank", currency: "ETB", bankName: "ETB Bank" }];
    if (path === "checkouts/quote") {
      assert.equal(options.data.paymentCurrency, "etb");
      assert.equal(options.data.addresses[0].country, "Ethiopia");
      quote = { _id: "export123456", ...options.data, kind: "products", exchangeRate: policy, international,
        currency: "etb", totalPrice: 53, itemsSubtotal: 30, deliveryFee: 3, paymentAmount: 7950, status: "quote", expiresAt: policy.expiresAt,
        deliveries: [{ key: "pickup", address: hub, store: { _id: "store", name: "US pickup" },
          lines: [{ product: "product", quantity: 3, name: "US box" }], cargo: { weightKg: 3, volumeLiters: 3 },
          distanceKm: 2, vehicle: "car", vehicleOptions: [{ type: "car", fee: 3 }, { type: "van", fee: 6 }] }] };
      return quote;
    }
    if (path === "checkouts/export123456/prepare") {
      assert.equal(options.data.method, "bank");
      assert.equal(options.data.bankAccountId, "etb-bank");
      return { ...quote, totalPrice: 56, deliveryFee: 6, paymentAmount: 8400, status: "awaiting_payment", paymentMethod: "bank" };
    }
    if (path === "checkouts/export123456/confirm") return { ...quote, status: "bank_review", paymentMethod: "bank", paymentAmount: 8400, totalPrice: 56 };
    throw new Error(path);
  }, { database: "E_ShopUSA", params: { paymentCurrency: "etb" }, exchangeState: policy });
  await ui.start();
  await ui.button("Calculate routes & recommend vehicles").props.onPress();
  assert.match(text(ui.render()), /International shipping: \$20.00/);
  assert.match(text(ui.render()), /Birr payment estimate: ETB 7950.00/);
  assert.match(text(ui.render()), /Customs\/import charges are excluded/);
  assert.equal(nodes(ui.render()).some((node) => node.props.value === "card" || node.props.value === "cash"), false);
  nodes(ui.render()).find((node) => node.type === "Picker" && node.props.selectedValue === "car").props.onValueChange("van");
  assert.match(text(ui.render()), /Birr payment estimate: ETB 8400.00/);
  await ui.button("Reserve all deliveries & continue").props.onPress();
  ui.input("Transfer sender").props.onChangeText("Customer");
  ui.input("Transfer reference").props.onChangeText("ETB receipt");
  await ui.button("Submit transfer reference").props.onPress();
  assert.match(text(ui.render()), /stores cannot start fulfillment before funds are verified/);
  assert.match(text(ui.render()), /Birr payment: ETB 8400.00/);
  assert.equal(ui.button("Submit transfer reference"), undefined);
  assert.equal(ui.actions.filter((entry) => entry.type === "complete").length, 1);
});
test("international birr recovery preserves a stale rate snapshot and shows Ethiopian recipient, not a second payment", async () => {
  const policy = { ...freshExchange(), direction: "usd-to-etb", appliedAt: new Date(0).toISOString() };
  const ui = harness(async (path) => {
    assert.equal(path, "checkouts/exportRecover");
    return { _id: "exportRecover", kind: "products", cart: [], totalPrice: 50, itemsSubtotal: 30, deliveryFee: 0,
      status: "bank_review", paymentMethod: "bank", paymentStatus: "pending", paymentAmount: 7500, exchangeRate: policy,
      international: { shippingFee: 20, customsNotice: "Customs excluded", shipments: [{ id: "family", recipient: { label: "Family", address1: "Addis", city: "Addis Ababa" }, status: "awaiting_hub" }] } };
  }, { database: "E_ShopUSA", resumeId: "exportRecover", exchangeState: { enabled: false } });
  await ui.start();
  assert.match(text(ui.render()), /Birr payment: ETB 7500.00/);
  assert.match(text(ui.render()), /Ethiopian recipient: Family - Addis/);
  assert.equal(ui.button("Submit transfer reference"), undefined);
  assert.equal(ui.actions.length, 0);
});
test("stale international birr exchange policy prevents address/payment requests", async () => {
  const ui = harness(async () => assert.fail("No address or payment request expected"), { database: "E_ShopUSA",
    params: { paymentCurrency: "etb" }, exchangeState: { active: false, enabled: true, message: "Birr checkout inactive: rate not updated within 24 hours." } });
  await ui.start();
  assert.match(text(ui.render()), /Birr checkout inactive/);
  assert.equal(ui.dialogs.length, 1);
});
test("USD product checkout retains ETB totals, previews vehicle-adjusted dollars, excludes cash and submits currency", async () => {
  const policy = freshExchange();
  let quoted;
  const current = { label: "Home", address1: "123 Street", address2: "", city: "Addis Ababa", zip: "1000", country: "Ethiopia", phone: "123" };
  const ui = harness(async (path, options) => {
    if (path === "delivery-current-address") return current;
    if (path === "delivery-addresses") return [];
    if (path === "delivery-bank-accounts?currency=USD") return [{ _id: "usd-bank", currency: "USD", bankName: "USD Bank" }];
    if (path === "checkouts/quote") {
      assert.equal(options.data.paymentCurrency, "usd");
      quoted = { _id: "usd123456", ...options.data, exchangeRate: policy, currency: "usd", paymentAmount: 11,
        itemsSubtotal: 30, deliveryFee: 3, totalPrice: 33, status: "quote", expiresAt: policy.expiresAt,
        deliveries: [{ key: "delivery", store: { _id: "store", name: "ET pickup" }, address: current,
          lines: [{ product: "product", name: "Box", quantity: 3 }], cargo: { weightKg: 3, volumeLiters: 3 },
          distanceKm: 2, vehicle: "car", vehicleOptions: [{ type: "car", fee: 3 }, { type: "van", fee: 6 }] }] };
      return quoted;
    }
    if (path === "checkouts/usd123456/prepare") {
      assert.equal(options.data.method, "bank");
      assert.equal(options.data.bankAccountId, "usd-bank");
      return { ...quoted, paymentAmount: 12, deliveryFee: 6, totalPrice: 36, status: "awaiting_payment", paymentMethod: "bank" };
    }
    throw new Error(path);
  }, { database: "E_Shopping", params: { paymentCurrency: "usd" }, exchangeState: policy });
  await ui.start();
  await ui.button("Calculate routes & recommend vehicles").props.onPress();
  assert.match(text(ui.render()), /Combined total: ETB 33.00/);
  assert.match(text(ui.render()), /USD payment estimate: USD \$11.00/);
  assert.equal(nodes(ui.render()).some((entry) => entry.props.value === "cash"), false);
  nodes(ui.render()).find((entry) => entry.type === "Picker" && entry.props.selectedValue === "car").props.onValueChange("van");
  assert.match(text(ui.render()), /USD payment estimate: USD \$12.00/);
  await ui.button("Reserve all deliveries & continue").props.onPress();
  assert.match(text(ui.render()), /Combined total: ETB 36.00/);
  assert.match(text(ui.render()), /USD payment: USD \$12.00/);
  assert.match(text(ui.render()), /Locked exchange rate: 1 USD = 3 ETB/);
});
test("expired USD policy blocks new checkout with a visible reason before addresses or payment are requested", async () => {
  let calls = 0;
  const ui = harness(async () => { calls++; throw new Error("Unexpected request"); }, { database: "E_Shopping",
    params: { paymentCurrency: "usd" }, exchangeState: { ...freshExchange(), active: false, message: "The rate has not been updated within 24 hours." } });
  await ui.start();
  assert.equal(calls, 0);
  assert.match(text(ui.render()), /not been updated within 24 hours/);
  assert.equal(ui.dialogs.length, 1);
});
test("service USD checkout uses its own Admin quote and never consumes product cart items", async () => {
  const policy = freshExchange();
  const group = { _id: "service123456", serviceRequest: "service", kind: "service", cart: [], deliveries: [],
    currency: "usd", exchangeRate: policy, paymentAmount: 10, totalPrice: 30, itemsSubtotal: 30, deliveryFee: 0,
    status: "quote", paymentStatus: "pending", expiresAt: policy.expiresAt };
  const ui = harness(async (path, options) => {
    if (path === "service-checkouts/service") return group;
    if (path === "delivery-bank-accounts?currency=USD") return [{ _id: "usd-bank", bankName: "USD Bank", currency: "USD" }];
    if (path === "checkouts/service123456/prepare") {
      assert.equal(options.data.selections.length, 0);
      return { ...group, status: "awaiting_payment", paymentMethod: "bank" };
    }
    if (path === "checkouts/service123456/confirm") return { ...group, status: "placed", paymentMethod: "bank" };
    throw new Error(path);
  }, { database: "E_Shopping", params: { serviceId: "service", paymentCurrency: "usd" }, exchangeState: policy });
  await ui.start();
  assert.match(text(ui.render()), /Service USD checkout/);
  assert.doesNotMatch(text(ui.render()), /Allocate each unit/);
  await ui.button("Accept quote & continue in USD").props.onPress();
  ui.input("Transfer sender").props.onChangeText("Payer");
  ui.input("Transfer reference").props.onChangeText("USD bank transfer");
  await ui.button("Submit transfer reference").props.onPress();
  assert.match(text(ui.render()), /Service quote: ETB 30.00/);
  assert.match(text(ui.render()), /USD payment: USD \$10.00/);
  assert.equal(ui.actions.length, 0);
});
test("USD recovery does not load or gate on today's policy; it shows the saved payment snapshot", async () => {
  const policy = { ...freshExchange(), appliedAt: new Date(0).toISOString() };
  const ui = harness(async (path) => {
    assert.equal(path, "checkouts/recoverUSD");
    return { _id: "recoverUSD", cart: [], status: "awaiting_payment", paymentMethod: "card",
      currency: "usd", exchangeRate: policy, paymentAmount: 10, totalPrice: 30, itemsSubtotal: 30, deliveryFee: 0, expiresAt: policy.expiresAt };
  }, { database: "E_Shopping", resumeId: "recoverUSD", exchangeState: { active: false } });
  await ui.start();
  assert.match(text(ui.render()), /USD payment: USD \$10.00/);
  assert.ok(ui.button("Check payment / finish checkout"));
});

test("checkout UI splits units between current and edited saved addresses, upgrades vehicles and submits one reserved checkout", async () => {
  const calls = [];
  let quoted;
  const current = { label: "Home", address1: "123 Street", address2: "", city: "City", zip: "12345", country: "USA", phone: "12345678" };
  const ui = harness(async (route, options) => {
    calls.push({ route, options });
    if (route === "delivery-current-address") return current;
    if (route === "delivery-addresses" && !options) return [];
    if (route === "delivery-bank-accounts") return [{ _id: "bank", bankName: "Bank", accountHolderName: "Shop" }];
    if (route === "delivery-addresses") return { ...options.data, _id: "saved-office" };
    if (route === "checkouts/quote") {
      assert.deepEqual(Array.from(options.data.allocations, (entry) => entry.quantity), [2, 1]);
      assert.equal(options.data.addresses[0].address1, "123 Street");
      assert.equal(options.data.addresses[1].address1, "456 Office");
      quoted = { _id: "checkout123456", cart: options.data.cart, itemsSubtotal: 30, deliveryFee: 9, totalPrice: 39,
        status: "quote", paymentStatus: "pending", expiresAt: new Date(Date.now() + 600000).toISOString(),
        deliveries: options.data.addresses.map((address, index) => ({ key: `delivery-${index}`, address,
          store: { _id: `store-${index}`, name: `Pickup ${index}`, address: "Pickup street" },
          lines: [{ product: "product", name: "Box", quantity: index ? 1 : 2 }], cargo: { weightKg: 2, volumeLiters: 2 },
          distanceKm: 8, vehicle: "car", vehicleOptions: [{ type: "car", fee: index ? 4 : 5 }, { type: "van", fee: 8 }] })) };
      return quoted;
    }
    if (route === `checkouts/${quoted._id}/prepare`) {
      assert.equal(options.data.method, "bank");
      assert.equal(options.data.bankAccountId, "bank");
      assert.equal(options.data.selections[0].vehicle, "van");
      assert.equal(options.data.selections[1].vehicle, "car");
      return { ...quoted, status: "awaiting_payment", paymentMethod: "bank", deliveryFee: 12, totalPrice: 42, bankAccount: { bankName: "Bank", accountNumber: "123" } };
    }
    throw new Error(`Unexpected API ${route}`);
  });
  await ui.start();
  ui.button("Add another delivery address").props.onPress();
  for (const [label, value] of [["Address label", "Office"], ["Street address", "456 Office"], ["City", "City"],
    ["Postal code", "12345"], ["Country", "USA"], ["Recipient phone", "12345678"]]) ui.input(label).props.onChangeText(value);
  await ui.button("Save address & use").props.onPress();
  ui.input("Quantity for Home").props.onChangeText("2");
  ui.input("Quantity for Office").props.onChangeText("1");
  await ui.button("Calculate routes & recommend vehicles").props.onPress();
  const picker = nodes(ui.render()).find((node) => node.type === "Picker" && node.props.selectedValue === "car");
  picker.props.onValueChange("van");
  assert.match(text(ui.render()), /Combined total: \$42.00/);
  await ui.button("Reserve all deliveries & continue").props.onPress();
  assert.equal(calls.filter((call) => call.route.endsWith("/prepare")).length, 1);
  assert.match(text(ui.render()), /Stock held until/);
  assert.match(text(ui.render()), /Bank payments remain pending until Admin verifies/);
  assert.equal(ui.actions[0].type, "begin");
  assert.equal(ui.actions.some((action) => action.type === "complete"), false);
});

test("interrupted card checkout exposes same-checkout recovery in Expo Go without attempting a second charge", async () => {
  const calls = [];
  const group = { _id: "recover123456", cart: [], status: "awaiting_payment", paymentStatus: "pending", paymentMethod: "card",
    itemsSubtotal: 10, deliveryFee: 2, totalPrice: 12, expiresAt: new Date(Date.now() + 600000).toISOString() };
  const ui = harness(async (route) => {
    calls.push(route);
    if (route === "checkouts/recover123456") return group;
    if (route === "checkouts/recover123456/confirm") return { ...group, status: "placed", paymentStatus: "completed" };
    throw new Error("Unexpected second payment");
  }, { resumeId: group._id });
  await ui.start();
  assert.match(text(ui.render()), /unavailable in Expo Go/);
  assert.equal(ui.button("Pay combined total"), undefined);
  await ui.button("Check payment / finish checkout").props.onPress();
  assert.deepEqual(calls, ["checkouts/recover123456", "checkouts/recover123456/confirm"]);
  assert.match(text(ui.render()), /Payment: completed/);
  assert.equal(ui.actions.at(-1).type, "complete");
});
