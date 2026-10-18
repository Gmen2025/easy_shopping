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
function harness(file, request, params = {}, auth = { isAuthenticated: true, loading: false }, options = {}) {
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
    "@expo/vector-icons": { FontAwesome5: "FontAwesome5" },
    "@react-navigation/native": { useIsFocused: () => true },
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" },
    "expo-image-picker": {
      CameraType: { front: "front" },
      requestCameraPermissionsAsync: async () => ({ status: "granted" }),
      launchCameraAsync: async () => ({ canceled: false, assets: [{ uri: "file:///driver.jpg", mimeType: "image/jpeg" }] }),
    },
    "@react-native-async-storage/async-storage": { getItem: async () => "test-token" },
    "../../assets/common/baseUrl": { __esModule: true, default: "https://api.example.com/api/v1/" },
    "../../Shared/CloudinaryUploader": { __esModule: true, default: {
      getSignature: async () => ({ signature: "signature", api_key: "key", timestamp: 1, cloud_name: "demo" }),
      uploadToCloudinary: async () => ({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1/driver.jpg" }),
    } },
    "expo-location": { Accuracy: { High: 1 },
      requestForegroundPermissionsAsync: async () => ({ status: options.locationPermission || "granted" }),
      getForegroundPermissionsAsync: async () => ({ status: "granted" }),
      getCurrentPositionAsync: async () => ({ coords: { latitude: 41.95, longitude: -87.65 } }) },
    "../../assets/common/rides": { ...helpers, rideRequest: async (route = "", options) => {
      calls.push({ route, options });
      if (route === "places/current-location") return { address1: "123 Current Street", city: "Chicago", zip: "60613",
        country: "USA", formattedAddress: "123 Current Street, Chicago, USA",
        currentLocation: { latitude: 41.95, longitude: -87.65 },
        location: { type: "Point", coordinates: [-87.65, 41.95] } };
      return request(route, options);
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
      assert.deepEqual(Array.from(options.data.stops, (stop) => stop.passengers), [1, 1, 2]);
      return { _id: "ride", currency: "usd", estimate: 10, seats: 2, baseline: { minutes: 10 }, expiresAt: new Date(Date.now() + 600000) };
    }
    if (route === "ride/request") return { _id: "ride" };
    throw new Error(`Unexpected ride request ${route}`);
  });
  await ui.start();
  assert.equal(ui.switches()[0].props.value, false);
  assert.match(text(ui.render()), /one fare for everyone/);
  assert.match(text(ui.render()), /shown for reference only/);
  assert.doesNotMatch(text(ui.render()), /\bEconomy\b|\bComfort\b/);
  ui.button("+ Add another stop").props.onPress();
  await ui.button("Calculate road route & fare").props.onPress();
  const routeMap = nodes(ui.render()).find((node) => node.type === "RideRouteMap");
  assert.equal(routeMap.props.ride._id, "ride");
  assert.equal(routeMap.props.distanceUnit, "mile");
  await ui.button("Request driver (pay after ride)").props.onPress();
  assert.equal(ui.navigations.at(-1)[0], "MyRides");
  assert.equal(ui.calls.some((call) => call.route.includes("payment")), false);
});
test("regular booking balances passenger edits, added/removed stops and mode changes", async () => {
  let sent;
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "quote") { sent = options.data; return null; }
  });
  await ui.start();
  ui.button("Saved address & passenger details").props.onPress();
  const input = (label) => nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === label);
  input("Passengers boarding").props.onChangeText("3");
  await ui.button("Calculate road route & fare").props.onPress();
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 3]);
  ui.button("+ Add another stop").props.onPress();
  await ui.button("Calculate road route & fare").props.onPress();
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 1, 4]);
  let details = nodes(ui.render()).filter((node) => node.type === "Button" && text(node) === "Saved address & passenger details");
  details[0].props.onPress();
  const typePickers = () => nodes(ui.render()).filter((node) => node.type === "Picker" &&
    ["pickup", "dropoff"].includes(node.props.selectedValue));
  assert.equal(typePickers()[0].props.enabled, false);
  assert.equal(typePickers()[1].props.enabled, true);
  typePickers()[1].props.onValueChange("dropoff");
  await ui.button("Calculate road route & fare").props.onPress();
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 1, 2]);
  input("Passengers leaving").props.onChangeText("2");
  await ui.button("Calculate road route & fare").props.onPress();
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 2, 1]);
  ui.button("Remove stop").props.onPress();
  await ui.button("Calculate road route & fare").props.onPress();
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 3]);
  assert.equal(ui.button("Remove stop"), undefined);
  ui.button("+ Add another stop").props.onPress();
  ui.switches()[0].props.onValueChange(true);
  await ui.button("Calculate road route & fare").props.onPress();
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 3]);
  ui.switches()[0].props.onValueChange(false);
  details = nodes(ui.render()).filter((node) => node.type === "Button" && text(node) === "Saved address & passenger details");
  if (details.length) details.at(-1).props.onPress();
  const leaving = input("Passengers leaving");
  assert.equal(leaving.props.disabled, true);
  assert.equal(typePickers().at(-1).props.enabled, false);
  input("Passengers boarding").props.onChangeText("");
  assert.equal(input("Passengers leaving").props.value, "");
  input("Passengers boarding").props.onChangeText("2");
  await ui.button("Calculate road route & fare").props.onPress();
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [2, 2]);
});
test("booking defaults pickup to GPS, prefills editable phone numbers and sends them with the quote", async () => {
  let sent;
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "quote") {
      sent = options.data;
      return { _id: "ride", currency: "usd", estimate: 10, seats: 1, baseline: { minutes: 10 },
        expiresAt: new Date(Date.now() + 600000) };
    }
  });
  await ui.start();
  const gps = ui.calls.find((call) => call.route === "places/current-location");
  assert.equal(gps.options.data.latitude, 41.95);
  assert.equal(gps.options.data.longitude, -87.65);
  const phones = nodes(ui.render()).filter((node) => node.type === "TextInput" && node.props.label === "Contact phone");
  assert.equal(phones.length, 2);
  assert.equal(phones[0].props.value, address.phone);
  phones[0].props.onChangeText("+13125550123");
  await ui.button("Calculate road route & fare").props.onPress();
  assert.equal(sent.stops[0].address.phone, "+13125550123");
  assert.equal(sent.stops[1].address.phone, address.phone);
  assert.equal(sent.stops[0].address.currentLocation.latitude, 41.95);
  assert.ok(ui.button("Request driver (pay after ride)"));
  const searches = nodes(ui.render()).filter((node) => node.type === "AddressSearchInput");
  searches[0].props.onSelect({ placeId: "ChIJnewpickup0001", address1: "Changed pickup", city: "Chicago", country: "USA" });
  assert.equal(ui.button("Request driver (pay after ride)"), undefined);
  await ui.button("Calculate road route & fare").props.onPress();
  assert.equal(sent.stops[0].address.currentLocation, undefined);
  assert.equal(sent.stops[0].address.phone, "+13125550123");
  assert.equal(sent.stops[0].address.address1, "Changed pickup");
  await ui.button("Use my current location").props.onPress();
  assert.equal(ui.button("Request driver (pay after ride)"), undefined);
  await ui.button("Calculate road route & fare").props.onPress();
  assert.equal(sent.stops[0].address.currentLocation.latitude, 41.95);
  assert.equal(sent.stops[0].address.placeId, undefined);
  assert.equal(sent.stops[0].address.phone, "+13125550123");
  ui.button("Saved address & passenger details").props.onPress();
  nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === "Street address / landmark")
    .props.onChangeText("Manual pickup");
  await ui.button("Calculate road route & fare").props.onPress();
  assert.equal(sent.stops[0].address.currentLocation, undefined);
  assert.equal(sent.stops[0].address.location, undefined);
  assert.equal(sent.stops[0].address.address1, "Manual pickup");
});
test("booking allows manual pickup when location permission is denied", async () => {
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route) => route === "config" ? policy : null,
    {}, { isAuthenticated: true, loading: false }, { locationPermission: "denied" });
  await ui.start();
  assert.match(text(ui.render()), /Allow location access/);
  assert.equal(ui.calls.some((call) => call.route === "places/current-location"), false);
  assert.ok(ui.button("Calculate road route & fare"));
  assert.ok(nodes(ui.render()).find((node) => node.type === "AddressSearchInput"));
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
  assert.equal(ui.button("+ Add another stop"), undefined);
  ui.button("Saved address & passenger details").props.onPress();
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
test("ride driver takes a camera photo, uploads it, and saves it to the required profile endpoint", async () => {
  const requests = [];
  const driver = { serviceModes: { delivery: true }, rideProfilePhotoRequired: true };
  const ui = harness("Screens\\Driver\\DriverRides.js", async (route, options) => {
    requests.push({ route, options });
    if (route === "me/driver") return { driver, offer: null, trip: null, riders: [], payments: [] };
    return {};
  });
  await ui.start();
  assert.match(text(ui.render()), /Take a current photo/);
  const capture = ui.button("Take profile photo");
  assert.ok(capture);
  await capture.props.onPress();
  const saved = requests.find((request) => request.route === "me/profile-photo");
  assert.equal(saved.options.method, "put");
  assert.equal(saved.options.data.profilePhotoUrl, "https://res.cloudinary.com/demo/image/upload/v1/driver.jpg");
  assert.equal(requests.filter((request) => request.route === "me/location").length, 2);
  assert.ok(ui.dialogs.some(([title]) => title === "Profile photo updated"));
});
test("driver termination sends a reason and fresh GPS without confirming destination drop-off", async () => {
  let ended = false;
  const ui = harness("Screens\\Driver\\DriverRides.js", async (route, options) => {
    if (route === "me/location") return {};
    if (route === "me/rides/ride/terminate") {
      assert.equal(options.data.reason, "Passenger requested an early stop");
      ended = true;
      return {};
    }
    assert.equal(route, "me/driver");
    return { driver: { serviceModes: {}, passengerSeats: 3 },
      trip: ended ? null : { mode: "regular", onboardSeats: 1, seatCapacity: 3,
        stops: [{ key: "1", ride: "ride", type: "dropoff", address }] },
      riders: ended ? [] : [{ _id: "ride" }], payments: [] };
  });
  await ui.start();
  assert.equal(ui.button("Terminate booking #ride").props.disabled, true);
  nodes(ui.render()).find((node) => node.type === "TextInput" &&
    node.props.label === "Termination reason").props.onChangeText("Passenger requested an early stop");
  ui.button("Terminate booking #ride").props.onPress();
  assert.match(ui.dialogs.at(-1)[1], /safely exited/);
  await ui.dialogs.at(-1)[2].find((button) => button.text === "Terminate booking").onPress();
  assert.equal(ended, true);
  const terminationIndex = ui.calls.findIndex((call) => call.route === "me/rides/ride/terminate");
  assert.equal(ui.calls[terminationIndex - 1].route, "me/location");
  assert.equal(ui.calls.some((call) => call.route === "me/next-stop"), false);
  assert.match(text(ui.render()), /No active passenger ride/);
});

