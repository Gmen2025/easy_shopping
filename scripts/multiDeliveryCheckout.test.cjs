const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load(relative, dependencies, { development = false } = {}) {
  const filename = path.join(__dirname, "..", relative);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, console, __DEV__: development, process: { env: {} }, require: (name) => {
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
function harness(request, { resumeId, database = "E_ShopUSA", params = {}, exchangeState, packageSize, development = false,
  deliveryPolicy = {}, deliveryFailure, paymentMethods = { cash: true, bank: true, card: true, telebirr: true }, paymentError = "" } = {}) {
  const states = [];
  let cursor = 0;
  let effects = [];
  const actions = [];
  const dialogs = [];
  const item = { _id: "product", name: "Box", quantity: 3, price: 10, databaseName: database, packageSize };
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
  const summary = load("Shared\\DeliveryCheckout.js", { react, "react-native": native,
    "react-native-safe-area-context": { useSafeAreaInsets: () => ({ top: 0 }) },
    "../assets/common/currency": currency, "../assets/common/exchangeRate": exchange });
  const rides = load("assets\\common\\rides.js", { "./storefront": { apiRequest: async () => assert.fail("Place search is mocked") } });
  const deliveryPricing = load("assets\\common\\deliveryPricing.js", {});
  const deliveryMethods = { deliveryMethodOptions: (config = {}) => [
    { value: "STANDARD", label: "Standard Delivery", description: `${config.standardMinBusinessDays || 2} - ${config.standardMaxBusinessDays || 5} business days` },
    { value: "EXPRESS", label: "Express Delivery", description: `${config.expressMinBusinessDays || 1} - ${config.expressMaxBusinessDays || 2} business days` },
    { value: "SCHEDULED", label: "Scheduled Delivery", description: "Choose your delivery day" },
  ], deliveryModeLabel: (value) => ({ STANDARD: "Standard Delivery", EXPRESS: "Express Delivery", SCHEDULED: "Scheduled Delivery" }[value]),
  getDeliverySettings: async () => {
    if (deliveryFailure) throw new Error(deliveryFailure);
    return { deliveryConfig: deliveryPolicy };
  } };
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
    "../../../Shared/AddressSearchInput": { __esModule: true, default: "AddressSearchInput" },
    "../../../assets/common/rides": rides,
    "../../../assets/common/usePaymentAvailability": { __esModule: true, default: () => ({ methods: paymentMethods, error: paymentError }) },
    "../../../assets/common/paymentSettings": { PAYMENT_UNAVAILABLE: "Payment is temporarily unavailable. Please try again later." },
    "../../../assets/common/delivery": deliveryMethods,
    "../../../assets/common/deliveryPricing": deliveryPricing,
  }, { development });
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
  const search = () => nodes(render()).find((node) => node.type === "AddressSearchInput");
  const radio = (label) => nodes(render()).find((node) => node.props.accessibilityRole === "radio" && node.props.accessibilityLabel === label);
  const delivery = async () => { if (button("Save & continue to delivery")) await button("Save & continue to delivery").props.onPress(); };
  const calculate = async () => { await delivery(); await button("Calculate routes & recommend vehicles").props.onPress(); };
  const payment = () => { if (button("Continue to payment")) button("Continue to payment").props.onPress(); };
  const place = async () => {
    payment();
    if (button("Review order")) button("Review order").props.onPress();
    await (button("Place order & continue") || button("Accept quote & continue in USD")).props.onPress();
  };
  const back = () => nodes(render()).find((node) => node.props.accessibilityRole === "button" && node.props.accessibilityLabel === "Back").props.onPress();
  return { start, render, button, input, search, actions, dialogs, radio, delivery, calculate, payment, place, back };
}

const freshExchange = () => ({ enabled: true, active: true, birrPerUsd: 3, revision: 5, source: "manual",
  appliedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() });

