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
    useContext: () => ({ user: null }),
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
  let data = { rides: true, services: false, financialHealth: false };
  let intercept;
  const axios = async (options) => { calls.push(await intercept(options)); return { data }; };
  axios.interceptors = { request: { use: (handler) => { intercept = handler; } } };
  const baseUrl = "https://example.invalid/api/v1/";
  const databaseConfig = { getDatabaseNameFromStorage: async () => "E_ShopUSA" };
  load("assets\\common\\attachDatabaseInterceptor.js", {
    axios, "./baseUrl": baseUrl, "./databaseConfig": databaseConfig,
    "@react-native-async-storage/async-storage": { getItem: async () => null },
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
  const disabled = { rides: false, services: false, financialHealth: false, testingAccess: true };
  for (const feature of ["rides", "services", "financialHealth"]) {
    assert.equal(api.effectiveServiceAvailability(disabled)[feature], true);
    assert.equal(api.effectiveServiceAvailability({ ...disabled, testingAccess: false })[feature], false);
  }
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
    "./serviceAvailability": {
      serviceAvailabilityRequest: () => new Promise((resolve, reject) => pending.push({ resolve, reject })),
      effectiveServiceAvailability: (settings) => settings,
    },
    "../../Context/store/Auth": { AuthContext: {} },
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
  const regions = { E_Shopping: { rides: true, services: true, financialHealth: false },
    E_ShopUSA: { rides: true, services: true, financialHealth: false } };
  let fail = false;
  const Screen = load("Screens\\Admin\\ServiceAvailabilitySettings.js", {
    react: h.react,
    "react-native": Object.fromEntries(["ActivityIndicator", "ScrollView", "Switch", "Text", "View"].map((key) => [key, key])),
    "react-native-paper": { Button: "Button" },
    "@react-native-picker/picker": { Picker: "Picker" },
    "../../assets/common/serviceAvailability": {
      SERVICE_LABELS: { rides: "Ride service", services: "Service requests", financialHealth: "Financial Health" },
      serviceAvailabilityRequest: async (database, features) => {
        calls.push({ database, features });
        if (fail) throw new Error("Save unavailable");
        Object.assign(regions[database], features);
        return { ...regions[database] };
      },
    },
    "./TestingAccessSettings": { __esModule: true, default: "TestingAccessSettings" },
    "./UsaAvailabilitySettings": { __esModule: true, default: "UsaAvailabilitySettings" },
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
  await control("Enable Financial Health").props.onValueChange(true);
  assert.equal(regions.E_ShopUSA.financialHealth, true);
  assert.equal(regions.E_Shopping.financialHealth, false);
  assert.deepEqual(Object.keys(calls.at(-1).features), ["financialHealth"]);
  assert.equal(calls.at(-1).features.financialHealth, true);
  fail = true;
  await control("Enable Ride service").props.onValueChange(false);
  assert.equal(control("Enable Ride service").props.disabled, true);
  assert.ok(nodes(render()).some((node) => node.props?.accessibilityRole === "alert" && node.props.children.includes("Save unavailable")));
});

test("USA switch requires confirmed reads and surfaces save failures", async () => {
  const h = hooks(), requests = [];
  let fail = false;
  const Screen = load("Screens\\Admin\\UsaAvailabilitySettings.js", {
    react: h.react,
    "react-native": { ActivityIndicator: "Spinner", Switch: "Switch", Text: "Text", View: "View" },
    "react-native-paper": { Button: "Button" },
    "@react-native-async-storage/async-storage": { getItem: async () => "admin-session" },
    axios: {
      get: async () => ({ data: { enabled: true } }),
      put: async (url, body, options) => {
        requests.push({ url, body, options });
        if (fail) throw new Error("Save unavailable");
        return { data: { enabled: body.enabled } };
      },
    },
    "../../assets/common/baseUrl": "https://example.invalid/api/v1/",
  }).default;
  const render = () => h.render(Screen);
  render(); await tick();
  const control = () => nodes(render()).find((node) => node.props?.accessibilityLabel === "Enable USA storefront");
  assert.equal(control().props.value, true);
  await control().props.onValueChange(false);
  assert.equal(control().props.value, false);
  assert.equal(requests[0].body.enabled, false);
  assert.equal(requests[0].options.headers.Authorization, "Bearer admin-session");
  fail = true;
  await control().props.onValueChange(true);
  assert.equal(control().props.disabled, true);
  assert.ok(nodes(render()).some((node) => node.props?.accessibilityRole === "alert" && node.props.children.includes("Save unavailable")));
});

test("tester editor scopes regional updates, allows save-error correction, and prevents overwriting a failed read", async () => {
  const h = hooks(), calls = [];
  let failRead = false, failSave = true;
  const Screen = load("Screens\\Admin\\TestingAccessSettings.js", {
    react: h.react,
    "react-native": { ActivityIndicator: "Spinner", Text: "Text", View: "View" },
    "react-native-paper": { Button: "Button", TextInput: "Input" },
    "@react-native-picker/picker": { Picker: "Picker" },
    axios: async (options) => {
      calls.push(options);
      if ((options.method === "get" && failRead) || (options.method === "put" && failSave)) {
        throw new Error(options.method === "get" ? "Read unavailable" : "Invalid email");
      }
      return { data: { emails: options.method === "get" ? ["tester@example.test"] :
        options.data.emails.length ? ["corrected@example.test"] : [] } };
    },
    "@react-native-async-storage/async-storage": { getItem: async () => "admin-session" },
    "../../assets/common/baseUrl": "https://example.invalid/api/v1/",
  }).default;
  const render = () => h.render(() => Screen({}));
  const button = (text) => nodes(render()).find((node) => node.type === "Button" && node.props.children.includes(text));
  const input = () => nodes(render()).find((node) => node.type === "Input");
  render(); await tick();
  input().props.onChangeText("invalid");
  await button("Save tester list").props.onPress();
  assert.equal(button("Save tester list").props.disabled, false);
  input().props.onChangeText(" corrected@example.test ");
  failSave = false;
  await button("Save tester list").props.onPress();
  assert.deepEqual(Array.from(calls.at(-1).data.emails), ["corrected@example.test"]);
  assert.equal(calls.at(-1).headers["x-database-name"], "E_Shopping");
  assert.equal(calls.at(-1).headers.Authorization, "Bearer admin-session");
  assert.equal(input().props.value, "corrected@example.test");
  input().props.onChangeText("");
  await button("Save tester list").props.onPress();
  assert.equal(calls.at(-1).data.emails.length, 0);
  failRead = true;
  nodes(render()).find((node) => node.props?.accessibilityLabel === "Tester access region").props.onValueChange("E_ShopUSA");
  render(); await tick();
  assert.equal(calls.at(-1).headers["x-database-name"], "E_ShopUSA");
  assert.equal(button("Save tester list").props.disabled, true);
  assert.ok(nodes(render()).some((node) => node.props?.children?.includes("Read unavailable")));
  failRead = false;
  button("Reload tester list").props.onPress();
  render(); await tick();
  assert.equal(button("Save tester list").props.disabled, false);
});

test("maintenance requests carry the selected region even before the interceptor is installed", async () => {
  const h = hooks(), requests = [];
  let user = null, token = null, database = "E_ShopUSA", malformed = false;
  h.react.createContext = () => ({ Provider: "MaintenanceProvider" });
  h.react.useContext = () => ({ user });
  const Provider = load("Context\\store\\MaintenanceContext.js", {
    react: h.react,
    "react-native": { AppState: { addEventListener: () => ({ remove() {} }) } },
    "@react-native-async-storage/async-storage": { getItem: async () => token },
    axios: {
      get: async (url, options) => {
        requests.push({ url, ...options });
        const usa = options.headers["x-database-name"] === "E_ShopUSA";
        return { data: { enabled: false, testingAccess: Boolean(token),
          ...(usa && !malformed ? { usaRegionEnabled: false } : {}) } };
      },
      put: async (url, data, options) => {
        requests.push({ url, data, ...options });
        return { data: { success: true, enabled: data.enabled } };
      },
    },
    "../../assets/common/baseUrl": "https://example.invalid/api/v1/",
    "./Auth": { AuthContext: {} },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => database },
  }, { setInterval: () => 1, clearInterval() {} }).MaintenanceProvider;
  const render = () => h.render(() => Provider({ children: null })).props.value;

  render(); await tick();
  let status = render();
  assert.equal(requests[0].headers["x-database-name"], "E_ShopUSA");
  assert.equal(requests[0].headers.Authorization, undefined);
  assert.equal(status.error, "");
  assert.equal(status.usaRestricted, true);
  assert.equal(status.testingAccess, false);

  user = { _id: "tester" }; token = "test-session";
  render(); await tick();
  status = render();
  assert.equal(requests.at(-1).headers.Authorization, "Bearer test-session");
  assert.equal(status.testingAccess, true);

  malformed = true;
  await status.checkMaintenanceStatus();
  status = render();
  assert.match(status.error, /incomplete maintenance settings/);
  assert.equal(status.testingAccess, false);

  malformed = false; database = "E_Shopping";
  await status.checkMaintenanceStatus();
  status = render();
  assert.equal(requests.at(-1).headers["x-database-name"], "E_Shopping");
  assert.equal(status.error, "");
  assert.equal(status.usaRestricted, false);
  await status.toggleMaintenance(true);
  const write = requests.find((entry) => entry.data?.enabled === true);
  assert.equal(write.headers["x-database-name"], "E_Shopping");
  assert.equal(write.headers.Authorization, "Bearer test-session");
});

test("expired maintenance sessions are signed out and checked anonymously without bypassing restrictions", async () => {
  for (const signedIn of [false, true]) {
    const h = hooks(), requests = [], alerts = [];
    let user = signedIn ? { _id: "expired-admin", isAdmin: true } : null;
    let token = "expired-token", logouts = 0;
    const logout = async () => { token = null; user = null; logouts++; };
    h.react.createContext = () => ({ Provider: "MaintenanceProvider" });
    h.react.useContext = () => ({ user, logout });
    const Provider = load("Context\\store\\MaintenanceContext.js", {
      react: h.react,
      "react-native": { Alert: { alert: (...args) => alerts.push(args) },
        AppState: { addEventListener: () => ({ remove() {} }) } },
      "@react-native-async-storage/async-storage": { getItem: async () => token },
      axios: { get: async (_url, options) => {
        requests.push(options.headers.Authorization || null);
        if (options.headers.Authorization) throw Object.assign(new Error("Unauthorized"), { response: { status: 401 } });
        return { data: { enabled: true, usaRegionEnabled: false, testingAccess: false } };
      } },
      "../../assets/common/baseUrl": "https://example.invalid/api/v1/",
      "./Auth": { AuthContext: {} },
      "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_ShopUSA" },
    }, { setInterval: () => 1, clearInterval() {} }).MaintenanceProvider;
    const render = () => h.render(() => Provider({ children: null })).props.value;
    render(); await tick(); render(); await tick();
    const status = render();
    assert.equal(logouts, 1);
    assert.match(alerts[0][1], /sign in again/i);
    assert.deepEqual(requests, ["Bearer expired-token", null]);
    assert.equal(status.error, "");
    assert.equal(status.maintenanceEnabled, true);
    assert.equal(status.usaRestricted, true);
    assert.equal(status.testingAccess, false);
  }
});

