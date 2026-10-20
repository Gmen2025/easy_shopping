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
const pricedOptions = (patch = {}) => ({ quotes: [{ _id: "ride", vehicleOption: "economy", currency: "usd",
  estimate: 10, seats: 1, baseline: { minutes: 10 }, expiresAt: new Date(Date.now() + 600000), ...patch }] });
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
  const states = [], effects = [], timers = [], timerDelays = [], calls = [], dialogs = [], navigations = [];
  let cursor = 0;
  const react = {
    useContext: () => auth,
    useMemo: (compute) => compute(),
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
  const native = new Proxy({ StyleSheet: { create: (value) => value,
    absoluteFillObject: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0 } }, Alert: { alert: (...args) => dialogs.push(args) },
    Share: { share: async (payload) => calls.push({ share: payload }) }, Linking: { openURL: async (url) => calls.push({ url }) } },
    { get: (target, key) => target[key] || key });
  const pricing = load("Shared\\RideVehiclePricing.js", {
    react, "react-native": native, "react-native-paper": { Switch: "Switch", TextInput: "TextInput" },
    "../assets/common/rides": helpers, "./DeliveryCheckout": { styles: {} },
  });
  const { default: Component } = load(file, {
    react, "react-native": native, "react-native-paper": { Button: "Button", IconButton: "IconButton", TextInput: "TextInput", Switch: "Switch" },
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
    axios: { __esModule: true, default: { get: async () => ({ data: [] }) } },
    "../../Shared/RideVehiclePricing": { __esModule: true, ...pricing },
    "../../assets/common/baseUrl": { __esModule: true, default: "https://api.example.com/api/v1/" },
    "../../Shared/CloudinaryUploader": { __esModule: true, default: {
      getSignature: async () => ({ signature: "signature", api_key: "key", timestamp: 1, cloud_name: "demo" }),
      uploadToCloudinary: async () => ({ secure_url: "https://res.cloudinary.com/demo/image/upload/v1/driver.jpg" }),
    } },
    "expo-location": { Accuracy: { High: 1 },
      requestForegroundPermissionsAsync: async () => ({ status: options.locationPermission || "granted" }),
      getForegroundPermissionsAsync: async () => ({ status: "granted" }),
      getCurrentPositionAsync: async () => ({ coords: { latitude: 41.95, longitude: -87.65 } }) },
    "../../assets/common/rides": { ...helpers, rideRequest: async (route = "", requestOptions) => {
      calls.push({ route, options: requestOptions });
      if (route === "places/current-location") {
        if (options.currentLocation) return options.currentLocation(requestOptions);
        return { address1: "123 Current Street", city: "Chicago", zip: "60613",
        country: "USA", formattedAddress: "123 Current Street, Chicago, USA",
        currentLocation: { latitude: 41.95, longitude: -87.65 },
        location: { type: "Point", coordinates: [-87.65, 41.95] } };
      }
      return request(route, requestOptions);
    } },
    "../../assets/common/storefront": { storeRequest: async (route, requestOptions) => options.storeRequest
      ? options.storeRequest(route, requestOptions) : route === "delivery-current-address" ? address
      : route === "delivery-addresses" ? [{ ...address, _id: "saved", label: "Saved home" }] : [{ _id: "bank", bankName: "Bank" }] },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: options.database || (async () => "E_ShopUSA") },
    "../../Shared/CheckoutCardPayment": { __esModule: true, default: "CardPayment", canPayByCard: false },
    "../../Shared/DeliveryCheckout": { styles: {} },
    "../../Context/store/Auth": { AuthContext: {} },
    "../../Shared/RideRouteMap": { __esModule: true, default: "RideRouteMap" },
    "../../Shared/AddressSearchInput": { __esModule: true, default: "AddressSearchInput" },
  }, { setInterval: (callback, delay) => { timers.push(callback); timerDelays.push(delay); return timers.length; }, clearInterval: () => {} });
  const render = () => {
    cursor = 0; effects.length = 0;
    return Component({ navigation: { navigate: (...args) => navigations.push(args), goBack() {} }, route: { params } });
  };
  const start = async () => {
    render(); effects.forEach((effect) => effect());
    for (let attempt = 0; attempt < 10; attempt++) await new Promise(setImmediate);
  };
  const button = (label) => nodes(render()).find((node) =>
    (node.type === "Button" && (text(node) === label || node.props.accessibilityLabel === label)) ||
    (node.type === "TouchableOpacity" && node.props.accessibilityRole === "button" && node.props.accessibilityLabel === label));
  const calculate = async ({ returnToForm = false } = {}) => {
    if (button("Review map & stops")) button("Review map & stops").props.onPress();
    await button("Calculate road route & fare").props.onPress();
    if (returnToForm && button("Continue")) button("Back").props.onPress();
  };
  return { render, start, button, calculate, calls, dialogs, navigations, timers, timerDelays,
    runLastEffect: () => { render(); return effects.at(-1)(); },
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
  assert.ok(ui.button("Review map & stops"));
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
    if (route === "quote-options") {
      assert.equal(options.data.mode, "regular");
      assert.equal(options.data.stops.length, 3);
      assert.deepEqual(Array.from(options.data.stops, (stop) => stop.type), ["pickup", "pickup", "dropoff"]);
      assert.deepEqual(Array.from(options.data.stops, (stop) => stop.passengers), [1, 1, 2]);
      return pricedOptions({ seats: 2 });
    }
    if (route === "ride/request") return { _id: "ride" };
    throw new Error(`Unexpected ride request ${route}`);
  });
  await ui.start();
  assert.equal(ui.switches()[0].props.value, false);
  assert.match(text(ui.render()), /one fare for everyone/);
  assert.match(text(ui.render()), /Economy/);
  assert.match(text(ui.render()), /Comfort/);
  assert.doesNotMatch(text(ui.render()), /\bMotorcycle\b|\bTruck\b/);
  ui.button("+ Add another stop").props.onPress();
  await ui.calculate();
  assert.equal(ui.button("Request driver (pay after ride)"), undefined);
  ui.button("Economy - USD 10.00").props.onPress();
  assert.equal(ui.button("Request driver (pay after ride)"), undefined);
  ui.button("Continue").props.onPress();
  const routeMap = nodes(ui.render()).find((node) => node.type === "RideRouteMap");
  assert.equal(routeMap.props.ride._id, "ride");
  assert.equal(routeMap.props.distanceUnit, "mile");
  await ui.button("Request driver (pay after ride)").props.onPress();
  assert.equal(ui.navigations.at(-1)[0], "MyRides");
  assert.equal(ui.calls.some((call) => call.route.includes("payment")), false);
});
test("booking keeps one full-screen background map with a collapsible, measured details panel", async () => {
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route) => {
    if (route === "config") return policy;
    if (route === "quote-options") return pricedOptions();
  });
  await ui.start();
  const maps = () => nodes(ui.render()).filter((node) => node.type === "RideRouteMap");
  assert.equal(maps().length, 1);
  assert.equal(maps()[0].props.fullScreen, true);
  const tree = ui.render();
  const background = nodes(tree).find((node) => node.type === "View" &&
    node.props.children?.some((child) => child?.type === "RideRouteMap"));
  assert.equal(background.props.style.position, "absolute");
  assert.equal(background.props.style.bottom, 0);
  const panel = nodes(tree).find((node) => node.type === "View" && node.props.style?.maxHeight === "55%");
  panel.props.onLayout({ nativeEvent: { layout: { height: 320 } } });
  assert.equal(maps()[0].props.bottomInset, 320);
  const header = nodes(tree).find((node) => node.type === "View" && node.props.style?.backgroundColor === "#ffd400");
  header.props.onLayout({ nativeEvent: { layout: { y: 30, height: 60 } } });
  assert.equal(maps()[0].props.topInset, 102);
  ui.button("Show more map").props.onPress();
  assert.equal(maps().length, 1);
  assert.equal(ui.button("Review map & stops"), undefined);
  ui.button("Show booking details").props.onPress();
  assert.ok(ui.button("Review map & stops"));
  await ui.calculate();
  assert.equal(maps().length, 1);
  assert.equal(maps()[0].props.ride._id, "ride");
  assert.equal(maps()[0].props.onSelectLocation, undefined);
  ui.button("Economy - USD 10.00").props.onPress();
  ui.button("Continue").props.onPress();
  assert.equal(maps().length, 1, "Summary reuses the background map, not an embedded second map");
});

