const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

const filename = path.join(__dirname, "..", "assets", "common", "orderTracking.js");
const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
  filename, configFile: false, babelrc: false,
  plugins: ["@babel/plugin-transform-modules-commonjs"],
});
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject });
const {
  toLatLng, usesMiles, formatDistance, getTrackingAddress, getShippingAddressText,
  getTrackingOrder, getTrackingLocations, getTrackingRoute,
} = exportsObject;
const pickup = { latitude: 8.98, longitude: 38.76 };
const dropoff = { latitude: 9.01, longitude: 38.8 };
const driver = { latitude: 8.99, longitude: 38.77 };
const plain = (value) => JSON.parse(JSON.stringify(value));

test("post-purchase tracking uses checkout coordinates before tracking is available", () => {
  const locations = getTrackingLocations(null, {
    storeLocation: pickup, customerLocation: dropoff,
  });
  assert.deepEqual(plain(locations), { pickup, dropoff });
  assert.deepEqual(plain(getTrackingRoute("Pending", locations.pickup, locations.dropoff, null)), {
    origin: pickup, destination: dropoff,
  });
});

test("tracking coordinates override checkout coordinates, while incomplete tracking retains them", () => {
  assert.deepEqual(plain(getTrackingLocations({ pickup: driver }, {
    storeLocation: pickup, customerLocation: dropoff,
  })), { pickup: driver, dropoff });
  assert.deepEqual(plain(getTrackingLocations({
    pickup: { latitude: null, longitude: null },
    dropoff: { latitude: 91, longitude: 38 },
  }, { pickupStore: pickup, customerLocation: dropoff })), { pickup, dropoff });
  assert.deepEqual(plain(getTrackingLocations({
    storeLocation: pickup, customerLocation: dropoff,
  })), { pickup, dropoff });
});

test("route selection preserves the assigned-driver legs and completed delivery", () => {
  for (const status of ["Pending", "Driver Assigned", "Picked Up", "Delivered"]) {
    assert.deepEqual(plain(getTrackingRoute(status, pickup, dropoff, null)), {
      origin: pickup, destination: dropoff,
    });
  }
  for (const status of ["Pending", "Driver Assigned"]) {
    assert.deepEqual(plain(getTrackingRoute(status, pickup, dropoff, driver)), {
      origin: driver, destination: pickup,
    });
  }
  assert.deepEqual(plain(getTrackingRoute("Picked Up", pickup, dropoff, driver)), {
    origin: driver, destination: dropoff,
  });
  assert.deepEqual(plain(getTrackingRoute("Delivered", pickup, dropoff, driver)), {
    origin: pickup, destination: dropoff,
  });
});

test("invalid and unavailable coordinates never fabricate a map location", () => {
  for (const point of [
    null, {}, { latitude: null, longitude: 5 }, { latitude: "", longitude: 5 },
    { latitude: "bad", longitude: 5 }, { latitude: 91, longitude: 5 },
    { latitude: 5, longitude: -181 }, { latitude: 0, longitude: 0 },
  ]) assert.equal(toLatLng(point), null);
  assert.deepEqual(plain(toLatLng({ latitude: "0", longitude: "38" })), {
    latitude: 0, longitude: 38,
  });
  assert.deepEqual(plain(getTrackingLocations(null, null)), {
    pickup: null, dropoff: null,
  });
});

test("GeoJSON and common coordinate object formats normalize to map coordinates", () => {
  assert.deepEqual(plain(toLatLng({ type: "Point", coordinates: [-87.6298, 41.8781] })), {
    latitude: 41.8781, longitude: -87.6298,
  });
  assert.deepEqual(plain(toLatLng({ location: { coordinates: [-87.6298, 41.8781] } })), {
    latitude: 41.8781, longitude: -87.6298,
  });
  assert.deepEqual(plain(toLatLng({ lat: "41.8781", lng: "-87.6298" })), {
    latitude: 41.8781, longitude: -87.6298,
  });
});

test("US route distances display in miles while other locations remain in kilometers", () => {
  assert.equal(usesMiles("United States"), true);
  assert.equal(formatDistance(10, "United States"), "6.2 mi");
  assert.equal(formatDistance(10, "Ethiopia"), "10.0 km");
});

