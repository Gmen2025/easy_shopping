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
  vm.runInNewContext(code, { exports, console, ...globals, require: (name) => {
    assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
    return dependencies[name];
  } });
  return exports;
}
function hooks() {
  const values = [], effects = [], dependencies = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: (initial) => {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
    },
    useRef: (initial) => {
      const index = cursor++;
      if (!(index in values)) values[index] = { current: initial };
      return values[index];
    },
    useCallback: (fn, deps) => {
      const index = cursor++;
      if (!(index in values) || deps.some((value, at) => value !== values[index].deps[at])) {
        values[index] = { fn, deps };
      }
      return values[index].fn;
    },
    useEffect: (effect, deps) => {
      const index = cursor++;
      if (!dependencies[index] || deps.some((value, at) => value !== dependencies[index][at])) {
        dependencies[index] = deps; effects.push(effect);
      }
    },
  };
  return { react, render: (Component) => { cursor = 0; const tree = Component(); effects.splice(0).forEach((effect) => effect()); return tree; } };
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const tick = () => new Promise(setImmediate);
test("availability transport scopes public reads and partial authenticated writes to the requested region", async () => {
  const calls = [];
  let data = { rides: true, services: false };
  let intercept;
  const axios = async (options) => { calls.push(await intercept(options)); return { data }; };
  axios.interceptors = { request: { use: (handler) => { intercept = handler; } } };
  const baseUrl = "https://example.invalid/api/v1/";
  const databaseConfig = { getDatabaseNameFromStorage: async () => "E_ShopUSA" };
  load("assets\\common\\attachDatabaseInterceptor.js", {
    axios, "./baseUrl": baseUrl, "./databaseConfig": databaseConfig,
  }, { global: { fetch: async () => ({}) } }).attachDatabaseInterceptor();
  const api = load("assets\\common\\serviceAvailability.js", {
    axios,
    "@react-native-async-storage/async-storage": { getItem: async () => "test-session" },
    "./baseUrl": baseUrl, "./databaseConfig": databaseConfig,
  });
  assert.equal((await api.serviceAvailabilityRequest()).services, false);
  assert.equal(calls[0].headers["x-database-name"], "E_ShopUSA");
  await api.serviceAvailabilityRequest("E_Shopping", { services: false });
  assert.equal(calls[1].headers["x-database-name"], "E_Shopping");
  assert.equal(calls[1].headers.Authorization, "Bearer test-session");
  assert.equal(calls[1].method, "put");
  assert.equal(calls[1].data.services, false);
  assert.equal(calls[1].data.rides, undefined);
  assert.equal(calls[1].data.databaseName, undefined);
  assert.match(calls[1].url, /db=E_Shopping$/);
  for (data of [null, {}, { rides: 1, services: false }, { rides: true, services: "false" }]) {
    await assert.rejects(api.serviceAvailabilityRequest(), /could not be verified/);
  }
});
test("focus, polling and foreground refresh reject stale results and fail closed with an explicit error", async () => {
  const h = hooks(), pending = [];
  let focus, foreground, timer, stopped = false, removed = false;
  h.react.useEffect = (callback) => { focus = callback; };
  const useAvailability = load("assets\\common\\useServiceAvailability.js", {
    react: h.react,
    "react-native": { AppState: { addEventListener: (name, callback) => {
      foreground = callback; return { remove: () => { removed = true; } };
    } } },
    "./serviceAvailability": { serviceAvailabilityRequest: () => new Promise((resolve, reject) => pending.push({ resolve, reject })) },
  }, {
    setInterval: (callback, milliseconds) => { timer = callback; assert.equal(milliseconds, 30000); return 7; },
    clearInterval: (handle) => { assert.equal(handle, 7); stopped = true; },
  }).default;
  const render = () => h.render(useAvailability);
  render();
  const cleanup = focus();
  assert.equal(render().settings, null);
  foreground("active");
  pending[1].resolve({ rides: false, services: true });
  await tick();
  pending[0].resolve({ rides: true, services: true });
  await tick();
  assert.equal(render().settings.rides, false);
  timer();
  pending[2].reject(new Error("Availability unavailable"));
  await tick();
  assert.equal(render().settings, null);
  assert.equal(render().error, "Availability unavailable");
  const retry = render().reload();
  pending[3].resolve({ rides: true, services: false });
  await retry;
  assert.equal(render().settings.services, false);
  assert.equal(render().error, "");
  const late = render().reload();
  cleanup();
  pending[4].resolve({ rides: false, services: true });
  await late;
  assert.equal(render().settings.rides, true);
  assert.equal(stopped, true);
  assert.equal(removed, true);
});
test("admin switches save immediately and independently for each country; save errors disable controls", async () => {
  const h = hooks(), calls = [];
  const regions = { E_Shopping: { rides: true, services: true }, E_ShopUSA: { rides: true, services: true } };
  let fail = false;
  const Screen = load("Screens\\Admin\\ServiceAvailabilitySettings.js", {
    react: h.react,
    "react-native": Object.fromEntries(["ActivityIndicator", "ScrollView", "Switch", "Text", "View"].map((key) => [key, key])),
    "react-native-paper": { Button: "Button" },
    "@react-native-picker/picker": { Picker: "Picker" },
    "../../assets/common/serviceAvailability": {
      SERVICE_LABELS: { rides: "Ride service", services: "Service requests" },
      serviceAvailabilityRequest: async (database, features) => {
        calls.push({ database, features });
        if (fail) throw new Error("Save unavailable");
        Object.assign(regions[database], features);
        return { ...regions[database] };
      },
    },
  }).default;
  const render = () => h.render(Screen);
  render(); await tick();
  const control = (label) => nodes(render()).find((node) => node.props?.accessibilityLabel === label);
  await control("Enable Ride service").props.onValueChange(false);
  assert.equal(regions.E_Shopping.rides, false);
  assert.equal(regions.E_Shopping.services, true);
  control("Service availability region").props.onValueChange("E_ShopUSA");
  render(); await tick();
  await control("Enable Service requests").props.onValueChange(false);
  assert.equal(regions.E_ShopUSA.rides, true);
  assert.equal(regions.E_ShopUSA.services, false);
  assert.equal(calls.at(-1).database, "E_ShopUSA");
  fail = true;
  await control("Enable Ride service").props.onValueChange(false);
  assert.equal(control("Enable Ride service").props.disabled, true);
  assert.ok(nodes(render()).some((node) => node.props?.accessibilityRole === "alert" && node.props.children.includes("Save unavailable")));
});
test("home booking badges are gated while profile ride/request history stays independently routed", () => {
  const source = (file) => fs.readFileSync(path.join(__dirname, "..", file), "utf8");
  const home = source("Screens\\Products\\ProductContainer.js");
  assert.match(home, /availability\.settings\?\.rides === true/);
  assert.match(home, /availability\.settings\?\.services === true/);
  assert.match(home, /Tap to retry service availability/);
  const header = source("Shared\\Header.js");
  assert.match(header, /availability\.settings\?\.rides === true/);
  assert.match(header, /availability\.settings\?\.services === true/);
  const profile = source("Screens\\User\\UserProfile.js");
  assert.match(profile, /navigation\.navigate\("MyRides"\)/);
  assert.match(profile, /navigation\.navigate\("ServiceRequests"\)/);
  assert.match(source("Navigators\\UserNavigator.js"), /name="MyRides" component=\{MyRides\}/);
});
test("service form hides new submission controls when disabled or availability cannot be verified", () => {
  const h = hooks();
  h.react.useContext = () => ({ user: { _id: "customer" } });
  const availability = { settings: { rides: true, services: false }, error: "", reload() {} };
  const native = Object.fromEntries(["View", "Text", "ScrollView", "TouchableOpacity", "ActivityIndicator"].map((key) => [key, key]));
  native.StyleSheet = { create: (styles) => styles };
  native.Alert = { alert() {} };
  const Form = load("Screens\\Service\\ServiceRequestForm.js", {
    react: h.react, "react-native": native,
    "@react-navigation/native": { useIsFocused: () => true },
    "@react-native-async-storage/async-storage": {},
    axios: {}, "react-native-toast-message": {},
    "../../Context/store/Auth": { AuthContext: {} },
    "../../Shared/Form/Input": "Input",
    "../../Shared/StyledComponenets/EasyButton": "EasyButton",
    "../../assets/common/baseUrl": "https://example.invalid/",
    "../../assets/common/useServiceAvailability": () => availability,
  }).default;
  const render = () => h.render(() => Form({ navigation: { goBack() {} } }));
  assert.ok(!nodes(render()).some((node) => node.type === "Input"));
  availability.settings = null;
  availability.error = "Availability unavailable";
  assert.ok(nodes(render()).some((node) => node.props?.accessibilityRole === "alert" && node.props.children.includes("Availability unavailable")));
  availability.settings = { rides: true, services: true };
  availability.error = "";
  assert.ok(nodes(render()).some((node) => node.type === "Input"));
});