test("a newer session is not signed out by a stale maintenance response", async () => {
  const h = hooks();
  let reads = 0, logouts = 0;
  const logout = async () => { logouts++; };
  h.react.createContext = () => ({ Provider: "MaintenanceProvider" });
  h.react.useContext = () => ({ user: null, logout });
  const Provider = load("Context\\store\\MaintenanceContext.js", {
    react: h.react,
    "react-native": { AppState: { addEventListener: () => ({ remove() {} }) } },
    "@react-native-async-storage/async-storage": { getItem: async () => ++reads === 1 ? "old-token" : "new-token" },
    axios: { get: async () => { throw Object.assign(new Error("Unauthorized"), { response: { status: 401 } }); } },
    "../../assets/common/baseUrl": "https://example.invalid/api/v1/",
    "./Auth": { AuthContext: {} },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_ShopUSA" },
  }, { setInterval: () => 1, clearInterval() {} }).MaintenanceProvider;
  const render = () => h.render(() => Provider({ children: null })).props.value;
  render(); await tick();
  assert.equal(logouts, 0);
  assert.match(render().error, /session changed.*retry/i);
});

test("maintenance failures other than an expired token do not sign users out", async () => {
  const h = hooks();
  let logouts = 0;
  const logout = async () => { logouts++; };
  h.react.createContext = () => ({ Provider: "MaintenanceProvider" });
  h.react.useContext = () => ({ user: { _id: "user" }, logout });
  const Provider = load("Context\\store\\MaintenanceContext.js", {
    react: h.react,
    "react-native": { AppState: { addEventListener: () => ({ remove() {} }) } },
    "@react-native-async-storage/async-storage": { getItem: async () => "valid-token" },
    axios: { get: async () => { throw Object.assign(new Error("Unavailable"), { response: { status: 503 } }); } },
    "../../assets/common/baseUrl": "https://example.invalid/api/v1/",
    "./Auth": { AuthContext: {} },
    "../../assets/common/databaseConfig": { getDatabaseNameFromStorage: async () => "E_ShopUSA" },
  }, { setInterval: () => 1, clearInterval() {} }).MaintenanceProvider;
  const render = () => h.render(() => Provider({ children: null })).props.value;
  render(); await tick();
  assert.equal(logouts, 0);
  assert.match(render().error, /Unable to verify maintenance access/);
});