test("older orders resolve their shipping address instead of showing device GPS or pickup as the drop-off", () => {
  const order = {
    storeLocation: pickup, customerLocation: pickup,
    shippingAddress1: "123 Main Street", city: "New York", zip: "10001", country: "United States",
  };
  const tracking = { pickup, dropoff: { ...pickup, address1: order.shippingAddress1 } };
  assert.deepEqual(plain(getTrackingLocations(tracking, order)), { pickup, dropoff: null });
  assert.deepEqual(plain(getTrackingLocations(tracking, order, dropoff)), { pickup, dropoff });
  assert.equal(getShippingAddressText(getTrackingAddress(tracking, order)),
    "123 Main Street, New York, 10001, United States");
});

test("new orders retain their address-derived customer coordinates", () => {
  const order = {
    storeLocation: pickup, customerLocation: dropoff,
    customerLocationSource: "shipping-address", shippingAddress1: "123 Main Street",
  };
  assert.deepEqual(plain(getTrackingLocations({ dropoff: pickup }, order)), { pickup, dropoff });
  assert.equal(getTrackingLocations(null, { ...order, customerLocation: null }).dropoff, null);
});

test("all payment handoffs preserve geocoded coordinates if the server response replaces them", () => {
  const order = getTrackingOrder({
    customerLocation: dropoff, customerLocationSource: "shipping-address",
  }, { _id: "created", customerLocation: pickup, customerLocationSource: null });
  assert.deepEqual(plain(order), {
    _id: "created", customerLocation: dropoff, customerLocationSource: "shipping-address",
  });
  assert.equal(getTrackingOrder({ _id: "temporary" }, { _id: "created" })._id, "created");
});