test("terminated rider payment stays blocked until Admin review and respects a waived fare", async () => {
  let ride = { _id: "ride", currency: "usd", estimate: 8, status: "terminated",
    paymentStatus: "review_required", stops: [{ key: "0", type: "pickup", address }],
    termination: { reason: "Early stop", at: new Date().toISOString(), reviewStatus: "pending" } };
  const ui = harness("Screens\\Ride\\MyRides.js", async (route) => route ? ride : [ride],
    { rideId: "ride", database: "E_ShopUSA" });
  await ui.start();
  assert.match(text(ui.render()), /Payment is on hold for Admin review/);
  assert.equal(ui.button("Choose payment method"), undefined);
  ride = { ...ride, finalFare: 3, paymentStatus: "pending",
    termination: { ...ride.termination, reviewStatus: "resolved", reviewNote: "Partial fare" } };
  await ui.button("Refresh this ride").props.onPress();
  assert.ok(ui.button("Choose payment method"));
  ride = { ...ride, finalFare: 0, paymentStatus: "waived" };
  await ui.button("Refresh this ride").props.onPress();
  assert.equal(ui.button("Choose payment method"), undefined);
  assert.match(text(ui.render()), /No payment is due/);
});

test("Admin can resolve a terminated booking review with a zero waived fare and a note", async () => {
  let resolved = false;
  const ride = { _id: "ride", user: "payer", status: "terminated", currency: "usd", estimate: 8,
    paymentStatus: "review_required", stops: [{ address }],
    termination: { at: new Date().toISOString(), reason: "Early stop",
      location: { coordinates: [-74, 40] }, reviewStatus: "pending" } };
  const ui = harness("Screens\\Admin\\RideSettings.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "admin/drivers") return [];
    if (route === "admin/payments") return [resolved ? { ...ride, finalFare: 0, paymentStatus: "waived",
      termination: { ...ride.termination, reviewStatus: "resolved", reviewNote: "Test booking" } } : ride];
    assert.equal(route, "admin/terminations/ride/review");
    assert.equal(options.data.fare, 0);
    assert.equal(options.data.note, "Test booking");
    resolved = true;
    return {};
  });
  await ui.start();
  assert.equal(ui.button("Resolve termination review").props.disabled, true);
  const input = (label) => nodes(ui.render()).find((node) =>
    node.type === "TextInput" && node.props.label === label);
  input("Reviewed fare (0 to waive)").props.onChangeText("0");
  input("Admin review note").props.onChangeText("Test booking");
  assert.equal(ui.button("Resolve termination review").props.disabled, false);
  ui.button("Resolve termination review").props.onPress();
  await ui.dialogs.at(-1)[2].find((button) => button.text === "Resolve review").onPress();
  assert.equal(resolved, true);
  assert.equal(ui.button("Resolve termination review"), undefined);
  assert.match(text(ui.render()), /waived/);
});
test("Admin can explicitly waive a termination without entering a fare and cannot confirm a held or waived payment", async () => {
  let resolved = false;
  const ride = { _id: "ride", user: "payer", status: "terminated", currency: "usd", estimate: 8,
    paymentMethod: "cash", paymentStatus: "review_required", stops: [{ address }],
    termination: { at: new Date().toISOString(), reason: "Early stop", reviewStatus: "pending" } };
  const ui = harness("Screens\\Admin\\RideSettings.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "admin/drivers") return [];
    if (route === "admin/payments") return [resolved ? { ...ride, finalFare: 0, paymentStatus: "waived",
      termination: { ...ride.termination, reviewStatus: "resolved", reviewNote: "No fare due" } } : ride];
    assert.equal(route, "admin/terminations/ride/review");
    assert.equal(options.data.fare, 0);
    assert.equal(options.data.note, "No fare due");
    resolved = true;
    return {};
  });
  await ui.start();
  assert.match(text(ui.render()), /Action required: review terminated ride/);
  assert.match(text(ui.render()), /Estimate only/);
  assert.equal(ui.button("Confirm cash received"), undefined);
  assert.equal(ui.button("Waive payment").props.disabled, true);
  nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === "Admin review note")
    .props.onChangeText("No fare due");
  assert.equal(ui.button("Waive payment").props.disabled, false);
  assert.equal(ui.button("Resolve termination review").props.disabled, true);
  ui.button("Waive payment").props.onPress();
  assert.equal(resolved, false);
  await ui.dialogs.at(-1)[2].find((button) => button.text === "Waive payment").onPress();
  assert.equal(resolved, true);
  assert.equal(ui.button("Waive payment"), undefined);
  assert.equal(ui.button("Confirm cash received"), undefined);
  assert.match(text(ui.render()), /Payment waived. No payment is due/);
});