test("saved address badges select each stop, preserve its role and invalidate quoted fares", async () => {
  const savedAddress = { ...address, _id: "home", label: "Home", address1: "456 Saved Street",
    location: { coordinates: [-87.7, 42] } };
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route) => {
    if (route === "config") return policy;
    if (route === "quote-options") return pricedOptions();
  }, {}, undefined, { storeRequest: async (route) => route === "delivery-addresses" ? [savedAddress] : address });
  await ui.start();
  const badge = (index) => ui.button(`Use Home for stop ${index}: ${helpers.addressText(savedAddress)}`);
  assert.ok(badge(1), "Saved addresses are visible without expanding stop details");
  assert.ok(badge(2));
  badge(2).props.onPress();
  assert.equal(badge(2).props.accessibilityState.selected, true);
  let map = nodes(ui.render()).find((node) => node.type === "RideRouteMap");
  assert.equal(map.props.ride.stops[1].address.address1, savedAddress.address1);
  assert.equal(map.props.ride.stops[1].address.label, "Drop-off");
  assert.equal(map.props.ride.stops[1].address.location.coordinates[0], -87.7);
  await ui.calculate();
  ui.button("Economy - USD 10.00").props.onPress();
  ui.button("Back").props.onPress();
  badge(2).props.onPress();
  map = nodes(ui.render()).find((node) => node.type === "RideRouteMap");
  assert.equal(map.props.ride._id, undefined, "Picking a saved address clears the old priced route");
  const searches = nodes(ui.render()).filter((node) => node.type === "AddressSearchInput");
  searches[1].props.onSelect({ address1: "Another destination", placeId: "another" });
  assert.equal(badge(2).props.accessibilityState.selected, false);
});

test("customers compare all vehicle prices and request only the selected quote in Regular and Shared", async () => {
  for (const shared of [false, true]) {
    let requested;
    const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
      if (route === "config") return { ...policy, vehicleRates: {
        economy: { enabled: true }, comfort: { enabled: true }, van: { enabled: true },
      } };
      if (route === "quote-options") {
        assert.equal(options.data.mode, shared ? "shared" : "regular");
        return { quotes: ["economy", "comfort", "van"].map((vehicleOption, index) =>
          pricedOptions({ _id: `${vehicleOption}-ride`, vehicleOption, estimate: [8, 16, 24][index] }).quotes[0]) };
      }
      if (route.endsWith("/request")) { requested = route; return { _id: route.split("/")[0] }; }
      throw new Error(`Unexpected route ${route}`);
    });
    await ui.start();
    if (shared) ui.switches()[0].props.onValueChange(true);
    assert.equal(ui.button("Continue"), undefined);
    await ui.calculate();
    assert.equal(ui.button("Continue").props.disabled, true);
    assert.equal(ui.button("Request driver (pay after ride)"), undefined, "customers must select a priced option");
    for (const label of ["Economy - USD 8.00", "Comfort - USD 16.00", "Van - USD 24.00"]) {
      assert.equal(ui.button(label).props.disabled, false);
    }
    ui.button("Economy - USD 8.00").props.onPress();
    assert.equal(ui.button("Economy - USD 8.00").props.accessibilityState.selected, true);
    ui.button("Van - USD 24.00").props.onPress();
    assert.equal(ui.button("Van - USD 24.00").props.accessibilityState.selected, true);
    ui.button("Comfort - USD 16.00").props.onPress();
    ui.button("Continue").props.onPress();
    const map = nodes(ui.render()).find((node) => node.type === "RideRouteMap");
    assert.equal(map.props.ride._id, "comfort-ride");
    assert.match(text(ui.render()), /Estimated fare: USD 16.00/);
    await ui.button("Request driver (pay after ride)").props.onPress();
    assert.equal(requested, "comfort-ride/request");
    assert.equal(ui.navigations.at(-1)[1].rideId, "comfort-ride");
    assert.doesNotMatch(text(ui.render()), /Motorcycle|Truck/);
  }
});

test("vehicle prices clear on contact or mode edits and unavailable choices cannot be selected", async () => {
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route) => {
    if (route === "config") return policy;
    if (route === "quote-options") return pricedOptions();
  });
  await ui.start();
  await ui.calculate();
  assert.equal(ui.button("Comfort - Unavailable").props.disabled, true);
  assert.equal(ui.button("Van - Unavailable").props.disabled, true);
  ui.button("Economy - USD 10.00").props.onPress();
  ui.button("Back").props.onPress();
  nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === "Contact phone")
    .props.onChangeText("123456789");
  assert.equal(ui.button("Request driver (pay after ride)"), undefined);
  assert.equal(ui.button("Economy - USD 10.00"), undefined);
  await ui.calculate();
  ui.button("Economy - USD 10.00").props.onPress();
  ui.button("Back").props.onPress();
  ui.switches()[0].props.onValueChange(true);
  assert.equal(ui.button("Request driver (pay after ride)"), undefined);
  assert.equal(ui.button("Economy - USD 10.00"), undefined);
});

test("expired or malformed vehicle quotes show an error instead of submitting a request", async () => {
  for (const result of [pricedOptions({ expiresAt: new Date(0) }), { quotes: [] }, null,
    pricedOptions({ vehicleOption: "truck" }), pricedOptions({ estimate: -1 }), pricedOptions({ expiresAt: "invalid" })]) {
    const ui = harness("Screens\\Ride\\RideBooking.js", async (route) => {
      if (route === "config") return policy;
      if (route === "quote-options") return result;
    });
    await ui.start();
    await ui.calculate();
    if (ui.button("Economy - USD 10.00")) {
      ui.button("Economy - USD 10.00").props.onPress();
      ui.button("Continue").props.onPress();
      await ui.button("Request driver (pay after ride)").props.onPress();
      assert.match(ui.dialogs.at(-1)[1], /expired/);
    } else assert.match(ui.dialogs.at(-1)[1], /No valid priced ride options/);
    assert.equal(ui.calls.some((call) => call.route.endsWith("/request")), false);
    assert.equal(ui.button("Request driver (pay after ride)"), undefined);
  }
});

