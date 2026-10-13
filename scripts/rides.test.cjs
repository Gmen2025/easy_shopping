const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load(relative, dependencies, globals = {}) {
  const filename = path.join(__dirname, "..", relative);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, console, process: { env: {} }, ...globals, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`); return dependencies[name];
  } });
  return exports;
}
const helpers = load("assets\\common\\rides.js", { "./storefront": { apiRequest: async (...args) => args } });
const address = { label: "Home", address1: "123 Street", address2: "", city: "City", zip: "12345", country: "USA", phone: "12345678" };
const policy = { enabled: true, baseFare: 2, distanceRate: 1, minuteRate: 0.5, sharedDiscountPercent: 25, maxPickupMinutes: 20, maxDetourMinutes: 5 };
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
function harness(file, request, params = {}, auth = { isAuthenticated: true, loading: false }) {
  const states = [], effects = [], timers = [], calls = [], dialogs = [], navigations = [];
  let cursor = 0;
  const react = {
    useContext: () => auth,
    createElement: (type, props, ...children) => {
      const passed = { ...props, children };
      return typeof type === "function" ? type(passed) : { type, props: passed };
    },
    useState: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
      return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in states)) states[index] = { current: initial };
      return states[index];
    },
    useEffect: (effect) => effects.push(effect),
  };
  const native = new Proxy({ Alert: { alert: (...args) => dialogs.push(args) }, Linking: { openURL: async (url) => calls.push({ url }) } },
    { get: (target, key) => target[key] || key });
  const { default: Component } = load(file, {
    react, "react-native": native, "react-native-paper": { Button: "Button", TextInput: "TextInput", Switch: "Switch" },
    "@react-native-picker/picker": { Picker: Object.assign((props) => ({ type: "Picker", props }), { Item: "PickerItem" }) },
    "@react-navigation/native": { useIsFocused: () => true },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "expo-location": { Accuracy: { High: 1 }, requestForegroundPermissionsAsync: async () => ({ status: "granted" }),
      getForegroundPermissionsAsync: async () => ({ status: "granted" }), getCurrentPositionAsync: async () => ({ coords: { latitude: 0, longitude: 0 } }) },
    "../../assets/common/rides": { ...helpers, rideRequest: async (route = "", options) => {
      calls.push({ route, options }); return request(route, options);
    } },
    "../../assets/common/storefront": { storeRequest: async (route) => route === "delivery-current-address" ? address
      : route === "delivery-addresses" ? [{ ...address, _id: "saved", label: "Saved home" }] : [{ _id: "bank", bankName: "Bank" }] },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_ShopUSA" },
    "../../Shared/CheckoutCardPayment": { __esModule: true, default: "CardPayment", canPayByCard: false },
    "../../Shared/DeliveryCheckout": { styles: {} },
    "../../Context/store/Auth": { AuthContext: {} },
    "../../Shared/RideRouteMap": { __esModule: true, default: "RideRouteMap" },
    "../../Shared/AddressSearchInput": { __esModule: true, default: "AddressSearchInput" },
  }, { setInterval: (callback) => { timers.push(callback); return timers.length; }, clearInterval: () => {} });
  const render = () => {
    cursor = 0; effects.length = 0;
    return Component({ navigation: { navigate: (...args) => navigations.push(args), goBack() {} }, route: { params } });
  };
  const start = async () => {
    render(); effects.forEach((effect) => effect());
    for (let attempt = 0; attempt < 10; attempt++) await new Promise(setImmediate);
  };
  const button = (label) => nodes(render()).find((node) => node.type === "Button" && text(node) === label);
  return { render, start, button, calls, dialogs, navigations, timers,
    switches: () => nodes(render()).filter((node) => node.type === "Switch") };
}
test("ride API uses the shared authenticated regional request helper; fare and countdown retain exact boundaries", async () => {
  const result = await helpers.rideRequest("me/driver", { method: "get" });
  assert.equal(result[0], "rides");
  assert.equal(result[1], "me/driver");
  assert.equal(helpers.rideFare({ currency: "usd", estimate: 8, finalFare: 9 }), "USD 9.00");
  assert.equal(helpers.offerSeconds(new Date(180000), 0), 180);
  assert.equal(helpers.offerSeconds(new Date(180000), 179999), 1);
  assert.equal(helpers.offerSeconds(new Date(180000), 180000), 0);
  assert.equal(helpers.offerSeconds(new Date(180000), 180001), 0);
});
test("ride map helpers read GeoJSON stop pins and build ordered Google driving directions", () => {
  const at = (longitude, latitude) => ({ address: { location: { type: "Point", coordinates: [longitude, latitude] } } });
  assert.deepEqual({ ...helpers.rideStopPoint(at(38.75, 9.03)) }, { latitude: 9.03, longitude: 38.75 });
  assert.equal(helpers.rideStopPoint(at(0, 0)), null);
  assert.equal(helpers.rideStopPoint({ address: {} }), null);
  assert.equal(helpers.rideDirectionsUrl([at(1, 2)]), null);
  const url = helpers.rideDirectionsUrl([at(1, 2), at(3, 4), { address: {} }, at(5, 6)]);
  assert.match(url, /travelmode=driving/);
  assert.match(url, /origin=2%2C1&destination=6%2C5&waypoints=4%2C3$/);
});
for (const screen of ["RideBooking", "MyRides"]) {
  test(`${screen} asks guests to sign in without making protected requests`, async () => {
    const ui = harness(`Screens\\Ride\\${screen}.js`, async () => {
      throw new Error("Guests must not request ride data");
    }, {}, { isAuthenticated: false, loading: false });
    await ui.start();
    assert.equal(ui.calls.length, 0);
    await ui.button("Sign in").props.onPress();
    assert.equal(ui.navigations[0][0], "User");
    assert.equal(ui.navigations[0][1].screen, "Login");
    assert.equal(ui.dialogs.length, 0);
  });
  test(`${screen} explains expired authorization and offers reauthentication`, async () => {
    let loggedOut = false;
    const ui = harness(`Screens\\Ride\\${screen}.js`, async () => {
      throw { response: { status: 401, data: { message: "The user is not authorized" } } };
    }, {}, { isAuthenticated: true, loading: false, logout: async () => { loggedOut = true; } });
    await ui.start();
    assert.match(text(ui.render()), /session has expired/);
    assert.equal(ui.dialogs.length, 0);
    await ui.button("Sign in").props.onPress();
    assert.equal(loggedOut, true);
    assert.equal(ui.navigations[0][0], "User");
  });
}
test("booking reloads after sign-in and still reports non-authentication errors", async () => {
  const auth = { isAuthenticated: false, loading: false };
  const ui = harness("Screens\\Ride\\RideBooking.js", async () => policy, {}, auth);
  await ui.start();
  assert.equal(ui.calls.length, 0);
  auth.isAuthenticated = true;
  await ui.start();
  assert.equal(ui.calls[0].route, "config");
  assert.ok(ui.button("Calculate road route & fare"));
  const failing = harness("Screens\\Ride\\RideBooking.js", async () => {
    throw new Error("Network unavailable");
  });
  await failing.start();
  assert.equal(failing.dialogs[0][1], "Network unavailable");
  assert.equal(failing.button("Sign in"), undefined);
});
test("customer UI defaults to regular, submits ordered multi-stops and one fare, then navigates without pre-charging", async () => {
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "quote") {
      assert.equal(options.data.mode, "regular");
      assert.equal(options.data.stops.length, 3);
      assert.deepEqual(Array.from(options.data.stops, (stop) => stop.type), ["pickup", "pickup", "dropoff"]);
      return { _id: "ride", currency: "usd", estimate: 10, seats: 2, baseline: { minutes: 10 }, expiresAt: new Date(Date.now() + 600000) };
    }
    if (route === "ride/request") return { _id: "ride" };
    throw new Error(`Unexpected ride request ${route}`);
  });
  await ui.start();
  assert.equal(ui.switches()[0].props.value, false);
  assert.match(text(ui.render()), /one fare for everyone/);
  ui.button("Add intermediate stop (choose pickup or drop-off)").props.onPress();
  await ui.button("Calculate road route & fare").props.onPress();
  const routeMap = nodes(ui.render()).find((node) => node.type === "RideRouteMap");
  assert.equal(routeMap.props.ride._id, "ride");
  assert.equal(routeMap.props.distanceUnit, "mile");
  await ui.button("Request driver (pay after ride)").props.onPress();
  assert.equal(ui.navigations.at(-1)[0], "MyRides");
  assert.equal(ui.calls.some((call) => call.route.includes("payment")), false);
});
test("shared form exposes only the booking's pickup/dropoff and synchronizes its own passenger party", async () => {
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "quote") {
      assert.equal(options.data.mode, "shared");
      assert.deepEqual(Array.from(options.data.stops, (entry) => entry.passengers), [2, 2]);
      return { _id: "shared", currency: "usd", estimate: 8, seats: 2, baseline: { minutes: 10 }, expiresAt: new Date() };
    }
  });
  await ui.start();
  ui.switches()[0].props.onValueChange(true);
  assert.equal(ui.button("Add intermediate stop (choose pickup or drop-off)"), undefined);
  const input = nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === "Passengers boarding");
  input.props.onChangeText("2");
  assert.match(text(ui.render()), /unrelated customers/);
  await ui.button("Calculate road route & fare").props.onPress();
  assert.equal(ui.dialogs.length, 0);
});
test("rides cannot be paid before completion; completed bank fare exposes recovery without charging a second time", async () => {
  let ride = { _id: "ride", currency: "usd", estimate: 8, status: "onboard",
    stops: [{ key: "0", type: "pickup", passengers: 1, address }, { key: "1", type: "dropoff", passengers: 1, address }] };
  const ui = harness("Screens\\Ride\\MyRides.js", async (route) => route ? ride : [ride], { rideId: "ride", database: "E_ShopUSA" });
  await ui.start();
  assert.match(text(ui.render()), /only after your ride finishes/);
  assert.equal(ui.button("Choose payment method"), undefined);
  ride = { ...ride, status: "completed", finalFare: 9, paymentMethod: "bank", paymentStatus: "pending", bankAccount: { bankName: "Bank", accountNumber: "123" } };
  await ui.button("Refresh this ride").props.onPress();
  assert.match(text(ui.render()), /Your final fare: USD 9.00/);
  assert.ok(ui.button("Submit bank transfer reference"));
  assert.equal(ui.button("Choose payment method"), undefined);
});
test("driver screen separates offers and route, expires claim controls, and warns before closing shared intake", async () => {
  const driver = { serviceModes: { delivery: true, regular: true, shared: true }, passengerSeats: 3, sharedIntakeOpen: true, isAvailable: true };
  const offer = { _id: "ride", currency: "usd", estimate: 8, seats: 1, mode: "shared", offerDeadline: new Date(Date.now() + 180000),
    stops: [{ key: "0", type: "pickup", address }, { key: "1", type: "dropoff", address }] };
  const ui = harness("Screens\\Driver\\DriverRides.js", async (route) => route === "me/location" ? {} : { driver, offer, payments: [] });
  await ui.start();
  assert.ok(ui.button("Claim ride"));
  assert.ok(ui.button("Reject & reroute"));
  ui.button("Stop shared intake").props.onPress();
  assert.match(ui.dialogs.at(-1)[1], /Only onboard riders remain/);
  offer.offerDeadline = new Date(Date.now() - 1);
  await ui.button("Refresh / enable GPS").props.onPress();
  assert.equal(ui.button("Claim ride"), undefined);
  assert.match(text(ui.render()), /Offer expired/);
});
test("ride screens and badge are connected to customer, company-driver and Admin navigation", () => {
  const root = path.join(__dirname, "..");
  for (const [file, pattern] of [
    ["Screens\\Products\\ProductContainer.js", /navigate\("RideBooking"\)/],
    ["Navigators\\HomeNavigator.js", /name="RideBooking".*component=\{RideBooking\}/],
    ["Navigators\\HomeNavigator.js", /name="MyRides".*component=\{MyRides\}/],
    ["Navigators\\CompanyDriverNavigator.js", /name="DriverRides".*component=\{DriverRides\}/],
    ["Navigators\\AdminNavigator.js", /name="RideSettings".*component=\{RideSettings\}/],
  ]) assert.match(fs.readFileSync(path.join(root, file), "utf8"), pattern);
});

test("place search helpers call region-scoped ride endpoints and treat Ethiopia as ZIP-free", async () => {
  const [, search] = await helpers.searchPlaces("Bole & 22", "s-1");
  assert.equal(search, "places/autocomplete?input=Bole%20%26%2022&session=s-1");
  const [, details] = await helpers.placeAddress("ChIJ/abc", "s-1");
  assert.equal(details, "places/details/ChIJ%2Fabc?session=s-1");
  assert.ok(["Ethiopia", "ethio", "ET"].every(helpers.isEthiopia));
  assert.equal(helpers.isEthiopia("USA"), false);
  assert.notEqual(helpers.newPlacesSession(), helpers.newPlacesSession());
});
test("ride form uses selected places, hides ZIP for Ethiopia and drops stale places after manual edits", async () => {
  let sent;
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "quote") { sent = options.data; return { _id: "ride", currency: "usd", estimate: 10, seats: 1, baseline: { minutes: 5 }, expiresAt: new Date(Date.now() + 600000) }; }
    throw new Error(`Unexpected ride request ${route}`);
  });
  await ui.start();
  const searches = () => nodes(ui.render()).filter((node) => node.type === "AddressSearchInput");
  const inputs = () => nodes(ui.render()).filter((node) => node.type === "TextInput");
  assert.equal(searches().length, 2);
  assert.equal(searches()[0].props.label, "Search pickup location");
  assert.ok(inputs().some((node) => node.props.label === "ZIP code"));
  searches()[0].props.onSelect({ placeId: "ChIJpickup000001", address1: "1 Main St", city: "Town", zip: "12345",
    country: "USA", formattedAddress: "1 Main St, Town, USA" });
  searches()[1].props.onSelect({ placeId: "ChIJdropoff00001", address1: "9 Elm St", city: "Town", zip: "12345",
    country: "USA", formattedAddress: "9 Elm St, Town, USA" });
  assert.match(searches()[0].props.selectedText, /1 Main St/);
  inputs().find((node) => node.props.label === "Street address / landmark" && node.props.value === "9 Elm St").props.onChangeText("10 Elm St");
  assert.equal(searches()[1].props.selectedText, "");
  await ui.button("Calculate road route & fare").props.onPress();
  assert.equal(sent.stops[0].address.placeId, "ChIJpickup000001");
  assert.equal(sent.stops[0].address.label, "Pickup", "selection keeps the stop label and contact");
  assert.equal(sent.stops[1].address.placeId, undefined);
  assert.equal(sent.stops[1].address.address1, "10 Elm St");
  inputs().filter((node) => node.props.label === "Country")[0].props.onChangeText("Ethiopia");
  assert.equal(inputs().filter((node) => node.props.label === "ZIP code").length, 1, "only the USA stop keeps ZIP");
});
test("address search debounces typing, ignores short input and fills the stop from the chosen place", async () => {
  const states = [], effects = [], calls = [];
  let cursor = 0;
  const timers = [];
  const react = {
    useState: (initial) => { const at = cursor++; if (!(at in states)) states[at] = initial;
      return [states[at], (value) => { states[at] = typeof value === "function" ? value(states[at]) : value; }]; },
    useRef: (initial) => { const at = cursor++; if (!(at in states)) states[at] = { current: initial }; return states[at]; },
    useEffect: (effect) => effects.push(effect),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
  };
  let selected;
  const { default: Search } = load("Shared\\AddressSearchInput.js", {
    react, "react-native": new Proxy({ StyleSheet: { create: (value) => value, hairlineWidth: 1 } }, { get: (target, key) => target[key] || key }),
    "react-native-paper": { TextInput: "TextInput" },
    "../assets/common/rides": {
      newPlacesSession: () => `session-${calls.length}`,
      searchPlaces: async (input, session) => { calls.push(["search", input, session]);
        return [{ placeId: "ChIJplace000001", mainText: "Edna Mall", secondaryText: "Addis Ababa" }]; },
      placeAddress: async (placeId, session) => { calls.push(["details", placeId, session]); return { placeId, address1: "Edna Mall" }; },
    },
  }, { setTimeout: (callback) => { timers.push(callback); return timers.length; }, clearTimeout: () => {} });
  const render = () => { cursor = 0; effects.length = 0; return Search({ label: "Search pickup", onSelect: (value) => { selected = value; } }); };
  const runEffects = () => effects.splice(0).forEach((effect) => effect());
  const field = () => nodes(render()).find((node) => node.type === "TextInput");
  field().props.onChangeText("Ed"); render(); runEffects();
  assert.equal(timers.length, 0, "fewer than three characters never searches");
  field().props.onChangeText("Edna"); render(); runEffects();
  await timers.pop()();
  assert.deepEqual(calls[0], ["search", "Edna", "session-0"]);
  const row = nodes(render()).find((node) => node.type === "TouchableOpacity");
  assert.match(text(row), /Edna Mall.*Addis Ababa/);
  await row.props.onPress();
  assert.deepEqual(calls[1], ["details", "ChIJplace000001", "session-0"], "details reuse the autocomplete session");
  assert.deepEqual(selected, { placeId: "ChIJplace000001", address1: "Edna Mall" });
  assert.equal(field().props.value, "");
});