for (const database of ["E_ShopUSA", "E_Shopping"]) {
  for (const failure of [false, true]) {
    test(`payment checkout fails closed with no enabled methods or a settings failure (${database}, ${failure})`, async () => {
      let preparations = 0;
      const current = { label: "Home", address1: "Main", city: "Town", zip: "12345", phone: "12345678",
        country: database === "E_Shopping" ? "Ethiopia" : "USA" };
      const ui = harness(async (route, options) => {
        if (route === "delivery-current-address") return current;
        if (route === "delivery-addresses" || route === "delivery-bank-accounts") return [];
        if (route === "checkouts/quote") return { _id: "disabled", cart: options.data.cart,
          itemsSubtotal: 30, deliveryFee: 2, totalPrice: 32, expiresAt: new Date(Date.now() + 600000).toISOString(),
          deliveries: [{ key: "a", store: { _id: "store", name: "Pickup" }, address: current, lines: [],
            cargo: {}, distanceKm: 1, vehicle: "car", vehicleOptions: [{ type: "car", fee: 2 }] }] };
        if (route.includes("/prepare")) preparations++;
        throw new Error(route);
      }, { database, paymentMethods: failure ? null : { cash: false, bank: false, card: false, telebirr: false },
        paymentError: failure ? "Unable to load payment availability. Please try again." : "" });
      await ui.start(); await ui.calculate(); ui.payment();
      assert.match(text(ui.render()), failure ? /Unable to load payment availability/ : /Payment is temporarily unavailable/);
      assert.equal(ui.radio("Cash on Delivery"), undefined);
      assert.equal(ui.radio("Bank Transfer"), undefined);
      assert.equal(ui.button("Review order").props.disabled, true);
      assert.equal(preparations, 0);
    });
  }
}

test("delivery pricing previews exact shared cents, separate vehicle types and unchanged legacy quotes", () => {
  const { calculateDeliveryPricing } = load("assets\\common\\deliveryPricing.js", {});
  const deliveries = ["a", "b", "c"].map((key, index) => ({
    key, store: { name: key }, distanceKm: index + 1, vehicle: "car",
    pricingGroup: { key: index === 2 ? "distant" : "nearby" },
    vehicleOptions: [{ type: "car", fee: 4.01 + index }, { type: "van", fee: 8 + index }],
  }));
  let result = calculateDeliveryPricing(deliveries);
  assert.equal(result.deliveryFee, 10.02);
  assert.equal(result.byKey.a.deliveryFee, 2.01);
  assert.equal(result.byKey.b.deliveryFee, 2);
  assert.equal(result.byKey.b.storeName, "a");
  result = calculateDeliveryPricing(deliveries, { a: "van", b: "car" });
  assert.equal(result.deliveryFee, 19.02);
  assert.equal(result.byKey.b.storeCount, 1);
  result = calculateDeliveryPricing(deliveries, { a: "van", b: "van" });
  assert.equal(result.deliveryFee, 14.01);
  assert.equal(result.byKey.b.deliveryFee, 4);
  for (const delivery of deliveries) { delete delivery.pricingGroup; }
  assert.equal(calculateDeliveryPricing(deliveries).deliveryFee, 15.03);
  assert.throws(() => calculateDeliveryPricing(deliveries, { a: "truck" }), /suitable vehicles/);
});