test("Admin saves separate enabled Economy Comfort and Van rates", async () => {
  let saved;
  const ui = harness("Screens\\Admin\\RideSettings.js", async (route, options) => {
    if (route === "config" && options?.method === "put") { saved = options.data; return saved; }
    if (route === "config") return policy;
    if (route === "admin/drivers" || route === "admin/payments") return [];
  });
  await ui.start();
  for (const [index, option] of ["Economy", "Comfort", "Van"].entries()) {
    ui.switches()[index + 1].props.onValueChange(true);
    for (const [field, value] of [["Base fare", index + 2], ["Rate per mile (USA) / km (Ethiopia)", index + 1], ["Rate per minute", (index + 1) / 2]]) {
      nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === `${option} ${field}`)
        .props.onChangeText(String(value));
    }
  }
  await ui.button("Save ride configuration").props.onPress();
  assert.deepEqual(Array.from(helpers.rideOptions, ({ key }) => saved.vehicleRates[key].baseFare), ["2", "3", "4"]);
  assert.deepEqual(Array.from(helpers.rideOptions, ({ key }) => saved.vehicleRates[key].minuteRate), ["0.5", "1", "1.5"]);
  assert.ok(helpers.rideOptions.every(({ key }) => saved.vehicleRates[key].enabled));
  assert.match(ui.dialogs.at(-1)[1], /saved/);
});
test("Admin Vehicle Configuration edits passenger car classes without changing product delivery or ride policies", async () => {
  let saved, writes = 0, deliveryWrites = 0, savedPolicy;
  let current = { ...policy, driverRadiusKm: 5, vehicleRates: {
    economy: { enabled: true, baseFare: 2, distanceRate: 1, minuteRate: 0.5 },
    comfort: { enabled: true, baseFare: 4, distanceRate: 2, minuteRate: 1 },
    van: { enabled: false },
  } };
  const ui = harness("Screens\\Admin\\VehicleDeliverySettings.js", async (route, options) => {
    assert.equal(route, "config");
    if (options?.method === "put") { writes++; saved = options.data; current = structuredClone(saved); return current; }
    return structuredClone(current);
  }, {}, undefined, { storeRequest: async (route, options) => {
    assert.equal(route, "delivery-config");
    if (options?.method === "put") { deliveryWrites++; savedPolicy = options.data; return structuredClone(savedPolicy); }
    return { enabled: false, vehicles: {} };
  } });
  await ui.start();
  assert.match(text(ui.render()), /Passenger car pricing: Economy & Comfort/);
  assert.match(text(ui.render()), /Vehicle delivery pricing/);
  const input = (label) => nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === label);
  assert.equal(input("Economy Base fare").props.value, "2");
  assert.equal(input("Comfort Base fare").props.value, "4");
  input("Economy Base fare").props.onChangeText("3");
  input("Comfort Base fare").props.onChangeText("7");
  current.sharedDiscountPercent = 30;
  current.driverRadiusKm = 9;
  await ui.button("Save passenger vehicle prices").props.onPress();
  assert.equal(writes, 1);
  assert.equal(saved.vehicleRates.economy.baseFare, "3");
  assert.equal(saved.vehicleRates.comfort.baseFare, "7");
  assert.equal(saved.sharedDiscountPercent, 30, "retain the latest shared discount");
  assert.equal(saved.driverRadiusKm, 9, "retain the latest route limits");
  assert.equal(saved.enabled, true);
  assert.equal(saved.vehicles, undefined, "cargo config must not be sent to the ride API");
  assert.equal(deliveryWrites, 0);
  assert.match(text(ui.render()), /Passenger Economy, Comfort and Van prices saved/);
  await ui.button("Save vehicle configuration").props.onPress();
  assert.equal(deliveryWrites, 1);
  assert.equal(savedPolicy.vehicleRates, undefined, "passenger pricing must not be sent to delivery API");
  assert.equal(writes, 1);
  await ui.button("Reload configuration").props.onPress();
  assert.equal(input("Comfort Base fare").props.value, "7");
  ui.button("Ride settings & driver car classes").props.onPress();
  assert.equal(ui.navigations.at(-1)[0], "RideSettings");
});

