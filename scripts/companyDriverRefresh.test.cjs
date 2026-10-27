const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function fixture({ database = "E_Shopping", user = { isDriver: true, isCompanyOwnedDriver: true }, rideDriver = { serviceModes: { delivery: true } },
  locationPermission = "granted" } = {}) {
  const filename = path.join(__dirname, "..", "Screens", "Driver", "CompanyDriverDashboard.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const states = [];
  const refs = [];
  let stateIndex;
  let refIndex;
  let focused;
  const pending = [];
  const actions = [];
  const alerts = [];
  const navigations = [];
  const timers = new Map();
  let timerId = 0;
  let storageRead = async () => "token";
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useContext: () => ({ user, logout: () => {} }),
    useCallback: (fn) => fn,
    useState: (initial) => {
      const index = stateIndex++;
      if (!(index in states)) states[index] = initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef: (initial) => {
      const index = refIndex++;
      if (!(index in refs)) refs[index] = { current: initial };
      return refs[index];
    },
  };
  const dependencies = {
    react,
    "react-native": new Proxy({
      StyleSheet: { create: (styles) => styles },
      Alert: { alert: (...args) => alerts.push(args) },
    }, { get: (target, key) => target[key] || key }),
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@react-navigation/native": { useFocusEffect: (callback) => { focused = callback; } },
    "@react-native-async-storage/async-storage": { getItem: (...args) => storageRead(...args) },
    axios: {
      get: (url, config) => new Promise((resolve, reject) => pending.push({ url, config, resolve, reject })),
      put: (url, data, config) => new Promise((resolve, reject) => actions.push({ url, config, resolve, reject })),
    },
    "../../Context/store/Auth": { AuthContext: {} },
    "../../assets/common/baseUrl": "https://example.invalid/api/",
    "../../assets/common/currency": { useCurrency: () => ({ formatPrice: String }) },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => database },
    "../../assets/common/delivery": { formatScheduledDeliveryDate: () => "" },
    "../../assets/common/rides": { rideRequest: async () => ({ driver: rideDriver, trip: null, offer: null }) },
    "expo-location": { getForegroundPermissionsAsync: async () => ({ status: locationPermission }) },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports, console: { warn: () => {} }, AbortController,
    setTimeout: (callback, delay) => {
      const id = ++timerId;
      timers.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => timers.delete(id),
    setInterval: () => 0,
    clearInterval: () => {},
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  const render = () => {
    stateIndex = 0;
    refIndex = 0;
    return exports.default({ navigation: { navigate: (...args) => navigations.push(args) } });
  };
  const nodes = (value) => !value || typeof value !== "object" ? []
    : Array.isArray(value) ? value.flatMap(nodes)
      : [value, ...nodes(value.props?.children)];
  const button = () => nodes(render()).find((node) =>
    node.type === "TouchableOpacity" && node.props.accessibilityLabel === "Refresh delivery data");
  const text = () => nodes(render()).flatMap((node) => node.props?.children || [])
    .filter((child) => typeof child === "string").join(" ");
  const claim = () => nodes(render()).find((node) =>
    node.type === "TouchableOpacity" && nodes(node).some((child) =>
      child.props?.children?.includes("Claim Delivery")));
  const reject = () => nodes(render()).find((node) =>
    node.type === "TouchableOpacity" && nodes(node).some((child) =>
      child.props?.children?.includes("Reject")));
  const reroute = () => nodes(render()).find((node) =>
    node.type === "TouchableOpacity" && nodes(node).some((child) =>
      child.props?.children?.includes("Reroute")));
  const combinedStop = (index) => nodes(render()).find((node) =>
    node.props?.accessibilityLabel === `Open combined route stop ${index}`);
  const deliveryRoute = () => nodes(render()).find((node) =>
    node.type === "TouchableOpacity" && nodes(node).some((child) =>
      child.props?.children?.includes("Route to Delivery ➔")));
  const acceptedResponse = (label) => nodes(render()).find((node) =>
    node.type === "TouchableOpacity" && nodes(node).some((child) => child.props?.children?.includes(label)));
  return {
    pending, actions, alerts, timers, button, text, claim, reject, reroute, combinedStop, deliveryRoute, acceptedResponse, navigations,
    focus: () => focused(),
    setStorageRead: (read) => { storageRead = read; },
    expireDeadline: () => {
      assert.equal(timers.size, 1);
      const [id, timer] = timers.entries().next().value;
      assert.equal(timer.delay, 20000);
      timers.delete(id);
      timer.callback();
    },
  };
}

async function loadOffer(f) {
  f.button();
  f.focus();
  await new Promise(setImmediate);
  for (const request of f.pending) request.resolve({ data: {
    orders: [{ _id: "order", items: [] }], queue: [],
  } });
  await new Promise(setImmediate);
}

async function finishClaimRecovery(f) {
  assert.equal(f.pending.length, 6);
  for (const request of f.pending.slice(4)) request.resolve({ data: {
    orders: [{ _id: "order", items: [] }], queue: [],
  } });
  await new Promise(setImmediate);
  assert.ok(f.claim(), "Claim spinner should be replaced by the claim label");
  assert.equal(f.claim().props.disabled, false);
}

test("upcoming scheduled offers explain the time gate and disable claim and responses", async () => {
  const f = fixture();
  f.button();
  f.focus();
  await new Promise(setImmediate);
  for (const request of f.pending) request.resolve({ data: {
    orders: [{ _id: "upcoming", items: [], upcoming: true, canClaim: false, canRespond: false }],
    queue: [],
  } });
  await new Promise(setImmediate);
  assert.match(f.text(), /Upcoming scheduled delivery/);
  assert.doesNotMatch(f.text(), /Queued until you are online/);
  assert.equal(f.claim().props.disabled, true);
  assert.equal(f.reject(), undefined);
  assert.equal(f.reroute(), undefined);
});

test("mobile blocks combined and individual drop-off routes until all cart pickups are complete", async () => {
  const f = fixture();
  f.button();
  f.focus();
  await new Promise(setImmediate);
  const queue = [{ orderId: "a", cartRouteVersion: 1, checkoutGroup: "cart", deliveryStatus: "Picked Up",
    dropoffReady: false, pendingPickupOrderIds: ["b"], store: { name: "Shared store" } }];
  const routeStops = [
    { key: "pickup", type: "pickup", name: "Shared store", orderIds: ["b", "other-customer"], requires: [] },
    { key: "dropoff", type: "dropoff", name: "Home", orderIds: ["a"], requires: ["pickup"] },
  ];
  for (const request of f.pending) request.resolve({ data: { orders: [], queue, routeStops } });
  await new Promise(setImmediate);
  assert.match(f.text(), /Combined accepted cart route/);
  assert.equal(f.combinedStop(1).props.disabled, false);
  assert.equal(f.combinedStop(2).props.disabled, true);
  assert.equal(f.deliveryRoute().props.disabled, true);
  f.deliveryRoute().props.onPress();
  assert.equal(f.navigations.length, 0);
  assert.match(f.alerts[0][1], /all products.*customer cart/);
  assert.match(f.text(), /for this customer cart before starting any drop-off/);
  const oldCount = f.pending.length;
  const refresh = f.button().props.onPress();
  await new Promise(setImmediate);
  for (const request of f.pending.slice(oldCount)) request.resolve({ data: {
    orders: [], queue: [{ ...queue[0], dropoffReady: true, pendingPickupOrderIds: [] }],
    routeStops: [{ ...routeStops[1], requires: [] }],
  } });
  await refresh;
  assert.equal(f.combinedStop(1).props.disabled, false);
  assert.equal(f.deliveryRoute().props.disabled, false);
  f.combinedStop(1).props.onPress();
  assert.equal(f.navigations[0][0], "DeliveryRoute");
  assert.equal(f.navigations[0][1].request.dropoffReady, true);
});

test("driver dashboard explains disabled ride modes and missing passenger setup", async () => {
  const f = fixture({ rideDriver: { approvalStatus: "approved", isAvailable: true,
    vehicleType: "car", serviceModes: { delivery: true } } });
  await loadOffer(f);
  assert.match(f.text(), /Online/);
  assert.match(f.text(), /Passenger seats:/);
  assert.match(f.text(), /Not configured/);
  assert.match(f.text(), /Ask Admin to approve and enable/);
  assert.match(f.text(), /enable Regular rides or Shared rides under Service preferences/);
  assert.match(f.text(), /set the simulator GPS near the rider pickup/);
});

test("GPS permission failure retains driver status and service preferences", async () => {
  const f = fixture({ rideDriver: { approvalStatus: "approved", isAvailable: true,
    vehicleType: "car", passengerSeats: 4, serviceModes: { regular: true } },
    locationPermission: "denied" });
  await loadOffer(f);
  assert.match(f.text(), /Open ride assignments to enable GPS/);
  assert.match(f.text(), /Online/);
  assert.match(f.text(), /Regular rides:/);
  assert.match(f.text(), /Enabled/);
  assert.doesNotMatch(f.text(), /Ask Admin to approve and enable/);
});

test("driver refresh is bounded, prevents overlap and becomes available after timeout", async () => {
  const fixtureInstance = fixture();
  const { button, pending, alerts } = fixtureInstance;
  button();
  fixtureInstance.focus();
  await new Promise(setImmediate);
  assert.equal(pending.length, 4);
  for (const request of pending) {
    assert.equal(request.config.timeout, 20000);
    assert.equal(request.config.headers["x-database-name"], "E_Shopping");
  }
  assert.equal(button().props.disabled, true);
  const duplicate = button().props.onPress();
  await duplicate;
  assert.equal(pending.length, 4);
  for (const request of pending) request.reject(new Error("timeout"));
  await new Promise(setImmediate);
  assert.equal(button().props.disabled, false);
  assert.equal(alerts.length, 2);
  const retry = button().props.onPress();
  await new Promise(setImmediate);
  assert.equal(pending.length, 8);
  for (const request of pending.slice(4)) request.resolve({ data: { orders: [], queue: [] } });
  await retry;
  assert.equal(button().props.disabled, false);
});

test("claim timeout clears the action spinner and reloads queue and offers without duplicate claims", async () => {
  const f = fixture();
  f.button();
  f.focus();
  await new Promise(setImmediate);
  for (const request of f.pending) request.resolve({ data: {
    orders: [{ _id: "order", items: [] }], queue: [],
  } });
  await new Promise(setImmediate);
  const claimButton = f.claim();
  assert.ok(claimButton, "Claim button should be rendered");
  const claim = claimButton.props.onPress();
  await new Promise(setImmediate);
  assert.equal(f.actions.length, 1);
  assert.equal(f.actions[0].config.timeout, 20000);
  await claimButton.props.onPress();
  assert.equal(f.actions.length, 1);
  f.actions[0].reject(new Error("timeout"));
  await claim;
  await new Promise(setImmediate);
  assert.equal(f.timers.size, 0);
  assert.equal(f.alerts.at(-1)[0], "Unable to confirm claim");
  assert.match(f.alerts.at(-1)[1], /timeout/);
  assert.match(f.alerts.at(-1)[1], /server may have saved/);
  assert.equal(f.pending.length, 6);
  await finishClaimRecovery(f);
});

for (const database of ["E_Shopping", "E_ShopUSA"]) {
  test(`claim deadline releases a stalled request in ${database} and ignores late success`, async () => {
    const f = fixture({ database });
    await loadOffer(f);
    const claimButton = f.claim();
    const claim = claimButton.props.onPress();
    await new Promise(setImmediate);
    assert.equal(f.actions[0].config.headers["x-database-name"], database);
    assert.equal(f.claim(), undefined, "Claim label should be replaced by spinner");
    await claimButton.props.onPress();
    assert.equal(f.actions.length, 1);

    f.expireDeadline();
    await claim;
    await new Promise(setImmediate);
    assert.equal(f.actions[0].config.signal.aborted, true);
    assert.equal(f.alerts.at(-1)[0], "Unable to confirm claim");
    assert.match(f.alerts.at(-1)[1], /20 seconds/);
    assert.match(f.alerts.at(-1)[1], /server may have saved/);
    assert.equal(f.pending.length, 6);
    assert.equal(f.timers.size, 0);
    await finishClaimRecovery(f);

    f.actions[0].resolve({ data: {} });
    await new Promise(setImmediate);
    assert.equal(f.alerts.length, 1, "Late success must not report a confirmed claim");
    assert.ok(f.claim());
    const retry = f.claim().props.onPress();
    await new Promise(setImmediate);
    assert.equal(f.actions.length, 2);
    f.actions[1].resolve({ data: {} });
    await retry;
    assert.equal(f.alerts.at(-1)[0], "Delivery claimed");
    assert.equal(f.claim(), undefined);
    assert.equal(f.timers.size, 0);
  });
}

test("claim deadline covers stalled storage and prevents sending a claim after expiry", async () => {
  const f = fixture();
  await loadOffer(f);
  let releaseStorage;
  let storageReads = 0;
  f.setStorageRead(() => ++storageReads === 1
    ? new Promise((resolve) => { releaseStorage = resolve; })
    : Promise.resolve("token"));
  const claim = f.claim().props.onPress();
  assert.equal(f.actions.length, 0);
  f.expireDeadline();
  await claim;
  assert.equal(f.alerts.at(-1)[0], "Unable to confirm claim");
  releaseStorage("token");
  await new Promise(setImmediate);
  assert.equal(f.actions.length, 0, "Expired claims must not be sent when storage recovers");
  await finishClaimRecovery(f);
});

test("reject uses the same deadline and releases its action state", async () => {
  const f = fixture();
  await loadOffer(f);
  f.reject().props.onPress();
  assert.equal(f.actions.length, 0, "Rejection requires confirmation");
  assert.match(f.alerts.at(-1)[1], /stay available for other drivers/);
  assert.match(f.alerts.at(-1)[1], /flagged for Admin review without pausing delivery/);
  const reject = f.alerts.at(-1)[2].find((choice) => choice.text === "Reject").onPress();
  await new Promise(setImmediate);
  assert.match(f.actions[0].url, /company-reject$/);
  f.expireDeadline();
  await reject;
  assert.equal(f.actions[0].config.signal.aborted, true);
  await new Promise(setImmediate);
  await finishClaimRecovery(f);
  assert.equal(f.reject().props.disabled, false);
  assert.ok(f.claim());
  assert.equal(f.alerts.at(-1)[0], "Unable to respond");
});

test("reroute uses its own endpoint", async () => {
  const f = fixture();
  await loadOffer(f);
  const reroute = f.reroute().props.onPress();
  await new Promise(setImmediate);
  assert.match(f.actions[0].url, /company-reroute$/);
  f.actions[0].resolve({ data: {} });
  await reroute;
  assert.equal(f.claim(), undefined);
});

test("driver dashboard shows dispatch eligibility and distinguishes failed requests from empty lists", async () => {
  const f = fixture();
  f.button();
  f.focus();
  await new Promise(setImmediate);
  for (const request of f.pending) {
    if (request.url.includes("available-deliveries")) request.resolve({ data: {
      orders: [], driverEligibility: { message: "Your driver profile is offline/unavailable." },
    } });
    else if (request.url.includes("/queue")) request.reject(new Error("Queue request failed"));
    else request.resolve({ data: { orders: [] } });
  }
  await new Promise(setImmediate);
  assert.match(f.text(), /offline\/unavailable/);
  assert.match(f.text(), /Active routes could not be verified/);
  assert.match(f.text(), /Queue request failed/);
});

test("offline company backlog keeps claim disabled but permits rejection and rerouting", async () => {
  const f = fixture();
  f.button(); f.focus();
  await new Promise(setImmediate);
  for (const request of f.pending) request.resolve({ data: {
    orders: [{ _id: "queued-order", items: [], sharedAssignment: true, canClaim: false, canRespond: true }],
    queue: [],
  } });
  await new Promise(setImmediate);
  assert.match(f.pending[0].url, /drivers\/me\/available-deliveries$/);
  assert.ok(f.claim());
  assert.equal(f.claim().props.disabled, true);
  assert.equal(f.reject().props.disabled, false);
  assert.equal(f.reroute().props.disabled, false);
  assert.match(f.text(), /Queued until you are online/);
});

test("accepted company batches expose confirmed pre-pickup reroute and refresh the active queue afterward", async () => {
  const f = fixture();
  f.button(); f.focus();
  await new Promise(setImmediate);
  for (const request of f.pending) request.resolve({ data: {
    orders: [], queue: [{ orderId: "accepted", deliveryStatus: "Driver Assigned", canRerouteBeforePickup: true, items: [] }],
  } });
  await new Promise(setImmediate);
  f.acceptedResponse("Reroute accepted delivery").props.onPress();
  const action = f.alerts[0][2].find((item) => item.text === "Reroute").onPress();
  await new Promise(setImmediate);
  assert.match(f.actions[0].url, /orders\/accepted\/company-reroute$/);
  f.actions[0].resolve({ data: { success: true } });
  await action;
  await new Promise(setImmediate);
  const refreshes = f.pending.slice(4);
  assert.ok(refreshes.some((entry) => entry.url.endsWith("/queue")));
  for (const request of refreshes) request.resolve({ data: { orders: [], queue: [] } });
  await new Promise(setImmediate);
  assert.equal(f.acceptedResponse("Reroute accepted delivery"), undefined);
  assert.equal(f.acceptedResponse("Reject accepted delivery"), undefined);
});

test("partner drivers claim shared assignments through the authenticated driver endpoint without company or ride controls", async () => {
  const f = fixture({ user: { isDriver: true, isCompanyOwnedDriver: false } });
  f.button(); f.focus();
  await new Promise(setImmediate);
  for (const request of f.pending) request.resolve({ data: {
    orders: [{ _id: "available-order", items: [], sharedAssignment: true, canClaim: true, canRespond: false }],
    queue: [],
  } });
  await new Promise(setImmediate);
  assert.doesNotMatch(f.text(), /RIDE SERVICE|Open ride assignments/);
  assert.equal(f.reject(), undefined);
  assert.equal(f.reroute(), undefined);
  const claim = f.claim().props.onPress();
  await new Promise(setImmediate);
  assert.match(f.actions[0].url, /drivers\/me\/available-deliveries\/available-order\/claim$/);
  f.actions[0].resolve({ data: { success: true } });
  await claim;
  assert.equal(f.claim(), undefined);
});

test("mobile navigation exposes the delivery dashboard to company and partner drivers, not customers or admins", () => {
  const filename = path.join(__dirname, "..", "Navigators", "Main.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  for (const user of [{ isDriver: true, isCompanyOwnedDriver: true }, { isDriver: true },
    {}, null, { isDriver: true, isAdmin: true }]) {
    const exports = {};
    vm.runInNewContext(code, { exports, require: (name) => {
      if (name === "react") return {
        createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
        useContext: () => ({ user }),
      };
      if (name === "@react-navigation/bottom-tabs") return {
        createBottomTabNavigator: () => ({ Navigator: "Tabs", Screen: "Tab" }),
      };
      if (name === "../Context/store/Auth") return { AuthContext: {},
        isDriverUser: (profile) => profile?.isDriver === true, isCompanyStoreUser: () => false };
      return {};
    } });
    const tabs = exports.default().props.children.flat(Infinity).filter(Boolean);
    assert.equal(tabs.some((tab) => tab.props.name === "AdminDriver"), Boolean(user?.isDriver && !user.isAdmin));
  }
});