test("nearby-store checkout displays shared fees, reprices vehicle changes and preserves the prepared server total", async () => {
  let quote;
  const ui = harness(async (route, options) => {
    if (route === "delivery-current-address") return {
      label: "Home", address1: "Main", city: "Town", zip: "12345", country: "USA", phone: "123",
    };
    if (route === "delivery-addresses") return [];
    if (route === "delivery-bank-accounts") return [{ _id: "bank", bankName: "Bank" }];
    if (route === "checkouts/quote") {
      quote = { _id: "shared-checkout", cart: options.data.cart, itemsSubtotal: 30, deliveryFee: 4.01, totalPrice: 34.01,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
        deliveries: ["Nearest", "Nearby"].map((name, index) => ({
          key: name, store: { _id: name, name }, address: options.data.addresses[0], lines: [], cargo: {},
          distanceKm: index ? 5 : 2, vehicle: "car", pricingGroup: { key: "shared", radiusMeters: 500 },
          vehicleOptions: [{ type: "car", fee: index ? 7 : 4.01 }, { type: "van", fee: index ? 12 : 8 }],
        })) };
      return quote;
    }
    if (route === "checkouts/shared-checkout/prepare") {
      assert.ok(options.data.selections.every((selection) => selection.vehicle === "van"));
      return { ...quote, status: "awaiting_payment", paymentMethod: "bank", deliveryFee: 8, totalPrice: 38,
        bankAccount: { bankName: "Bank" } };
    }
    throw new Error(route);
  });
  await ui.start();
  await ui.calculate();
  assert.match(text(ui.render()), /Combined total: \$34.01/);
  assert.match(text(ui.render()), /Shared delivery fee: \$4.01 for 2 nearby stores/);
  assert.match(text(ui.render()), /This store's share: \$2.01/);
  const select = (name, vehicle) => nodes(ui.render()).find((node) =>
    node.type === "Picker" && node.props.accessibilityLabel === `Delivery vehicle for ${name}`).props.onValueChange(vehicle);
  select("Nearest", "van");
  assert.match(text(ui.render()), /Combined total: \$45.00/);
  assert.doesNotMatch(text(ui.render()), /Shared delivery fee:/);
  select("Nearby", "van");
  assert.match(text(ui.render()), /Combined total: \$38.00/);
  assert.match(text(ui.render()), /Shared delivery fee: \$8.00 for 2 nearby stores/);
  await ui.place();
  assert.match(text(ui.render()), /Combined total: \$38.00/);
  assert.match(text(ui.render()), /Shared fees are split equally between store orders for refunds/);
});

for (const development of [true, false]) {
  test(`USA Car selection and cash checkout work regardless of the development flag (${development})`, async () => {
    let prepared;
    let confirmations = 0;
    const current = { label: "Home", address1: "Main", city: "Town", zip: "12345", country: "USA", phone: "123" };
    let quote;
    const ui = harness(async (path, options) => {
      if (path === "delivery-current-address") return current;
      if (path === "delivery-addresses") return [];
      if (path === "delivery-bank-accounts") return [{ _id: "bank", bankName: "Bank" }];
      if (path === "checkouts/quote") {
        quote = { _id: "usa-car", cart: options.data.cart, itemsSubtotal: 30, deliveryFee: 2, totalPrice: 32,
          expiresAt: new Date(Date.now() + 600000).toISOString(),
          deliveries: [{ key: "delivery", store: { _id: "store", name: "USA pickup" }, address: current,
            lines: [{ product: "product", name: "Box", quantity: 3 }], cargo: { weightKg: 3, volumeLiters: 3 },
            distanceKm: 2, vehicle: "motorcycle",
            vehicleOptions: [{ type: "motorcycle", fee: 2 }, { type: "car", fee: 5 }] }] };
        return quote;
      }
      if (path === "checkouts/usa-car/prepare") {
        prepared = options.data;
        return { ...quote, status: "awaiting_payment", paymentMethod: "cash", deliveryFee: 5, totalPrice: 35 };
      }
      if (path === "checkouts/usa-car/confirm") {
        confirmations += 1;
        return { ...quote, status: "placed", paymentMethod: "cash", paymentStatus: "pending", deliveryFee: 5, totalPrice: 35 };
      }
      throw new Error(path);
    }, { development });
    await ui.start();
    await ui.calculate();
    const vehiclePicker = nodes(ui.render()).find((node) => node.type === "Picker" &&
      node.props.accessibilityLabel === "Delivery vehicle for USA pickup");
    assert.ok(nodes(vehiclePicker).some((node) => node.type === "PickerItem" &&
      node.props.value === "car" && node.props.label === "Car - $5.00"));
    vehiclePicker.props.onValueChange("car");
    assert.match(text(ui.render()), /Combined total: \$35.00/);
    ui.payment();
    assert.ok(ui.radio("Cash on Delivery"));
    ui.radio("Cash on Delivery").props.onPress();
    await ui.place();
      assert.equal(prepared.method, "cash");
      assert.equal(prepared.developmentCashOnDelivery, undefined);
      assert.equal(prepared.selections[0].vehicle, "car");
      await ui.button("Finish checkout").props.onPress();
      assert.equal(confirmations, 1);
      assert.equal(ui.actions.at(-1).type, "complete");
  });
}

for (const database of ["E_ShopUSA", "E_Shopping"]) {
  test(`${database} vehicle checkout lets customers choose a delivery speed`, async () => {
    let quoted;
    let prepared;
    const ui = harness(async (path, options) => {
      if (path === "delivery-current-address") return {
        label: "Home", address1: "Main", city: "Town", zip: "12345",
        country: database === "E_ShopUSA" ? "USA" : "Ethiopia", phone: "123",
      };
      if (path === "delivery-addresses") return [];
      if (path === "delivery-bank-accounts") return [{ _id: "bank", bankName: "Bank" }];
      if (path === "checkouts/quote") {
        quoted = options.data;
        return { _id: "speed-quote", cart: options.data.cart, itemsSubtotal: 30,
          expiresAt: new Date(Date.now() + 600000).toISOString(), deliveries: [] };
      }
      if (path === "checkouts/speed-quote/prepare") {
        prepared = options.data;
        return { _id: "speed-quote", status: "awaiting_payment", paymentMethod: "bank" };
      }
      throw new Error(path);
    }, { database });

    await ui.start();
    await ui.delivery();
    assert.equal(ui.radio("Standard Delivery").props.accessibilityState.checked, true);
    ui.radio("Express Delivery").props.onPress();
    await ui.calculate();
    assert.equal(quoted.deliveryMode, "EXPRESS");
    assert.equal(quoted.scheduledFor, null);
    assert.match(text(ui.render()), /Delivery speed: Express Delivery/);
    await ui.place();
    assert.equal(prepared.deliveryMode, "EXPRESS");
    assert.equal(prepared.scheduledFor, null);
    assert.equal(ui.dialogs.length, 0);
  });
}

test("scheduled vehicle delivery requires and sends a future date", async () => {
  let quoteCount = 0;
  let quoted;
  let prepared;
  const ui = harness(async (path, options) => {
    if (path === "delivery-current-address") return {
      label: "Home", address1: "Main", city: "Addis Ababa", country: "Ethiopia", phone: "123",
    };
    if (path === "delivery-addresses") return [];
    if (path === "delivery-bank-accounts") return [{ _id: "bank", bankName: "Bank" }];
    if (path === "checkouts/quote") {
      quoteCount += 1;
      quoted = options.data;
      return { _id: "scheduled-quote", cart: options.data.cart, itemsSubtotal: 30,
        expiresAt: new Date(Date.now() + 600000).toISOString(), deliveries: [] };
    }
    if (path === "checkouts/scheduled-quote/prepare") {
      prepared = options.data;
      return { _id: "scheduled-quote", status: "awaiting_payment", paymentMethod: "bank" };
    }
    throw new Error(path);
  }, { database: "E_Shopping" });

  await ui.start();
  await ui.delivery();
  ui.radio("Scheduled Delivery").props.onPress();
  const datePicker = () => nodes(ui.render()).find((node) =>
    node.type === "Picker" && node.props.accessibilityLabel === "Scheduled delivery date");
  assert.ok(datePicker());
  await ui.calculate();
  assert.equal(quoteCount, 0);
  assert.match(text(ui.render()), /Choose a valid future date for scheduled delivery/);

  datePicker().props.onValueChange(nodes(datePicker()).find((node) =>
    node.type === "PickerItem" && node.props.value)?.props.value);
  const scheduledDate = datePicker().props.selectedValue;
  await ui.calculate();
  assert.equal(quoted.deliveryMode, "SCHEDULED");
  assert.ok(quoted.scheduledFor);
  assert.equal(new Date(quoted.scheduledFor).getDate(), Number(scheduledDate.split("-")[2]));
  await ui.place();
  assert.equal(prepared.deliveryMode, "SCHEDULED");
  assert.equal(prepared.scheduledFor, quoted.scheduledFor);
  assert.equal(ui.dialogs.length, 1);
});

test("release builds can finish a previously reserved USA cash checkout", async () => {
  const calls = [];
  const ui = harness(async (path) => {
    calls.push(path);
    return { _id: "cash-recovery", cart: [], status: "awaiting_payment", paymentMethod: "cash",
      expiresAt: new Date(Date.now() + 600000).toISOString() };
  }, { resumeId: "cash-recovery", development: false });
  await ui.start();
  await ui.button("Finish checkout").props.onPress();
  assert.deepEqual(calls, ["checkouts/cash-recovery", "checkouts/cash-recovery/confirm"]);
});

for (const database of ["E_ShopUSA", "E_Shopping"]) {
  test(`unavailable Car is not fabricated and domestic cash follows regional policy (${database})`, async () => {
    const current = { label: "Home", address1: "Main", city: "Town", zip: "12345", phone: "12345678", country: database === "E_ShopUSA" ? "USA" : "Ethiopia" };
    const ui = harness(async (path, options) => {
      if (path === "delivery-current-address") return current;
      if (path === "delivery-addresses" || path === "delivery-bank-accounts") return [];
      if (path === "checkouts/quote") return { _id: "van-only", cart: options.data.cart, itemsSubtotal: 30,
        deliveryFee: 8, totalPrice: 38, expiresAt: new Date(Date.now() + 600000).toISOString(),
        deliveries: [{ key: "delivery", store: { _id: "store", name: "Pickup" }, address: current,
          lines: [], cargo: {}, vehicle: "van", distanceKm: 1, vehicleOptions: [{ type: "van", fee: 8 }] }] };
      throw new Error(path);
    }, { database, development: false });
    await ui.start();
    await ui.calculate();
    assert.equal(nodes(ui.render()).some((node) => node.type === "PickerItem" && node.props.value === "car"), false);
    if (database === "E_ShopUSA") assert.match(text(ui.render()), /Car delivery is unavailable for this load or disabled/);
    ui.payment();
    assert.ok(ui.radio("Cash on Delivery"));
  });
}

test("checkout displays configured package sizes without requiring them", async () => {
  const ui = harness(async (route) => {
    if (route === "delivery-current-address") return { label: "Home", country: "USA" };
    if (route === "delivery-addresses" || route === "delivery-bank-accounts") return [];
    throw new Error(route);
  }, { packageSize: { weightKg: 2.5, lengthCm: 10, widthCm: 20, heightCm: 30 } });
  await ui.start();
  assert.match(text(ui.render()), /Packaged weight: 2.5 kg/);
  assert.match(text(ui.render()), /Packaged dimensions \(L x W x H\): 10 x 20 x 30 cm/);
  assert.ok(ui.button("Save & continue to delivery"));
});

test("partial dimensions display configured values and mark only missing measurements unavailable", async () => {
  const ui = harness(async (route) => {
    if (route === "delivery-current-address") return { label: "Home", country: "USA" };
    if (route === "delivery-addresses" || route === "delivery-bank-accounts") return [];
    throw new Error(route);
  }, { packageSize: { lengthCm: 10 } });
  await ui.start();
  assert.match(text(ui.render()), /Packaged weight: Not available currently/);
  assert.match(text(ui.render()), /L: 10 cm \| W: Not available currently \| H: Not available currently/);
});

for (const cargo of [undefined, { weightKg: null, volumeLiters: null, measurementsAvailable: false },
  { weightKg: 6, volumeLiters: null, measurementsAvailable: false }]) {
  test(`missing package measurements (${cargo?.weightKg ?? "unknown"} kg) require manual vehicle choice, not package entry`, async () => {
    let prepared;
    const size = cargo?.weightKg ? { weightKg: 2 } : null;
    const current = { label: "Home", address1: "Main", city: "Town", zip: "12345", country: "USA", phone: "123" };
    const ui = harness(async (route, options) => {
      if (route === "delivery-current-address") return current;
      if (route === "delivery-addresses") return [];
      if (route === "delivery-bank-accounts") return [{ _id: "bank", bankName: "Bank" }];
      if (route === "checkouts/quote") return { _id: "unknown-load", cart: options.data.cart, itemsSubtotal: 30,
        deliveryFee: 4, totalPrice: 34, expiresAt: new Date(Date.now() + 600000).toISOString(),
        deliveries: [{ key: "delivery", store: { _id: "store", name: "Pickup" }, address: current,
          lines: [{ product: "product", name: "Box", quantity: 3, packageSize: size }], cargo,
          requiresVehicleSelection: true, vehicle: "", deliveryFee: 4, distanceKm: 2,
          vehicleOptions: [{ type: "car", fee: 4 }, { type: "van", fee: 8 }] }] };
      if (route === "checkouts/unknown-load/prepare") {
        prepared = options.data;
        return { _id: "unknown-load", kind: "products", cart: options.data.cart || [], status: "awaiting_payment",
          paymentMethod: "bank", itemsSubtotal: 30, deliveryFee: 8, totalPrice: 38, expiresAt: new Date().toISOString() };
      }
      throw new Error(route);
    }, { packageSize: size });
    await ui.start();
    assert.match(text(ui.render()), /Packaged dimensions \(L x W x H\): Not available currently/);
    await ui.calculate();
    assert.match(text(ui.render()), /Load volume: Not available currently/);
    assert.match(text(ui.render()), cargo?.weightKg ? /Load weight: 6.00 kg/ : /Load weight: Not available currently/);
    assert.match(text(ui.render()), /Choose a vehicle manually/);
    assert.doesNotMatch(text(ui.render()), /Recommended:/);
    assert.match(text(ui.render()), /Combined total estimate from: \$34.00/);
    assert.equal(ui.button("Continue to payment").props.disabled, true);
    ui.payment();
    await ui.place();
    assert.equal(prepared, undefined);
    assert.match(text(ui.render()), /Choose a vehicle for every delivery/);
    ui.back(); ui.back();
    const picker = nodes(ui.render()).find((node) => node.type === "Picker" &&
      nodes(node).some((child) => child.props.label === "Choose a vehicle..."));
    assert.equal(picker.props.selectedValue, "");
    picker.props.onValueChange("van");
    assert.equal(ui.button("Continue to payment").props.disabled, false);
    assert.match(text(ui.render()), /Combined total: \$38.00/);
    await ui.place();
    assert.equal(prepared.selections[0].vehicle, "van");
    assert.match(text(ui.render()), /Stock held until/);
  });
}

test("delivery autocomplete preserves recipient fields and saves Ethiopian locations without postal codes", async () => {
  const calls = [];
  const current = { label: "Home", address1: "Old street", city: "Addis Ababa", country: "Ethiopia", phone: "123" };
  const ui = harness(async (route, options) => {
    calls.push({ route, options });
    if (route === "delivery-current-address") return current;
    if (route === "delivery-addresses" && !options) return [];
    if (route === "delivery-bank-accounts") return [];
    if (route === "delivery-addresses") return { ...options.data, _id: "saved-office" };
    if (route === "checkouts/quote") return { ...options.data, _id: "quote", deliveries: [] };
    throw new Error(route);
  }, { database: "E_Shopping" });
  await ui.start();
  ui.button("Add another delivery address").props.onPress();
  assert.equal(ui.input("Country").props.value, "Ethiopia");
  assert.equal(ui.input("Postal code"), undefined);
  assert.equal(ui.search().props.label, "Search delivery address");
  ui.input("Address label").props.onChangeText("Office");
  ui.input("Apartment / unit (optional)").props.onChangeText("Unit 2");
  ui.input("Recipient phone").props.onChangeText("456");
  const location = { type: "Point", coordinates: [38.78, 8.99] };
  ui.search().props.onSelect({ placeId: "ChIJoffice", formattedAddress: "Edna Mall, Addis Ababa, Ethiopia",
    address1: "Edna Mall", address2: "", label: "Place", phone: "", city: "Addis Ababa",
    country: "Ethiopia", zip: "1000", location });
  assert.equal(ui.input("Address label").props.value, "Office");
  assert.equal(ui.input("Apartment / unit (optional)").props.value, "Unit 2");
  assert.equal(ui.input("Recipient phone").props.value, "456");
  assert.equal(ui.input("Street address").props.value, "Edna Mall");
  assert.equal(ui.search().props.selectedText, "Edna Mall, Addis Ababa, Ethiopia");
  await ui.button("Save address & use").props.onPress();
  const stored = calls.find((call) => call.route === "delivery-addresses" && call.options).options.data;
  assert.equal(stored.zip, "");
  assert.equal(stored.placeId, "ChIJoffice");
  assert.deepEqual(stored.location, location);
  assert.equal(ui.dialogs.length, 0);
  ui.input("Quantity for Home").props.onChangeText("2");
  ui.input("Quantity for Office").props.onChangeText("1");
  await ui.calculate();
  const sent = calls.find((call) => call.route === "checkouts/quote").options.data.addresses[1];
  assert.equal(sent.placeId, "ChIJoffice");
  assert.deepEqual(sent.location, location);
  assert.equal(sent.zip, "");
});

for (const country of ["Ethiopia", " Ethio ", "et"]) {
  test(`editing a ${country.trim()} address does not require postal code but still requires recipient details`, async () => {
    const ui = harness(async (route) => {
      if (route === "delivery-current-address") return { label: "Home", address1: "Bole", city: "Addis Ababa",
        zip: "1000", country, phone: "123" };
      if (route === "delivery-addresses" || route === "delivery-bank-accounts") return [];
      throw new Error(route);
    }, { database: "E_Shopping" });
    await ui.start();
    assert.doesNotMatch(text(ui.render()), /1000/);
    ui.button("Edit address").props.onPress();
    assert.equal(ui.input("Postal code"), undefined);
    ui.input("Recipient phone").props.onChangeText("");
    await ui.button("Use this address").props.onPress();
    assert.match(text(ui.render()), /Complete all required address fields/);
    ui.input("Recipient phone").props.onChangeText("456");
    await ui.button("Use this address").props.onPress();
    assert.equal(ui.search(), undefined);
    assert.match(text(ui.render()), /456/);
  });
}

test("non-Ethiopian addresses require postal code and manual location edits clear selected place metadata", async () => {
  const ui = harness(async (route) => {
    if (route === "delivery-current-address") return { label: "Home", address1: "Main", city: "Town", country: "USA", phone: "123" };
    if (route === "delivery-addresses" || route === "delivery-bank-accounts") return [];
    throw new Error(route);
  });
  await ui.start();
  ui.button("Add another delivery address").props.onPress();
  assert.equal(ui.input("Country").props.value, "USA");
  ui.input("Address label").props.onChangeText("Office");
  ui.input("Recipient phone").props.onChangeText("456");
  const place = { placeId: "ChIJus", address1: "1 Main", city: "Town", country: "USA", zip: "",
    formattedAddress: "1 Main, Town, USA", location: { type: "Point", coordinates: [-74, 40] } };
  ui.search().props.onSelect(place);
  await ui.button("Use this address").props.onPress();
  assert.match(text(ui.render()), /Complete all required address fields/);
  for (const [label, value] of [["Street address", "2 Main"], ["City", "Other town"],
    ["Postal code", "12345"], ["Country", "USA"]]) {
    ui.search().props.onSelect(place);
    ui.input(label).props.onChangeText(value);
    assert.equal(ui.search().props.selectedText, "");
  }
  ui.input("Postal code").props.onChangeText("12345");
  await ui.button("Use this address").props.onPress();
  assert.equal(ui.search(), undefined);
});

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
  }, { database: "E_ShopUSA", params: { paymentCurrency: "etb" }, exchangeState: policy, development: true });
  await ui.start();
  await ui.calculate();
  assert.match(text(ui.render()), /International shipping: \$20.00/);
  assert.match(text(ui.render()), /Birr payment estimate: ETB 7950.00/);
  assert.match(text(ui.render()), /Customs\/import charges are excluded/);
  assert.equal(nodes(ui.render()).some((node) => node.props.value === "card" || node.props.value === "cash"), false);
  nodes(ui.render()).find((node) => node.type === "Picker" && node.props.selectedValue === "car").props.onValueChange("van");
  assert.match(text(ui.render()), /Birr payment estimate: ETB 8400.00/);
  await ui.place();
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
  }, { database: "E_Shopping", params: { paymentCurrency: "usd" }, exchangeState: policy, development: true });
  await ui.start();
  await ui.calculate();
  assert.match(text(ui.render()), /Combined total: ETB 33.00/);
  assert.match(text(ui.render()), /USD payment estimate: USD \$11.00/);
  assert.equal(nodes(ui.render()).some((entry) => entry.props.value === "cash"), false);
  nodes(ui.render()).find((entry) => entry.type === "Picker" && entry.props.selectedValue === "car").props.onValueChange("van");
  assert.match(text(ui.render()), /USD payment estimate: USD \$12.00/);
  await ui.place();
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
  }, { database: "E_Shopping", params: { serviceId: "service", paymentCurrency: "usd" }, exchangeState: policy, development: true });
  await ui.start();
  assert.match(text(ui.render()), /Service USD checkout/);
  assert.doesNotMatch(text(ui.render()), /Allocate each unit/);
  await ui.place();
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
  await ui.calculate();
  const picker = nodes(ui.render()).find((node) => node.type === "Picker" && node.props.selectedValue === "car");
  picker.props.onValueChange("van");
  assert.match(text(ui.render()), /Combined total: \$42.00/);
  await ui.place();
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
test("staged checkout displays configured windows and server estimates, keeps Review separate and invalidates edited quotes", async () => {
  let prepares = 0;
  const current = { label: "Home", address1: "Main", city: "Town", zip: "12345", country: "USA", phone: "123" };
  const ui = harness(async (route, options) => {
    if (route === "delivery-current-address") return current;
    if (route === "delivery-addresses") return [];
    if (route === "delivery-bank-accounts") return [{ _id: "bank", bankName: "Bank" }];
    if (route === "checkouts/quote") return { ...options.data, _id: "new-flow", itemsSubtotal: 30, totalPrice: 37,
      deliveryWindowStart: "2099-02-10T09:00:00Z", deliveryWindowEnd: "2099-02-13T17:00:00Z",
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      deliveries: [{ key: "delivery", address: current, store: { name: "Store" }, lines: [], cargo: {},
        distanceKm: 5, vehicle: "car", vehicleOptions: [{ type: "car", fee: 7 }] }] };
    if (route.endsWith("/prepare")) { prepares++; throw new Error("Should not reserve during review"); }
    throw new Error(route);
  }, { deliveryPolicy: { standardMinBusinessDays: 3, standardMaxBusinessDays: 6, expressMinBusinessDays: 1, expressMaxBusinessDays: 3 } });
  await ui.start();
  assert.equal(ui.button("Calculate routes & recommend vehicles"), undefined);
  assert.equal(ui.button("Review order"), undefined);
  await ui.delivery();
  assert.match(text(ui.render()), /3 - 6 business days/);
  assert.match(text(ui.render()), /1 - 3 business days/);
  assert.doesNotMatch(text(ui.render()), /Same Day Delivery|Next Day Delivery|Pickup from Store|Telebirr/);
  await ui.calculate();
  assert.match(text(ui.render()), /Estimated delivery/);
  assert.match(text(ui.render()), /Combined total: \$37.00/);
  assert.equal(ui.radio("Bank Transfer"), undefined);
  ui.payment();
  assert.ok(ui.radio("Bank Transfer"));
  assert.equal(ui.button("Place order & continue"), undefined);
  ui.button("Review order").props.onPress();
  assert.ok(ui.button("Place order & continue"));
  assert.equal(prepares, 0, "Reviewing must not reserve stock or charge");
  ui.button("Change addresses & quantities").props.onPress();
  ui.input("Quantity for Home").props.onChangeText("2");
  assert.equal(ui.button("Place order & continue"), undefined);
  await ui.delivery();
  assert.match(text(ui.render()), /Allocate all 3 units/);
  assert.equal(ui.radio("Express Delivery"), undefined, "Invalid allocations cannot advance to delivery");
});
test("delivery settings errors block new checkout without silently using fallback windows", async () => {
  const ui = harness(async (route) => route === "delivery-current-address"
    ? { label: "Home", country: "USA" } : [], { deliveryFailure: "Delivery service unavailable" });
  await ui.start();
  assert.match(text(ui.render()), /Delivery service unavailable/);
  assert.equal(ui.button("Save & continue to delivery").props.disabled, true);
  assert.ok(ui.button("Reload checkout"));
});
for (const expiresAt of [new Date(0).toISOString(), "invalid"]) {
test(`expired or invalid quote (${expiresAt}) cannot place orders or create payment reservations`, async () => {
  let prepares = 0;
  const ui = harness(async (route, options) => {
    if (route === "delivery-current-address") return { label: "Home", address1: "Main", city: "Town", zip: "12345", country: "USA", phone: "123" };
    if (route === "delivery-addresses") return [];
    if (route === "delivery-bank-accounts") return [{ _id: "bank" }];
    if (route === "checkouts/quote") return { ...options.data, _id: "expired", itemsSubtotal: 30,
      expiresAt, deliveries: [] };
    if (route.endsWith("/prepare")) prepares++;
    throw new Error(route);
  });
  await ui.start();
  await ui.calculate();
  await ui.place();
  assert.equal(prepares, 0);
  assert.match(text(ui.render()), /quote expired/);
  assert.equal(ui.button("Place order & continue"), undefined);
  assert.ok(ui.button("Calculate routes & recommend vehicles"));
});
}
test("pending bank review never displays a paid success confirmation", async () => {
  const ui = harness(async () => ({ _id: "review", status: "bank_review", paymentStatus: "pending",
    paymentMethod: "bank", itemsSubtotal: 30, deliveryFee: 5, totalPrice: 35 }), { resumeId: "review" });
  await ui.start();
  assert.match(text(ui.render()), /Transfer submitted for review/);
  assert.doesNotMatch(text(ui.render()), /Order Placed Successfully|payment is confirmed|Total Paid/);
});