test("Admin can set a positive terminated fare before confirming cash received", async () => {
  let reviewed = false;
  const ride = { _id: "ride", user: "payer", status: "terminated", currency: "usd", estimate: 8,
    paymentMethod: "cash", paymentStatus: "review_required", stops: [{ address }],
    termination: { at: new Date().toISOString(), reason: "Early stop", reviewStatus: "pending" } };
  const ui = harness("Screens\\Admin\\RideSettings.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "admin/drivers") return [];
    if (route === "admin/payments") return [reviewed ? { ...ride, finalFare: 3.5, paymentStatus: "pending",
      termination: { ...ride.termination, reviewStatus: "resolved" } } : ride];
    assert.equal(route, "admin/terminations/ride/review");
    assert.equal(options.data.fare, 3.5);
    assert.equal(options.data.note, "Partial journey");
    reviewed = true;
    return {};
  });
  await ui.start();
  const input = (label) => nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === label);
  input("Reviewed fare (0 to waive)").props.onChangeText("3.50");
  input("Admin review note").props.onChangeText("Partial journey");
  ui.button("Resolve termination review").props.onPress();
  await ui.dialogs.at(-1)[2].find((button) => button.text === "Resolve review").onPress();
  assert.equal(reviewed, true);
  assert.equal(ui.button("Confirm cash received").props.disabled, false);
  assert.equal(ui.button("Resolve termination review"), undefined);
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
  ui.button("Saved address & passenger details").props.onPress();
  ui.button("Saved address & passenger details").props.onPress();
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