test("Vehicle Configuration surfaces passenger save errors and blocks cross-region changes", async () => {
  for (const changedRegion of [false, true]) {
    let database = "E_ShopUSA", writes = 0;
    const ui = harness("Screens\\Admin\\VehicleDeliverySettings.js", async (route, options) => {
      if (options?.method === "put") { writes++; throw new Error("Invalid Comfort fare"); }
      return policy;
    }, {}, undefined, { database: async () => database, storeRequest: async () => ({ enabled: false, vehicles: {} }) });
    await ui.start();
    if (changedRegion) database = "E_ShopETH";
    await ui.button("Save passenger vehicle prices").props.onPress();
    assert.match(text(ui.render()), changedRegion ? /Region changed/ : /Invalid Comfort fare/);
    assert.equal(writes, changedRegion ? 0 : 1);
    assert.doesNotMatch(text(ui.render()), /prices saved/);
  }
});
test("regular booking balances passenger edits, added/removed stops and mode changes", async () => {
  let sent;
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "quote-options") { sent = options.data; return pricedOptions(); }
  });
  await ui.start();
  ui.button("Saved address & passenger details").props.onPress();
  const input = (label) => nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === label);
  input("Passengers boarding").props.onChangeText("3");
  await ui.calculate({ returnToForm: true });
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 3]);
  ui.button("+ Add another stop").props.onPress();
  await ui.calculate({ returnToForm: true });
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 1, 4]);
  let details = nodes(ui.render()).filter((node) => node.type === "Button" && text(node) === "Saved address & passenger details");
  details[0].props.onPress();
  details[1].props.onPress();
  const typePickers = () => nodes(ui.render()).filter((node) => node.type === "Picker" &&
    ["pickup", "dropoff"].includes(node.props.selectedValue));
  assert.equal(typePickers()[0].props.enabled, false);
  assert.equal(typePickers()[1].props.enabled, true);
  typePickers()[1].props.onValueChange("dropoff");
  await ui.calculate({ returnToForm: true });
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 1, 2]);
  input("Passengers leaving").props.onChangeText("2");
  await ui.calculate({ returnToForm: true });
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 2, 1]);
  ui.button("Remove stop").props.onPress();
  await ui.calculate({ returnToForm: true });
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 3]);
  assert.equal(ui.button("Remove stop"), undefined);
  ui.button("+ Add another stop").props.onPress();
  ui.switches()[0].props.onValueChange(true);
  await ui.calculate({ returnToForm: true });
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [3, 3]);
  ui.switches()[0].props.onValueChange(false);
  details = nodes(ui.render()).filter((node) => node.type === "Button" && text(node) === "Saved address & passenger details");
  if (details.length) details.at(-1).props.onPress();
  const leaving = input("Passengers leaving");
  assert.equal(leaving.props.disabled, true);
  assert.equal(typePickers().at(-1).props.enabled, false);
  ui.button("Saved address & passenger details").props.onPress();
  input("Passengers boarding").props.onChangeText("");
  assert.equal(input("Passengers leaving").props.value, "");
  input("Passengers boarding").props.onChangeText("2");
  await ui.calculate();
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [2, 2]);
});
test("booking defaults pickup to GPS, prefills editable phone numbers and sends them with the quote", async () => {
  let sent;
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "quote-options") {
      sent = options.data;
      return pricedOptions();
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
  await ui.calculate();
  assert.equal(sent.stops[0].address.phone, "+13125550123");
  assert.equal(sent.stops[1].address.phone, address.phone);
  assert.equal(sent.stops[0].address.currentLocation.latitude, 41.95);
  ui.button("Economy - USD 10.00").props.onPress();
  ui.button("Continue").props.onPress();
  assert.ok(ui.button("Request driver (pay after ride)"));
  ui.button("Edit trip").props.onPress();
  const searches = nodes(ui.render()).filter((node) => node.type === "AddressSearchInput");
  searches[0].props.onSelect({ placeId: "ChIJnewpickup0001", address1: "Changed pickup", city: "Chicago", country: "USA" });
  assert.equal(ui.button("Request driver (pay after ride)"), undefined);
  await ui.calculate();
  ui.button("Economy - USD 10.00").props.onPress();
  assert.equal(sent.stops[0].address.currentLocation, undefined);
  assert.equal(sent.stops[0].address.phone, "+13125550123");
  assert.equal(sent.stops[0].address.address1, "Changed pickup");
  ui.button("Back").props.onPress();
  await ui.button("Use my current location").props.onPress();
  assert.equal(ui.button("Request driver (pay after ride)"), undefined);
  await ui.calculate({ returnToForm: true });
  assert.equal(sent.stops[0].address.currentLocation.latitude, 41.95);
  assert.equal(sent.stops[0].address.placeId, undefined);
  assert.equal(sent.stops[0].address.phone, "+13125550123");
  ui.button("Saved address & passenger details").props.onPress();
  nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === "Street address / landmark")
    .props.onChangeText("Manual pickup");
  await ui.calculate();
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
  assert.ok(ui.button("Review map & stops"));
  assert.ok(nodes(ui.render()).find((node) => node.type === "AddressSearchInput"));
});
test("shared form exposes only the booking's pickup/dropoff and synchronizes its own passenger party", async () => {
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "quote-options") {
      assert.equal(options.data.mode, "shared");
      assert.deepEqual(Array.from(options.data.stops, (entry) => entry.passengers), [2, 2]);
      return pricedOptions({ _id: "shared", estimate: 8, seats: 2 });
    }
  });
  await ui.start();
  ui.switches()[0].props.onValueChange(true);
  assert.equal(ui.button("+ Add another stop"), undefined);
  ui.button("Saved address & passenger details").props.onPress();
  const input = nodes(ui.render()).find((node) => node.type === "TextInput" && node.props.label === "Passengers boarding");
  input.props.onChangeText("2");
  assert.match(text(ui.render()), /unrelated customers/);
  await ui.calculate();
  assert.equal(ui.dialogs.length, 0);
});
test("map selection verifies the selected stop, retains contacts, and submits its coordinates without a new API", async () => {
  let sent;
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "quote-options") { sent = options.data; return pricedOptions(); }
  }, {}, undefined, { currentLocation: async ({ data }) => ({
    address1: data.latitude === 42 ? "Chosen destination" : "Current pickup",
    city: "Chicago", country: "USA", phone: "Do not replace contact",
    location: { type: "Point", coordinates: [data.longitude, data.latitude] },
  }) });
  await ui.start();
  const initialMap = nodes(ui.render()).find((node) => node.type === "RideRouteMap");
  assert.equal(initialMap.props.fullScreen, true);
  assert.equal(initialMap.props.onSelectLocation, undefined, "Map taps only edit stops during map review");
  ui.button("Review map & stops").props.onPress();
  ui.button("2. Drop-off").props.onPress();
  const map = () => nodes(ui.render()).find((node) => node.type === "RideRouteMap");
  assert.equal(map().props.ride._id, undefined, "No driving-route request before quoting");
  await map().props.onSelectLocation({ latitude: 42, longitude: -87.7 });
  assert.equal(map().props.ride.stops[1].address.address1, "Chosen destination");
  assert.equal(map().props.ride.stops[1].address.phone, address.phone);
  assert.equal(map().props.ride.stops[1].address.label, "Drop-off");
  assert.equal(map().props.ride.stops[0].address.address1, "Current pickup");
  await ui.calculate();
  assert.deepEqual({ ...sent.stops[1].address.currentLocation }, { latitude: 42, longitude: -87.7 });
  assert.equal(ui.calls.filter((call) => call.route === "places/current-location").length, 2);
  ui.button("Economy - USD 10.00").props.onPress();
  ui.button("Continue").props.onPress();
  assert.match(text(ui.render()), /Chosen destination/);
  assert.match(text(ui.render()), /Choose your payment method after completion/);
  assert.equal(ui.calls.some((call) => call.route.includes("payment")), false);
});
test("failed, invalid and cross-region map selections leave stop addresses unchanged", async () => {
  for (const failure of ["lookup", "invalid", "region"]) {
    let db = "E_ShopUSA";
    const ui = harness("Screens\\Ride\\RideBooking.js", async (route) => route === "config" ? policy : null,
      {}, undefined, { database: async () => db, currentLocation: async ({ data }) => {
        if (data.latitude !== 42) return { address1: "Original pickup", location: { coordinates: [-87.65, 41.95] } };
        if (failure === "lookup") throw new Error("Location outside service country");
        if (failure === "invalid") return { address1: "Missing coordinates" };
        db = "E_ShopEthio";
        return { address1: "Other region", location: { coordinates: [38.75, 9] } };
      } });
    await ui.start();
    ui.button("Review map & stops").props.onPress();
    const map = () => nodes(ui.render()).find((node) => node.type === "RideRouteMap");
    await map().props.onSelectLocation({ latitude: 42, longitude: -87.7 });
    assert.equal(map().props.ride.stops[0].address.address1, "Original pickup");
    assert.match(ui.dialogs.at(-1)[1], /country|verified|region changed/);
    assert.equal(ui.calls.some((call) => call.route === "quote-options"), false);
  }
});
test("regular stop ordering keeps endpoints fixed, enforces 12 stops and resets safely for Shared", async () => {
  let sent;
  const ui = harness("Screens\\Ride\\RideBooking.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "quote-options") { sent = options.data; return pricedOptions(); }
  });
  await ui.start();
  ui.button("+ Add another stop").props.onPress();
  ui.button("+ Add another stop").props.onPress();
  const searches = () => nodes(ui.render()).filter((node) => node.type === "AddressSearchInput");
  searches()[1].props.onSelect({ address1: "Second pickup", country: "USA" });
  searches()[2].props.onSelect({ address1: "Third pickup", country: "USA" });
  assert.equal(ui.button("Move stop 2 earlier").props.disabled, true);
  assert.equal(ui.button("Move stop 3 later").props.disabled, true);
  ui.button("Move stop 2 later").props.onPress();
  await ui.calculate({ returnToForm: true });
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.address.address1),
    ["123 Current Street", "Third pickup", "Second pickup", ""]);
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [1, 1, 1, 3]);
  assert.equal(ui.button("Economy - USD 10.00"), undefined, "Editing surface is separate from vehicle selection");
  ui.button("Move stop 3 earlier").props.onPress();
  assert.equal(ui.button("Request driver (pay after ride)"), undefined);
  for (let at = 0; at < 8; at++) ui.button("+ Add another stop").props.onPress();
  assert.equal(searches().length, 12);
  assert.equal(ui.button("+ Add another stop").props.disabled, true);
  ui.switches()[0].props.onValueChange(true);
  assert.equal(searches().length, 2);
  assert.equal(ui.button("+ Add another stop"), undefined);
  assert.equal(ui.button("Move stop 2 earlier"), undefined);
  await ui.calculate();
  assert.equal(sent.mode, "shared");
  assert.deepEqual(Array.from(sent.stops, (stop) => stop.passengers), [1, 1]);
});
test("tracking shows real GPS, explicit unavailable ETA, call/share actions and no live pin after termination", async () => {
  let ride = { _id: "ride", mode: "regular", currency: "usd", estimate: 8, status: "assigned",
    assignedDriver: { name: "Driver", phone: "+13125550123", vehicleType: "car", plateNumber: "AB123",
      location: { coordinates: [-87.65, 41.95] }, locationUpdatedAt: new Date(Date.now() - 120000).toISOString() },
    stops: [{ key: "0", type: "pickup", passengers: 1, address }, { key: "1", type: "dropoff", passengers: 1, address }] };
  const ui = harness("Screens\\Ride\\MyRides.js", async (route) => route ? ride : [ride],
    { rideId: "ride", database: "E_ShopUSA" });
  await ui.start();
  assert.match(text(ui.render()), /Driver on the way/);
  assert.match(text(ui.render()), /Pickup arrival estimate is not available/);
  assert.match(text(ui.render()), /GPS may be out of date/);
  assert.equal(nodes(ui.render()).find((node) => node.type === "RideRouteMap").props.driverLocation.latitude, 41.95);
  await ui.button("Call driver").props.onPress();
  assert.equal(ui.calls.at(-1).url, "tel:%2B13125550123");
  await ui.button("Share ride").props.onPress();
  assert.match(ui.calls.at(-1).share.message, /Status: assigned/);
  assert.doesNotMatch(ui.calls.at(-1).share.message, /13125550123/, "Sharing does not disclose driver contact");
  assert.equal(ui.button("Choose payment method"), undefined);
  ui.runLastEffect();
  assert.equal(ui.timerDelays.at(-1), 10000);
  ride = { ...ride, status: "onboard", assignedDriver: { ...ride.assignedDriver, locationUpdatedAt: new Date().toISOString() } };
  await ui.timers.at(-1)();
  assert.match(text(ui.render()), /Trip in progress/);
  assert.doesNotMatch(text(ui.render()), /GPS may be out of date/);
  for (const status of ["completed", "cancelled", "terminated"]) {
    ride = { ...ride, status };
    await ui.button("Refresh this ride").props.onPress();
    assert.equal(nodes(ui.render()).find((node) => node.type === "RideRouteMap").props.driverLocation, null);
    const timerCount = ui.timers.length;
    ui.runLastEffect();
    assert.equal(ui.timers.length, timerCount, "Terminal trips do not start polling");
  }
});
test("pickup arrival countdown uses server arrival time and rejects expired or stale estimates at exact boundaries", () => {
  const now = 1800000000000;
  const eta = { status: "available", arrivalAt: new Date(now + 125000).toISOString(),
    computedAt: new Date(now).toISOString(), expiresAt: new Date(now + 30000).toISOString(),
    driverLocationUpdatedAt: new Date(now - 30000).toISOString() };
  const ride = { status: "assigned", pickupEta: eta };
  assert.match(helpers.pickupArrivalText(ride, now), /Arriving in 3 min/);
  assert.match(helpers.pickupArrivalText(ride, now + 5000), /Arriving in 2 min/);
  assert.match(helpers.pickupArrivalText(ride, now + 30000), /expired/);
  for (const patch of [{ arrivalAt: "invalid" }, { expiresAt: "invalid" }, { driverLocationUpdatedAt: "invalid" },
    { driverLocationUpdatedAt: new Date(now - 60000).toISOString() }, { driverLocationUpdatedAt: new Date(now + 1).toISOString() }]) {
    assert.match(helpers.pickupArrivalText({ ...ride, pickupEta: { ...eta, ...patch } }, now), /expired/);
  }
  assert.match(helpers.pickupArrivalText({ ...ride, pickupEta: { ...eta, arrivalAt: new Date(now).toISOString() } }, now), /less than a minute/);
  assert.match(helpers.pickupArrivalText({ ...ride, status: "waiting" }, now), /after a driver is assigned/);
  assert.equal(helpers.pickupArrivalText({ ...ride, pickupEta: { status: "unavailable", reason: "Waiting for fresh driver GPS." } }, now),
    "Waiting for fresh driver GPS.");
});
test("tracking renders pickup ETA and preceding stop count from the detail API, refreshes failures and hides it onboard", async () => {
  const now = Date.now();
  let ride = { _id: "ride", currency: "usd", estimate: 8, status: "assigned",
    pickupEta: { status: "available", arrivalAt: new Date(now + 300000).toISOString(),
      computedAt: new Date(now).toISOString(), expiresAt: new Date(now + 30000).toISOString(),
      driverLocationUpdatedAt: new Date(now).toISOString(), stopsBeforePickup: 2 },
    stops: [{ key: "0", type: "pickup", passengers: 1, address }] };
  const ui = harness("Screens\\Ride\\MyRides.js", async (route) => route ? ride : [ride], { rideId: "ride" });
  await ui.start();
  assert.match(text(ui.render()), /Arriving in 5 min/);
  assert.match(text(ui.render()), /including 2 stop\(s\) before your pickup/);
  assert.equal(ui.button("Choose payment method"), undefined);
  ride = { ...ride, pickupEta: { status: "unavailable", reason: "Waiting for fresh driver GPS." } };
  await ui.button("Refresh this ride").props.onPress();
  assert.match(text(ui.render()), /Waiting for fresh driver GPS/);
  assert.doesNotMatch(text(ui.render()), /Arriving in/);
  ride = { ...ride, status: "onboard" };
  await ui.button("Refresh this ride").props.onPress();
  assert.match(text(ui.render()), /Live trip location/);
  assert.doesNotMatch(text(ui.render()), /Pickup arrival time|Waiting for fresh driver GPS/);
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
  ui.button("My Rides").props.onPress();
  assert.ok(ui.button("Accept Ride"));
  assert.ok(ui.button("Decline"));
  ui.button("Profile").props.onPress();
  ui.button("Stop shared intake").props.onPress();
  assert.match(ui.dialogs.at(-1)[1], /Only onboard riders remain/);
  offer.offerDeadline = new Date(Date.now() - 1);
  await ui.button("Refresh ride status").props.onPress();
  ui.button("My Rides").props.onPress();
  assert.equal(ui.button("Accept Ride"), undefined);
  assert.match(text(ui.render()), /Offer expired/);
});