function loadDeliveryLocation(os, geocode, permission = "granted", reverseGeocode = async () => []) {
  const file = path.join(__dirname, "..", "assets", "common", "deliveryLocation.js");
  const { code } = babel.transformSync(fs.readFileSync(file, "utf8"), {
    filename: file, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  const permissionCalls = [];
  const dependencies = {
    "react-native": { Platform: { OS: os } },
    "expo-location": {
      requestForegroundPermissionsAsync: async () => {
        permissionCalls.push(true);
        return { status: permission };
      },
      geocodeAsync: geocode,
      reverseGeocodeAsync: reverseGeocode,
    },
    "../data/countries.json": require("../assets/data/countries.json"),
    "./orderTracking": exportsObject,
  };
  vm.runInNewContext(code, { exports, require: (name) => dependencies[name] });
  return { ...exports, permissionCalls };
}

test("checkout geocodes and verifies the address country, asking for Android geocoder permission", async () => {
  const addresses = [];
  const { resolveDeliveryLocation, permissionCalls } = loadDeliveryLocation(
    "android",
    async (address) => {
      addresses.push(address);
      return [dropoff];
    },
    "granted",
    async () => [{ country: "United States", isoCountryCode: "US" }]
  );
  assert.deepEqual(
    plain(await resolveDeliveryLocation("123 Main Street, New York", "United States")),
    dropoff
  );
  assert.deepEqual(addresses, ["123 Main Street, New York"]);
  assert.equal(permissionCalls.length, 1);
});

test("iOS address resolution does not require GPS permission", async () => {
  const { resolveDeliveryLocation, permissionCalls } = loadDeliveryLocation(
    "ios", async () => [dropoff]
  );
  assert.deepEqual(plain(await resolveDeliveryLocation("123 Main Street")), dropoff);
  assert.equal(permissionCalls.length, 0);
});

test("geocoding rejects a result in a different country rather than placing a wrong drop-off", async () => {
  const { resolveDeliveryLocation } = loadDeliveryLocation(
    "ios",
    async () => [dropoff],
    "granted",
    async () => [{ country: "Canada", isoCountryCode: "CA" }]
  );
  await assert.rejects(
    resolveDeliveryLocation("123 Main Street", "United States"),
    /could not be verified in the selected country/
  );
});

test("denied permission, missing addresses and failed geocoding surface errors without fallback coordinates", async () => {
  let geocodeCalls = 0;
  const denied = loadDeliveryLocation("android", async () => {
    geocodeCalls++;
    return [pickup];
  }, "denied");
  await assert.rejects(denied.resolveDeliveryLocation("123 Main Street"), /Allow location access/);
  await assert.rejects(denied.resolveDeliveryLocation(""), /complete delivery address/);
  assert.equal(geocodeCalls, 0);
  const empty = loadDeliveryLocation("ios", async () => []);
  await assert.rejects(empty.resolveDeliveryLocation("unknown"), /Unable to locate/);
  const failed = loadDeliveryLocation("ios", async () => { throw new Error("Geocoder unavailable"); });
  await assert.rejects(failed.resolveDeliveryLocation("123 Main Street"), /Geocoder unavailable/);
});

test("tracking renders known coordinates without drawing a straight-line route and fits after map readiness", () => {
  const screenFile = path.join(__dirname, "..", "Screens", "User", "OrderTrackingScreen.js");
  const { code: screenCode } = babel.transformSync(fs.readFileSync(screenFile, "utf8"), {
    filename: screenFile, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"],
  });
  const effects = [];
  const cameraCalls = [];
  let mapIsReady = false;
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useCallback: (fn) => fn,
    useEffect: (fn) => effects.push(fn),
    useMemo: (fn) => fn(),
    useRef: () => ({ current: { fitToCoordinates: (...args) => cameraCalls.push(args) } }),
    useState: (initial) => [initial === false ? mapIsReady : initial, () => {}],
  };
  const native = Object.fromEntries([
    "ActivityIndicator", "ScrollView", "Text", "TouchableOpacity", "View", "StatusBar",
  ].map((name) => [name, name]));
  native.StyleSheet = { create: (styles) => styles };
  const dependencies = {
    react,
    "react-native": native,
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker", Polyline: "Polyline" },
    "react-native-maps-directions": "MapViewDirections",
    "../../assets/common/mapsConfiguration": {
      canRenderNativeMap: true, formatDirectionsError: (message) => message,
    },
    "../../assets/common/orderTracking": exportsObject,
    "../../assets/common/deliveryLocation": { resolveDeliveryLocation: async () => dropoff },
    "@react-native-async-storage/async-storage": {},
    axios: {},
    "expo-constants": {},
    "react-native-vector-icons/FontAwesome": "Icon",
    "../../assets/common/baseUrl": "https://example.invalid/",
    "../../assets/common/socketClient": {},
  };
  const screenExports = {};
  vm.runInNewContext(screenCode, {
    exports: screenExports, process: { env: {} },
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  const render = () => screenExports.default({
    route: { params: { orderId: "created-order", order: { storeLocation: pickup, customerLocation: dropoff } } },
    navigation: {},
  });
  const find = (node, type) => {
    if (!node || typeof node !== "object") return null;
    if (node.type === type) return node;
    return node.children?.flat(Infinity).map((child) => find(child, type)).find(Boolean);
  };
  const tree = render();
  const map = find(tree, "MapView");
  assert.ok(map, "Checkout coordinates must render the map even while tracking loads");
  assert.equal(find(map, "Polyline"), undefined, "Do not display a straight line as a driving route");
  assert.equal(map.props.initialRegion.latitude, pickup.latitude);
  assert.equal(map.props.initialRegion.longitude, pickup.longitude);
  assert.equal(map.props.googleRenderer, "LATEST");
  effects.at(-1)();
  assert.equal(cameraCalls.length, 0, "Do not fit before native map readiness");
  mapIsReady = true;
  render();
  effects.at(-1)();
  assert.equal(cameraCalls.length, 1);
  assert.deepEqual(plain(cameraCalls[0][0]), [pickup, dropoff]);
});

test("driver tracking has no fabricated coordinates or straight-line distance/ETA fallback", () => {
  const routeScreen = fs.readFileSync(
    path.join(__dirname, "..", "Screens", "Driver", "DeliveryRouteScreen.js"),
    "utf8"
  );
  assert.doesNotMatch(routeScreen, /fallbackEstimate|haversineDistanceKm|DEFAULT_(?:DRIVER|STORE|CUSTOMER)_COORDINATES/);
  assert.match(routeScreen, /Driving ETA/);
  assert.match(routeScreen, /Driving distance/);
});

for (const liveDriver of [driver, null]) {
for (const succeeds of [false, true]) {
test(`driver routing uses ${liveDriver ? "live GPS" : "the registered store without GPS"} with ${succeeds ? "visible route metrics" : "rejected-assignment handling"}`, async () => {
  const filename = path.join(__dirname, "..", "Screens", "Driver", "DeliveryRouteScreen.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"],
  });
  const effects = [];
  const effectDependencies = [];
  const cameraCalls = [];
  const errors = [];
  let mapIsReady = false;
  let stateIndex = 0;
  let calls = 0;
  let timer;
  let now = 100000;
  let currentDriver = liveDriver;
  let orderStatus = "Driver Assigned";
  const state = new Map();
  const refs = [];
  let refIndex = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useMemo: (fn) => fn(),
    useEffect: (fn, deps) => {
      effects.push(fn);
      effectDependencies.push(deps);
    },
    useRef: (initial) => {
      const index = refIndex++;
      if (!refs[index]) refs[index] = {
        current: index === 0 ? { fitToCoordinates: (...args) => cameraCalls.push(args) } : initial,
      };
      return refs[index];
    },
    useState: (initial) => {
      const index = stateIndex++;
      const value = index === 0 ? currentDriver : index === 8 ? mapIsReady :
        state.has(index) ? state.get(index) : initial;
      return [value, (next) => {
        state.set(index, typeof next === "function" ? next(state.get(index)) : next);
        if (index === 3) errors.push(state.get(index));
      }];
    },
  };
  const dependencies = {
    react,
    "react-native": {
      Linking: {}, StyleSheet: { create: (value) => value },
      Text: "Text", TouchableOpacity: "TouchableOpacity", View: "View",
    },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "@react-navigation/native": {
      useNavigation: () => ({}),
      useRoute: () => ({ params: { orderStatus, request: {
        id: "order", storeLocation: pickup, customerLocation: dropoff,
      } } }),
    },
    "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker", Polyline: "Polyline" },
    "@react-native-async-storage/async-storage": { getItem: async () => "test-token" },
    axios: { post: async (url, body) => {
      calls++;
      assert.deepEqual(plain(body.origin), currentDriver || pickup);
      if (succeeds) return { data: {
        coordinates: [currentDriver || pickup, orderStatus === "Picked Up" ? dropoff : pickup],
        distance: 0, duration: 0,
      } };
      const error = new Error("Not found");
      error.response = { status: 404, data: { message: "Active delivery assigned to you was not found." } };
      throw error;
    } },
    "react-native-vector-icons/FontAwesome": "Icon",
    "expo-location": {},
    "../../assets/common/baseUrl": "https://example.invalid/",
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_ShopUSA" },
    "../../assets/common/mapsConfiguration": { canRenderNativeMap: true, formatDirectionsError: String },
    "../../assets/common/delivery": {},
    "../../assets/common/orderTracking": exportsObject,
  };
  const screenExports = {};
  vm.runInNewContext(code, {
    exports: screenExports, AbortController, Date: { now: () => now },
    setInterval: (fn) => { timer = fn; return 1; }, clearInterval: () => {},
    console: { warn: () => {} },
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  screenExports.default();
  effects.at(-1)();
  assert.equal(cameraCalls.length, 0);
  const cleanup = effects[0]();
  await new Promise(setImmediate);
  assert.equal(calls, 1);
  if (!succeeds) assert.match(errors.at(-1), /no longer active or assigned/);
  now += 60001;
  if (!succeeds) {
    await timer();
    assert.equal(calls, 1, "Do not poll an unassigned order again");
  }
  if (!succeeds) cleanup();
  stateIndex = 0;
  refIndex = 0;
  mapIsReady = true;
  const tree = screenExports.default();
  const text = JSON.stringify(tree);
  if (succeeds) {
    assert.match(text, /0 min/);
    assert.match(text, /0\.0 km/);
    if (!liveDriver) assert.match(text, /Driving ETA from store/);
  }
  effects.at(-1)();
  assert.equal(cameraCalls.length, 1);
  assert.deepEqual(plain(cameraCalls[0][0]), [liveDriver || pickup, pickup]);
  if (!liveDriver) {
    const previousRouteDependencies = effectDependencies[0];
    currentDriver = driver;
    stateIndex = 0;
    refIndex = 0;
    effects.length = 0;
    effectDependencies.length = 0;
    now = 101000;
    screenExports.default();
    const liveCleanup = !succeeds ? effects[0]() : () => {};
    if (succeeds) {
      assert.deepEqual(plain(effectDependencies[0]), plain(previousRouteDependencies),
        "Live GPS arrival must not recreate the route effect and clear its metrics");
      assert.equal(state.get(1).fromStore, true);
    }
    await new Promise(setImmediate);
    assert.equal(calls, 1, "Changing origin must not bypass the request cooldown");
    now = 160001;
    await timer();
    assert.equal(calls, 2, "Use live GPS on the next permitted request");
    liveCleanup();
  }
  if (succeeds) {
    cleanup();
    orderStatus = "Picked Up";
    now = refs[2].current.nextAllowedAt - 50000;
    stateIndex = 0;
    refIndex = 0;
    effects.length = 0;
    screenExports.default();
    const deliveryCleanup = effects[0]();
    await new Promise(setImmediate);
    const before = calls;
    now += 10001;
    await timer();
    assert.equal(calls, before + 1, "Delivery leg must not wait for the full pickup refresh interval");
    assert.equal(state.get(1).duration, 0);
    deliveryCleanup();
  }
});
}
}

function loadDelivery(distanceResponse, { storedToken = "stored-test-token", post } = {}) {
  const filename = path.join(__dirname, "..", "assets", "common", "delivery.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  const databaseFilename = path.join(__dirname, "..", "assets", "common", "databaseConfig.js");
  const { code: databaseCode } = babel.transformSync(fs.readFileSync(databaseFilename, "utf8"), {
    filename: databaseFilename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const databaseExports = {};
  vm.runInNewContext(databaseCode, { exports: databaseExports, require: () => ({}) });
  const dependencies = {
    "@react-native-async-storage/async-storage": {
      getItem: async (key) => {
        assert.equal(key, "token");
        return storedToken;
      },
    },
    axios: { post: post || (async () => ({ data: distanceResponse })) },
    "./baseUrl": "https://example.invalid/api/",
    "./databaseConfig": databaseExports,
  };
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}

test("mobile checkout charges USA per mile for all modes while preserving non-USA per-km fees", () => {
  const delivery = loadDelivery({});
  assert.equal(delivery.getDeliveryPricingDistance(1.609344, "E_ShopUSA"), 1);
  const filename = path.join(__dirname, "..", "Screens", "Cart", "Checkout", "Checkout.js");
  const { ast } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, ast: true, code: false,
    parserOpts: { plugins: ["jsx"] },
  });
  const declarations = ast.program.body.filter((node) => node.type === "VariableDeclaration" &&
    node.declarations.some((item) =>
      ["DELIVERY_FEE_DEFAULTS", "roundCurrency", "estimateDeliveryFee"].includes(item.id.name)));
  ast.program.body = declarations;
  const { code } = babel.transformFromAstSync(ast, null, { configFile: false, babelrc: false });
  const context = {
    getDeliveryPricingDistance: delivery.getDeliveryPricingDistance,
    Date, result: null,
  };
  const config = {
    sameDayBase: 0, sameDayPremium: 0, sameDayPerKm: 2,
    nextDayBase: 0, nextDayPerKm: 2,
    scheduledBase: 0, scheduledPerKm: 2,
    scheduledPeakSurcharge: 0, scheduledOffPeakDiscount: 0,
  };
  for (const mode of ["SAME_DAY", "NEXT_DAY", "SCHEDULED"]) {
    for (const database of ["E_ShopUSA", "E_ShoppingUSA", "E_Shopping", "E_Shopping_2"]) {
      context.mode = mode;
      context.database = database;
      context.config = config;
      const runContext = { ...context };
      vm.runInNewContext(`${code}\nresult = estimateDeliveryFee(mode, 10, new Date(), config, database);`, runContext);
      assert.equal(runContext.result, database.includes("USA") ? 12.43 : 20);
      assert.equal(delivery.getDeliveryDistanceUnit(database), database.includes("USA") ? "mile" : "km");
    }
  }
  for (const [mode, hour, expected] of [
    ["SAME_DAY", 12, 19.21], ["NEXT_DAY", 12, 7.73],
    ["SCHEDULED", 18, 11.16], ["SCHEDULED", 12, 9.16], ["SCHEDULED", 8, 9.66],
  ]) {
    const runContext = { ...context, mode, hour, database: "E_ShopUSA", config: {} };
    vm.runInNewContext(
      `${code}\nresult = estimateDeliveryFee(mode, 10, new Date(2099, 0, 1, hour), config, database);`,
      runContext
    );
    assert.equal(runContext.result, expected);
  }
});

test("checkout requires a server road distance and never silently substitutes a straight-line distance", async () => {
  assert.equal(
    await loadDelivery({ distanceKm: 42.5 }).estimateDeliveryDistanceKm({
      destinationAddress: "Chicago, IL, United States",
    }),
    42.5
  );
  await assert.rejects(
    loadDelivery({}).estimateDeliveryDistanceKm({
      destinationAddress: "Chicago, IL, United States",
    }),
    /did not return a driving distance/
  );
  const checkout = fs.readFileSync(
    path.join(__dirname, "..", "Screens", "Cart", "Checkout", "Checkout.js"),
    "utf8"
  );
  assert.doesNotMatch(checkout, /haversineDistanceKm/);
});

test("road distance requests authenticate with the supplied checkout token or stored session", async () => {
  for (const token of ["checkout-test-token", undefined]) {
    const calls = [];
    const delivery = loadDelivery(null, {
      post: async (...args) => {
        calls.push(args);
        return { data: { distanceKm: 12.5 } };
      },
    });
    assert.equal(await delivery.estimateDeliveryDistanceKm({
      destinationAddress: "Chicago, IL, United States",
      storeId: "test-store",
      customerLocation: { latitude: 41.95, longitude: -87.65 },
      token,
    }), 12.5);
    assert.equal(calls.length, 1);
    const [url, body, options] = calls[0];
    assert.equal(url, "https://example.invalid/api/settings/delivery/estimate-distance");
    assert.deepEqual(plain(body), {
      destinationAddress: "Chicago, IL, United States", storeId: "test-store",
      customerLocation: { latitude: 41.95, longitude: -87.65 },
    });
    assert.equal(options.headers.Authorization, `Bearer ${token || "stored-test-token"}`);
    assert.equal(options.timeout, 10000);
  }
});

test("road distance requests without a session report sign-in required without contacting the server", async () => {
  let calls = 0;
  const delivery = loadDelivery(null, {
    storedToken: null,
    post: async () => { calls++; },
  });
  await assert.rejects(delivery.estimateDeliveryDistanceKm({
    destinationAddress: "Chicago, IL, United States",
  }), /Please sign in again/);
  assert.equal(calls, 0);
});

test("road distance requests preserve backend authorization failures without a distance fallback", async () => {
  const delivery = loadDelivery(null, {
    post: async () => {
      const error = new Error("Request failed with status code 401");
      error.response = { data: { message: "The user is not authorized" } };
      throw error;
    },
  });
  await assert.rejects(delivery.estimateDeliveryDistanceKm({
    destinationAddress: "Chicago, IL, United States",
  }), /The user is not authorized/);
});

test("checkout preserves the backend reason when a legacy response has no distance", async () => {
  await assert.rejects(loadDelivery({
    success: true, distanceKm: null, message: "Distance API not configured.",
  }).estimateDeliveryDistanceKm({
    destinationAddress: "Chicago",
  }), /Distance API not configured/);
  for (const response of [
    { distanceKm: -1 },
    { success: false, distanceKm: 12, message: "Route lookup failed" },
  ]) {
    await assert.rejects(loadDelivery(response).estimateDeliveryDistanceKm({
      destinationAddress: "Chicago",
    }));
  }
});