test("maintenance permits Admin and approved testers, including tester login, without exposing the app to ordinary users", () => {
  const h = hooks();
  let user = null;
  let status = { maintenanceEnabled: true, testingAccess: false, loading: false, error: "", checkMaintenanceStatus() {} };
  h.react.useContext = () => ({ user });
  const dependencies = {
    react: h.react,
    "react-native": { View: "View", ActivityIndicator: "Spinner", Text: "Text", TouchableOpacity: "Touchable",
      StyleSheet: { create: (value) => value } },
    "@react-navigation/stack": { createStackNavigator: () => ({ Navigator: "Navigator", Screen: "Screen" }) },
    "../Context/store/Auth": { AuthContext: {} },
    "../Context/store/MaintenanceContext": { useMaintenance: () => status },
    "./Main": { __esModule: true, default: "Main" },
  };
  for (const path of ["../Screens/MaintenanceScreen", "../Screens/User/Login", "../Screens/User/Register",
    "../Screens/User/EmailVerification", "../Screens/User/ForgotPassword", "../Screens/User/ResetPassword"]) {
    dependencies[path] = { __esModule: true, default: path };
  }
  const Wrapper = load("Navigators\\MaintenanceWrapper.js", dependencies).default;
  const render = () => h.render(Wrapper);
  assert.equal(render().type.name, "MaintenanceNavigator");
  user = { _id: "ordinary", isAdmin: false };
  assert.equal(render().type.name, "MaintenanceNavigator");
  status = { ...status, testingAccess: true };
  assert.equal(render().type, "Main");
  status = { ...status, testingAccess: false };
  user = { _id: "admin", isAdmin: true };
  assert.equal(render().type, "Main");
  user = { _id: "ordinary" };
  status = { ...status, error: "Unable to verify maintenance access" };
  assert.ok(nodes(render()).some((node) => node.props?.accessibilityRole === "alert"));
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