test("ride driver earnings tab only totals completed fares and lists ended rides", async () => {
  const payments = [
    { _id: "completed-a", currency: "usd", status: "completed", finalFare: 8, paymentStatus: "completed",
      stops: [{ address: { address1: "Airport" } }, { address: { address1: "Square" } }] },
    { _id: "terminated", currency: "usd", status: "terminated", finalFare: 3, paymentStatus: "review_required",
      stops: [{ address: { address1: "Market" } }, { address: { address1: "Road" } }] },
    { _id: "completed-b", currency: "usd", status: "completed", finalFare: 5, paymentStatus: "pending",
      stops: [{ address: { address1: "Station" } }, { address: { address1: "Home" } }] },
  ];
  const ui = harness("Screens\\Driver\\DriverRides.js", async (route) =>
    route === "me/location" ? {} : { driver: {}, offer: null, trip: null, riders: [], payments });
  await ui.start();
  ui.button("Earnings").props.onPress();
  const view = text(ui.render());
  assert.match(view, /USD 13\.00/);
  assert.match(view, /USD 8\.00/);
  assert.match(view, /USD 3\.00/);
  assert.match(view, /Terminated/);
  assert.match(view, /20 most recent ended rides/);
});

test("ride earnings constrain long addresses and large fare amounts to their available width", async () => {
  const pickup = "A very long airport pickup address with terminal and entrance details";
  const dropoff = "A very long destination address with building and street details";
  const ride = { _id: "large-fare", currency: "usd", status: "completed", finalFare: 123456789.99,
    stops: [{ address: { address1: pickup } }, { address: { address1: dropoff } }] };
  const ui = harness("Screens\\Driver\\DriverRides.js", async (route) =>
    route === "me/location" ? {} : { driver: {}, offer: null, trip: null, riders: [], payments: [ride] });
  await ui.start();
  const homeFare = nodes(ui.render()).find((node) => node.type === "Text" && text(node) === "USD 123456789.99");
  assert.equal(homeFare.props.style.maxWidth, "45%");
  assert.equal(homeFare.props.style.flexShrink, 1);
  assert.equal(homeFare.props.numberOfLines, 1);
  assert.equal(homeFare.props.adjustsFontSizeToFit, true);

  ui.button("Earnings").props.onPress();
  const tree = ui.render();
  const amounts = nodes(tree).filter((node) => node.type === "Text" && text(node) === "USD 123456789.99");
  assert.equal(amounts.length, 2, "The total and history amount retain the full fare");
  assert.equal(amounts[0].props.style.width, "100%");
  assert.equal(amounts[1].props.style.maxWidth, "45%");
  for (const amount of amounts) {
    assert.equal(amount.props.numberOfLines, 1);
    assert.equal(amount.props.adjustsFontSizeToFit, true);
  }
  const route = nodes(tree).find((node) => node.type === "Text" && text(node) === `${pickup} → ${dropoff}`);
  assert.equal(route.props.style[1].flex, 1);
  assert.equal(route.props.style[1].minWidth, 0);
});

test("claiming a ride opens the dedicated trip page without waiting for another GPS refresh", async () => {
  let claimed = false;
  const located = { ...address, location: { coordinates: [-87.65, 41.95] } };
  const driver = { vehicleType: "car", carClass: "comfort", serviceModes: { delivery: true }, location: located.location };
  const offer = { _id: "ride", currency: "usd", estimate: 8, seats: 1, mode: "regular",
    offerDeadline: new Date(Date.now() + 180000), stops: [{ key: "0", type: "pickup", address: located }] };
  const trip = { _id: "trip", version: 2, mode: "regular", onboardSeats: 1, seatCapacity: 3,
    stops: [{ key: "0", ride: "ride", type: "pickup", address: located, completedAt: new Date() },
      { key: "1", ride: "ride", type: "dropoff", passengers: 1, address: located }] };
  const ui = harness("Screens\\Driver\\DriverRides.js", async (route) => {
    if (route === "me/location") return {};
    if (route === "me/offers/ride/accept") { claimed = true; return {}; }
    return { driver, offer: claimed ? null : offer, trip: claimed ? trip : null, riders: [], payments: [] };
  });
  await ui.start();
  ui.button("My Rides").props.onPress();
  await ui.button("Accept Ride").props.onPress();
  assert.equal(ui.navigations.at(-1)[0], "DriverRideTrip");
  assert.equal(ui.navigations.at(-1)[1].database, "E_ShopUSA");
  assert.equal(ui.calls.filter((call) => call.route === "me/location").length, 1);
  ui.button("Profile").props.onPress();
  assert.equal(ui.button("Submit vehicle selection").props.disabled, true);
  assert.match(text(ui.render()), /Car class: comfort/);
});

test("full-screen passenger trip supports collapse, hidden-number calling and ordered multi-stop confirmation", async () => {
  const contact = { ...address, phone: "+1 (312) 555-0123", location: { coordinates: [-87.65, 41.95] } };
  const trip = { _id: "trip", mode: "regular", version: 1, onboardSeats: 0, seatCapacity: 3, stops: [
    { ride: "ride", key: "0", type: "pickup", passengers: 1, address: contact },
    { ride: "ride", key: "1", type: "pickup", passengers: 2, address: contact },
    { ride: "ride", key: "2", type: "dropoff", passengers: 3, address: contact },
  ] };
  let active = true;
  const ui = harness("Screens\\Driver\\DriverRideTrip.js", async (route, options) => {
    if (route === "me/location") return {};
    if (route === "me/start-trip") {
      assert.equal(options.data.tripId, "trip");
      trip.startedAt = new Date();
      return {};
    }
    if (route === "me/next-stop") {
      const next = trip.stops.find((stop) => !stop.completedAt);
      assert.equal(options.data.stopKey, `ride:${next.key}`);
      next.completedAt = new Date();
      trip.onboardSeats += next.type === "pickup" ? next.passengers : -next.passengers;
      trip.version++;
      active = trip.stops.some((stop) => !stop.completedAt);
      return {};
    }
    return { driver: { location: contact.location }, trip: active ? { ...trip, stops: [...trip.stops] } : null,
      riders: [{ _id: "ride", customerName: "Rider Name", vehicleOption: "comfort" }] };
  }, { database: "E_ShopUSA" });
  await ui.start();
  const map = nodes(ui.render()).find((node) => node.type === "RideRouteMap");
  assert.equal(map.props.fullScreen, true);
  assert.equal(map.props.routeEndpoint, "me/route");
  assert.match(text(ui.render()), /Rider Name/);
  assert.doesNotMatch(text(ui.render()), /555-0123/);
  const icon = (label) => nodes(ui.render()).find((node) => node.props?.accessibilityLabel === label);
  await icon("Call customer for stop 1").props.onPress();
  assert.equal(ui.calls.at(-1).url, "tel:+13125550123");
  for (const side of ["bottom", "side"]) {
    icon(`Collapse trip details to ${side}`).props.onPress();
    assert.equal(ui.button("Start trip to pickup"), undefined);
    icon("Expand trip details").props.onPress();
    assert.ok(ui.button("Start trip to pickup"));
  }
  assert.equal(ui.button("Confirm pickup 1/2 - 1 passengers").props.disabled, true);
  await ui.button("Start trip to pickup").props.onPress();
  assert.equal(ui.calls.some((call) => call.route === "me/next-stop"), false);
  for (const label of ["Confirm pickup 1/2 - 1 passengers", "Confirm pickup 2/2 - 2 passengers", "Confirm drop-off 1/1 - 3 passengers"]) {
    assert.equal(ui.button(label).props.disabled, false);
    ui.button(label).props.onPress();
    assert.equal(ui.dialogs.at(-1)[0], "Confirm next stop?");
    await ui.dialogs.at(-1)[2].find((button) => button.text === "Confirm").onPress();
  }
  assert.match(text(ui.render()), /No active passenger trip/);
  assert.equal(trip.onboardSeats, 0);
  assert.equal(ui.calls.filter((call) => call.route === "me/next-stop").length, 3);
});

test("trip page resumes started pooled trips and blocks confirmation when GPS is denied", async () => {
  const stops = [{ ride: "rider-a", key: "0", type: "pickup", passengers: 1, address, completedAt: new Date() },
    { ride: "rider-b", key: "0", type: "pickup", passengers: 2, address },
    { ride: "rider-a", key: "1", type: "dropoff", passengers: 1, address },
    { ride: "rider-b", key: "1", type: "dropoff", passengers: 2, address }];
  const ui = harness("Screens\\Driver\\DriverRideTrip.js", async () => ({
    driver: {}, trip: { _id: "trip", startedAt: new Date(), mode: "shared", stops, onboardSeats: 1, seatCapacity: 4 },
    riders: [{ _id: "rider-a", customerName: "Alice" }, { _id: "rider-b", customerName: "Bob" }],
  }), {}, undefined, { locationPermission: "denied" });
  await ui.start();
  assert.match(text(ui.render()), /Alice/);
  assert.match(text(ui.render()), /Bob/);
  assert.match(text(ui.render()), /Allow location access/);
  assert.equal(ui.button("Start trip to pickup"), undefined);
  assert.equal(ui.button("Confirm pickup 2/2 - 2 passengers").props.disabled, true);
  assert.equal(nodes(ui.render()).find((node) => node.type === "RideRouteMap").props.ride.stops.length, 3);
});

test("failed ride claims do not navigate and failed trip starts do not enable boarding", async () => {
  const ui = harness("Screens\\Driver\\DriverRides.js", async (route) => {
    if (route === "me/location") return {};
    if (route.includes("/accept")) throw new Error("Offer already claimed");
    return { driver: {}, payments: [], offer: { _id: "ride", mode: "regular", currency: "usd",
      estimate: 8, stops: [], offerDeadline: new Date(Date.now() + 60000) } };
  });
  await ui.start();
  ui.button("My Rides").props.onPress();
  await ui.button("Accept Ride").props.onPress();
  assert.equal(ui.navigations.length, 0);
  assert.match(ui.dialogs.at(-1)[1], /already claimed/);
  const page = harness("Screens\\Driver\\DriverRideTrip.js", async (route) => {
    if (route === "me/location") return {};
    if (route === "me/start-trip") throw new Error("Unable to save trip start");
    return { driver: {}, riders: [], trip: { _id: "trip", mode: "regular", stops: [
      { ride: "ride", key: "0", type: "pickup", passengers: 1, address },
      { ride: "ride", key: "1", type: "dropoff", passengers: 1, address },
    ] } };
  });
  await page.start();
  await page.button("Start trip to pickup").props.onPress();
  assert.match(text(page.render()), /Unable to save trip start/);
  assert.equal(page.button("Confirm pickup 1/1 - 1 passengers").props.disabled, true);
});

test("driver submits all supported vehicle types for Admin verification, not self-approval", async () => {
  const driver = { vehicleType: "car", serviceModes: { delivery: true } };
  const ui = harness("Screens\\Driver\\DriverRides.js", async (route, options) => {
    if (route === "me/location") return {};
    if (route === "me/vehicle") { driver.pendingVehicleType = options.data.vehicleType; return {}; }
    return { driver, trip: null, offer: null, riders: [], payments: [] };
  });
  await ui.start();
  ui.button("Profile").props.onPress();
  const picker = () => nodes(ui.render()).find((node) => node.type === "Picker");
  assert.deepEqual(Array.from(picker().props.children[1], (node) => node.props.value), ["motorcycle", "car", "van", "truck"]);
  picker().props.onValueChange("van");
  await ui.button("Submit vehicle selection").props.onPress();
  assert.equal(ui.calls.find((call) => call.route === "me/vehicle").options.data.vehicleType, "van");
  assert.match(text(ui.render()), /Awaiting Admin verification: van/);
  assert.equal(driver.vehicleType, "car");
});

test("Admin assigns Economy and Comfort only to cars while verifying vehicle requests", async () => {
  let saved;
  const driver = { _id: "driver", name: "Driver", vehicleType: "car", pendingVehicleType: "car", passengerSeats: 3 };
  const ui = harness("Screens\\Admin\\RideSettings.js", async (route, options) => {
    if (route === "config") return policy;
    if (route === "admin/drivers") return [driver];
    if (route === "admin/payments") return [];
    if (route === "admin/drivers/driver") { saved = options.data; Object.assign(driver, saved, { pendingVehicleType: "" }); return {}; }
  });
  await ui.start();
  const pickers = () => nodes(ui.render()).filter((node) => node.type === "Picker");
  assert.equal(pickers().length, 2);
  for (const carClass of ["economy", "comfort"]) {
    pickers()[1].props.onValueChange(carClass);
    await ui.button("Verify vehicle & save for Driver").props.onPress();
    assert.equal(saved.carClass, carClass);
    assert.equal(saved.vehicleType, "car");
    assert.equal(saved.passengerSeats, 3);
  }
  pickers()[0].props.onValueChange("van");
  assert.equal(pickers().length, 1);
  await ui.button("Verify vehicle & save for Driver").props.onPress();
  assert.equal(saved.vehicleType, "van");
  assert.equal(saved.carClass, "");
});

test("driver map uses the authorized route endpoint, refreshes on trip version changes and supports retry", async () => {
  const states = [], previousEffects = [], queued = [], calls = [], opened = [];
  const configuration = { canRenderNativeMap: true, MAP_UNAVAILABLE_MESSAGE: "Native map key missing" };
  const absoluteFill = { position: "absolute", top: 0, bottom: 0, left: 0, right: 0 };
  const fitted = [];
  const mapRef = { current: { fitToCoordinates: (...args) => fitted.push(args) } };
  let cursor = 0, effectIndex = 0, fail = false;
  const useState = (initial) => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], (value) => { states[index] = typeof value === "function" ? value(states[index]) : value; }];
  };
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState, useMemo: (compute) => compute(), useRef: () => mapRef,
    useEffect: (effect, dependencies) => {
      const index = effectIndex++;
      const previous = previousEffects[index];
      if (!previous || dependencies.some((entry, at) => entry !== previous.dependencies[at])) {
        queued.push(() => {
          previous?.cleanup?.();
          previousEffects[index] = { dependencies, cleanup: effect() };
        });
      }
    },
  };
  const { default: Map } = load("Shared\\RideRouteMap.js", {
    react,
    "react-native": { ActivityIndicator: "ActivityIndicator", View: "View", Text: "Text", TouchableOpacity: "TouchableOpacity",
      StyleSheet: { create: (value) => value, absoluteFillObject: absoluteFill }, Linking: { openURL: async (url) => opened.push(url) } },
    "react-native-maps": { __esModule: true, default: "MapView", Marker: "Marker", Polyline: "Polyline" },
    "../assets/common/mapsConfiguration": configuration,
    "../assets/common/rides": { ...helpers, rideRequest: async (route) => {
      calls.push(route);
      if (fail) throw new Error("Routing unavailable");
      return { coordinates: [{ latitude: 41.9, longitude: -87.6 }, { latitude: 42, longitude: -87.7 }], distanceKm: 2, minutes: 5 };
    } },
  });
  let props = { ride: { _id: "trip", stops: [{ key: "1", type: "dropoff",
    address: { ...address, location: { coordinates: [-87.7, 42] } } }] },
    driverLocation: { latitude: 41.9, longitude: -87.6 }, routeEndpoint: "me/route", routeVersion: 1, startAtDriver: true };
  const render = () => { cursor = 0; effectIndex = 0; return Map(props); };
  const flush = async () => {
    queued.splice(0).forEach((effect) => effect());
    for (let at = 0; at < 5; at++) await new Promise(setImmediate);
  };
  render(); await flush();
  assert.deepEqual(calls, ["me/route"]);
  let tree = render();
  assert.ok(nodes(tree).find((node) => node.type === "Polyline"));
  assert.equal(nodes(tree).filter((node) => node.type === "Marker").length, 2);
  await nodes(tree).find((node) => text(node) === "Open route in Google Maps").props.onPress();
  assert.match(opened[0], /origin=41.9%2C-87.6/);
  assert.match(opened[0], /destination=42%2C-87.7/);
  await flush();
  assert.equal(calls.length, 1, "GPS/map rerenders do not repeatedly bill route lookups");
  props = { ...props, routeVersion: 2 };
  fail = true;
  render(); await flush();
  tree = render();
  assert.match(text(tree), /Routing unavailable/);
  fail = false;
  nodes(tree).find((node) => node.type === "TouchableOpacity" && text(node) === "Retry driving route").props.onPress();
  render(); await flush();
  assert.equal(calls.length, 3);
  assert.ok(nodes(render()).find((node) => node.type === "Polyline"));
  props = { ...props, fullScreen: true };
  tree = render();
  assert.equal(tree.props.style.flex, 1);
  assert.equal(nodes(tree).find((node) => node.type === "MapView").props.style, absoluteFill);
  assert.ok(nodes(tree).find((node) => node.type === "Polyline"));
  assert.equal(fitted.length, 0, "Do not fit before the native map is ready");
  nodes(tree).find((node) => node.type === "MapView").props.onMapReady();
  props = { ...props, bottomInset: 300 };
  render(); await flush();
  assert.equal(fitted.at(-1)[1].edgePadding.bottom, 320);
  assert.ok(fitted.at(-1)[0].some((point) => point.latitude === 42));
  props = { ...props, topInset: 110 };
  render(); await flush();
  assert.equal(fitted.at(-1)[1].edgePadding.top, 230);
  assert.ok(nodes(render()).find((node) => node.type === "View" && node.props.style?.top === 110),
    "Map diagnostics move below the booking header");
  props = { ...props, topInset: 70 };
  props = { ...props, ride: { _id: "trip", stops: [{ type: "pickup", address: { address1: "Missing coordinates" } }] } };
  tree = render();
  assert.ok(nodes(tree).find((node) => node.type === "MapView"), "Missing stop pins must not hide the map");
  assert.equal(nodes(tree).find((node) => node.type === "MapView").props.initialRegion.latitude, 41.9);
  assert.match(text(tree), /Some stops have no verified map coordinates/);
  assert.ok(nodes(tree).find((node) => node.type === "Polyline"), "Keep real backend road geometry without stop pins");
  props = { ...props, driverLocation: null };
  tree = render();
  assert.equal(nodes(tree).find((node) => node.type === "MapView").props.initialRegion.latitude, 41.9,
    "Use actual road coordinates when neither stop nor driver pins are available");
  fail = true;
  props = { ...props, routeVersion: 3 };
  render(); await flush();
  tree = render();
  assert.ok(nodes(tree).find((node) => node.type === "MapView"));
  assert.equal(nodes(tree).find((node) => node.type === "MapView").props.initialRegion, undefined,
    "Do not invent a location when all coordinates are missing");
  assert.match(text(tree), /Routing unavailable/);
  assert.doesNotMatch(text(tree), /Stop pins are still shown|Available stop pins are still shown/);
  assert.ok(nodes(tree).find((node) => node.type === "TouchableOpacity" && text(node) === "Retry driving route"));
  assert.ok(nodes(tree).find((node) => node.type === "TouchableOpacity" && text(node) === "Open route in Google Maps"));
  let selected;
  props = { ...props, ride: { stops: [] }, onSelectLocation: (point) => { selected = point; }, selectionDisabled: false };
  render(); await flush();
  tree = render();
  assert.equal(nodes(tree).some((node) => node.type === "Polyline"), false, "An unquoted draft never keeps a previous driving route");
  const callsBeforeTap = calls.length;
  nodes(tree).find((node) => node.type === "MapView").props.onPress({ nativeEvent: { coordinate: { latitude: 42, longitude: -87.7 } } });
  assert.deepEqual(selected, { latitude: 42, longitude: -87.7 });
  assert.equal(calls.length, callsBeforeTap, "The map emits coordinates; the caller owns reverse-geocoding");
  props = { ...props, selectionDisabled: true };
  assert.equal(nodes(render()).find((node) => node.type === "MapView").props.onPress, undefined);
  props = { ...props, onSelectLocation: undefined, selectionDisabled: false };
  assert.equal(nodes(render()).find((node) => node.type === "MapView").props.onPress, undefined, "Tracking maps remain read-only");
  configuration.canRenderNativeMap = false;
  tree = render();
  assert.equal(nodes(tree).some((node) => node.type === "MapView"), false);
  const diagnostics = nodes(tree).find((node) => node.type === "View" && node.props.style?.top === 70);
  assert.match(text(diagnostics), /Native map key missing/);
  assert.equal(nodes(diagnostics).find((node) => node.type === "Text" && text(node) === "Native map key missing")
    .props.accessibilityRole, "alert");
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
  ui.button("Profile").props.onPress();
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
  ui.button("My Rides").props.onPress();
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
    if (route === "quote-options") { sent = options.data; return pricedOptions({ baseline: { minutes: 5 } }); }
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
  await ui.calculate({ returnToForm: true });
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
