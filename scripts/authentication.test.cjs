const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

const root = path.join(__dirname, "..");
function load(relative, mocks = {}, globals = {}) {
  const filename = path.join(root, relative);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs", "@babel/plugin-transform-react-jsx"],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports, URL, URLSearchParams, Date, console, setInterval, clearInterval, ...globals,
    require(name) {
      if (!(name in mocks)) throw new Error(`Unexpected import: ${name}`);
      return mocks[name];
    },
  });
  return exports;
}
const flow = load("assets\\common\\authFlow.js");

test("second-factor challenges are not authenticated sessions", () => {
  const result = flow.classifyAuthResponse({
    requiresTwoFactor: true, challengeId: "opaque-challenge", method: "authenticator",
  });
  assert.equal(result.challenge.challengeId, "opaque-challenge");
  assert.equal(result.token, undefined);
  for (const data of [
    { requiresTwoFactor: true, challengeId: "id", method: "sms" },
    { requiresTwoFactor: true, challengeId: "", method: "email" },
    { requiresTwoFactor: true, challengeId: "id", method: "email", token: "access-token" },
    {}, null, { token: "token" }, { _id: "user" },
  ]) assert.throws(() => flow.classifyAuthResponse(data));
});

test("password and social responses preserve full roles and nested profiles", () => {
  for (const data of [
    { token: "access", _id: "user", isAdmin: true, role: "driver" },
    { token: "access", user: { id: "user", isAdmin: true, role: "driver" } },
  ]) {
    const result = flow.classifyAuthResponse(data);
    assert.equal(result.token, "access");
    assert.equal(result.user.isAdmin, true);
    assert.equal(result.user.role, "driver");
    assert.equal(result.user.token, undefined);
  }
});

test("social callbacks require exact registered app destination and one-use code", () => {
  assert.equal(flow.parseSocialCallback("addugeneteshop://auth?code=handoff", "addugeneteshop://auth"), "handoff");
  assert.equal(flow.parseSocialCallback("https://shop.example/auth?code=handoff", "https://shop.example/auth"), "handoff");
  for (const url of [
    "otherapp://auth?code=stolen", "addugeneteshop://other?code=stolen",
    "addugeneteshop://auth/extra?code=stolen", "addugeneteshop://auth",
    "addugeneteshop://auth?error=access_denied&code=not-valid",
  ]) assert.throws(() => flow.parseSocialCallback(url, "addugeneteshop://auth"));
});

test("resend countdown never goes negative and rounds up", () => {
  assert.equal(flow.resendSecondsRemaining(60000, 0), 60);
  assert.equal(flow.resendSecondsRemaining(60000, 59999), 1);
  assert.equal(flow.resendSecondsRemaining(60000, 61000), 0);
});

test("backend string and JSON errors are visible", () => {
  assert.equal(flow.authErrorMessage({ response: { data: "Verify your email" } }), "Verify your email");
  assert.equal(flow.authErrorMessage({ response: { data: { message: "Code expired" } } }), "Code expired");
});

function authHarness(response, { storageFails = false, challenge = null } = {}) {
  const actions = [];
  const writes = [];
  const posts = [];
  const react = {
    createContext: () => ({ Provider: "Provider" }),
    useReducer: (_reducer, initial) => [{ ...initial, twoFactorChallenge: challenge }, (action) => actions.push(action)],
    useEffect: () => {},
    useCallback: (fn) => fn,
    createElement: (_type, props) => props.value,
  };
  const module = load("Context\\store\\Auth.js", {
    react: { __esModule: true, default: react, ...react },
    axios: { post: async (url, body) => { posts.push({ url, body }); return { data: response }; } },
    "../../assets/common/baseUrl": { __esModule: true, default: "https://api.example/api/v1/" },
    "@react-native-async-storage/async-storage": {
      multiSet: async (entries) => {
        if (storageFails) throw new Error("Device storage unavailable");
        writes.push(...entries);
      },
    },
    "react-native": { AppState: {} },
    "../../assets/common/authApi": { socialSignIn: async () => response },
    "../../assets/common/authFlow": flow,
  });
  return { context: module.AuthProvider({ children: null }), actions, writes, posts };
}

test("password challenge does not store an access token or dispatch authenticated state", async () => {
  const h = authHarness({ requiresTwoFactor: true, challengeId: "challenge", method: "email" });
  await h.context.login(" USER@Example.com ", "password");
  assert.equal(h.writes.length, 0);
  assert.equal(h.actions.at(-1).type, "TWO_FACTOR_REQUIRED");
  assert.equal(h.posts[0].body.email, "user@example.com");
});

test("social challenge follows the same second-factor gate", async () => {
  const h = authHarness({ requiresTwoFactor: true, challengeId: "challenge", method: "authenticator" });
  await h.context.loginWithSocial("google");
  assert.equal(h.writes.length, 0);
  assert.equal(h.actions.at(-1).type, "TWO_FACTOR_REQUIRED");
});

test("verification saves the final access token before authenticating", async () => {
  const h = authHarness({ token: "final-token", _id: "user", role: "customer" }, {
    challenge: { challengeId: "challenge", method: "email" },
  });
  await h.context.verifyTwoFactor("123456", true);
  assert.equal(h.posts[0].body.challengeId, "challenge");
  assert.equal(h.posts[0].body.useBackupCode, true);
  assert.equal(h.writes[0][0], "token");
  assert.equal(h.writes[0][1], "final-token");
  assert.equal(h.actions.at(-1).type, "LOGIN_SUCCESS");
});

test("failed token persistence cannot produce a success-shaped login", async () => {
  const h = authHarness({ token: "token", _id: "user" }, { storageFails: true });
  await h.context.login("user@example.com", "password");
  assert.equal(h.actions.at(-1).type, "LOGIN_FAIL");
  assert.match(h.actions.at(-1).payload, /storage unavailable/);
  assert.ok(!h.actions.some((action) => action.type === "LOGIN_SUCCESS"));
});

test("canceling social sign-in leaves the session unauthenticated", async () => {
  const h = authHarness(null);
  await h.context.loginWithSocial("apple");
  assert.equal(h.actions.at(-1).type, "CANCEL_LOGIN");
  assert.equal(h.writes.length, 0);
});

test("browser sign-in uses S256 PKCE, database context and a code-only exchange", async () => {
  const crypto = require("node:crypto");
  const posts = [];
  let browserUrl;
  const api = load("assets\\common\\authApi.js", {
    axios: { post: async (url, body) => { posts.push({ url, body }); return { data: { token: "final" } }; } },
    "@react-native-async-storage/async-storage": {},
    "expo-crypto": {
      getRandomBytesAsync: async () => new Uint8Array(32).fill(17),
      digestStringAsync: async (_algorithm, text) => crypto.createHash("sha256").update(text).digest("base64"),
      CryptoDigestAlgorithm: { SHA256: "SHA256" },
      CryptoEncoding: { BASE64: "base64" },
    },
    "expo-web-browser": {
      maybeCompleteAuthSession() {},
      openAuthSessionAsync: async (url) => {
        browserUrl = new URL(url);
        return { type: "success", url: "addugeneteshop://auth?code=one-use-handoff" };
      },
    },
    "expo-constants": { expoConfig: { extra: {} } },
    "react-native": { Platform: { OS: "android" } },
    expo: { requireOptionalNativeModule: () => ({}) },
    "./baseUrl": { __esModule: true, default: "https://api.example/api/v1/" },
    "./databaseConfig": { getDatabaseNameFromStorage: async () => "E_ShopUSA" },
    "./authFlow": flow,
    "./authFeatures": { getSocialLoginSetting: async () => ({ enabled: true }) },
  });
  await api.socialSignIn("google");
  assert.equal(browserUrl.searchParams.get("provider"), "google");
  assert.equal(browserUrl.searchParams.get("db"), "E_ShopUSA");
  assert.equal(browserUrl.searchParams.get("redirectUri"), "addugeneteshop://auth");
  const verifier = posts[0].body.codeVerifier;
  assert.equal(verifier.length, 64);
  assert.equal(browserUrl.searchParams.get("codeChallenge"), crypto.createHash("sha256").update(verifier).digest("base64url"));
  assert.equal(browserUrl.searchParams.has("codeVerifier"), false);
  assert.equal(posts[0].body.code, "one-use-handoff");
  assert.equal(posts[0].body.databaseName, "E_ShopUSA");
  assert.ok(posts[0].url.endsWith("users/auth/social/exchange"));
});

for (const missing of ["ExpoCrypto", "ExpoWebBrowser"]) {
  test(`missing ${missing} does not crash startup or load unavailable native packages`, async () => {
    const api = load("assets\\common\\authApi.js", {
      axios: {},
      "@react-native-async-storage/async-storage": {},
      expo: { requireOptionalNativeModule: (name) => name === missing ? null : {} },
      "expo-constants": { expoConfig: { extra: {} } },
      "react-native": { Platform: { OS: "android" } },
      "./baseUrl": { __esModule: true, default: "https://api.example/api/v1/" },
      "./databaseConfig": {},
      "./authFlow": flow,
      "./authFeatures": { getSocialLoginSetting: async () => ({ enabled: true }) },
    });
    assert.equal(typeof api.securityRequest, "function");
    await assert.rejects(api.socialSignIn("google"), (error) => {
      assert.match(error.message, new RegExp(missing));
      assert.match(error.message, /rebuilt app/);
      assert.match(error.message, /Email sign-in is still available/);
      return true;
    });
  });
}

test("remote social settings validate server data and require authentication for admin updates", async () => {
  let data = { success: true, enabled: false };
  let token = "admin-token";
  const writes = [];
  const features = load("assets\\common\\authFeatures.js", {
    axios: {
      get: async () => ({ data }),
      put: async (url, body, options) => { writes.push({ url, body, options }); return { data }; },
    },
    "@react-native-async-storage/async-storage": { getItem: async () => token },
    "./baseUrl": { __esModule: true, default: "https://api.example/api/v1/" },
  });
  for (const enabled of [true, false]) {
    data = { success: true, enabled };
    assert.equal((await features.getSocialLoginSetting()).enabled, enabled);
  }
  await features.updateSocialLoginSetting(false);
  assert.equal(writes[0].url, "https://api.example/api/v1/settings/social-login");
  assert.equal(writes[0].body.enabled, false);
  assert.equal(writes[0].options.headers.Authorization, "Bearer admin-token");
  token = null;
  await assert.rejects(features.updateSocialLoginSetting(true), /session has expired/);
  assert.equal(writes.length, 1);
  for (const invalid of [{}, { success: true, enabled: "true" }, { success: false, enabled: true }]) {
    data = invalid;
    await assert.rejects(features.getSocialLoginSetting(), /invalid social sign-in settings/);
  }
});

test("disabled social sign-in rejects before loading native modules or making requests", async () => {
  const api = load("assets\\common\\authApi.js", {
    axios: {},
    "@react-native-async-storage/async-storage": {},
    expo: {},
    "expo-constants": {},
    "react-native": { Platform: { OS: "android" } },
    "./baseUrl": { __esModule: true, default: "https://api.example/api/v1/" },
    "./databaseConfig": {},
    "./authFlow": flow,
    "./authFeatures": { getSocialLoginSetting: async () => ({ enabled: false }) },
  });
  for (const provider of ["google", "apple", "facebook"]) {
    await assert.rejects(api.socialSignIn(provider), /not available.*email sign-in/);
  }
});

test("login renders all social providers only when enabled and always keeps email and legal links", () => {
    for (const enabled of [true, false]) {
      const react = {
        createElement: (type, props, ...children) => ({ type, props, children }),
        useContext: () => ({ loading: false }),
        useEffect: () => {},
        useState: (value) => [value, () => {}],
      };
      const { default: Login } = load("Screens\\User\\Login.js", {
        react,
        "react-native": { View: "View", Text: "Text", TextInput: "TextInput", Linking: {} },
        "../../Context/store/Auth": { AuthContext: {} },
        "../../Shared/AuthUI": {
          AuthPage: "AuthPage", AuthBrand: "AuthBrand", AuthButton: "AuthButton",
          BackButton: "BackButton", VerificationCode: "VerificationCode", authStyles: {},
        },
        "../../assets/common/authFlow": flow,
        "../../assets/common/legalLinks": {},
        "../../assets/common/useSocialSignInAvailability": { useSocialSignInAvailability: () => ({ enabled, error: "" }) },
      });
      const tree = JSON.stringify(Login({ navigation: {} }));
      for (const provider of ["Google", "Apple", "Facebook"]) {
        assert.equal(tree.includes(`Continue with ${provider}`), enabled);
      }
      assert.equal(tree.includes('"or"'), enabled);
      for (const label of ["Continue with Email", "Privacy Policy", "Terms of Service", "Continue as Guest"]) {
        assert.ok(tree.includes(label), label);
      }
    }
  });

test("signup does not expose or submit driver registration fields", () => {
    const source = fs.readFileSync(path.join(root, "Screens", "User", "Register.js"), "utf8");
    babel.parseSync(source, { configFile: false, babelrc: false, parserOpts: { plugins: ["jsx"] } });
    for (const removed of ["Register as Driver", "becomeDriver", "isDriver", "is_driver", "driverRole", "<Switch"]) {
      assert.ok(!source.includes(removed), removed);
    }
    assert.ok(source.includes('users/register'));
    assert.ok(source.includes("requireEmailVerification: true"));
  });

test("login availability refreshes on focus, every 30 seconds and foreground, fails closed, and cleans up", async () => {
  const state = [];
  let focus, tick, onAppState, intervalMs, cleared, removed = false;
  let setting = { enabled: true };
  let failure;
  const { useSocialSignInAvailability } = load("assets\\common\\useSocialSignInAvailability.js", {
    react: {
      useCallback: (fn) => fn,
      useState: (initial) => {
        const index = state.length;
        state.push(initial);
        return [initial, (value) => { state[index] = value; }];
      },
    },
    "react-native": { AppState: {
      addEventListener: (_event, callback) => {
        onAppState = callback;
        return { remove: () => { removed = true; } };
      },
    } },
    "@react-navigation/native": { useFocusEffect: (callback) => { focus = callback; } },
    "./authFeatures": { getSocialLoginSetting: async () => {
      if (failure) throw failure;
      return setting;
    } },
  }, {
    setInterval: (callback, ms) => { tick = callback; intervalMs = ms; return "timer"; },
    clearInterval: (id) => { cleared = id; },
  });
  useSocialSignInAvailability();
  assert.equal(state[0], false);
  const cleanup = focus();
  await new Promise(setImmediate);
  assert.equal(state[0], true);
  assert.equal(intervalMs, 30000);
  setting = { enabled: false };
  await tick();
  assert.equal(state[0], false);
  setting = { enabled: true };
  onAppState("active");
  await new Promise(setImmediate);
  assert.equal(state[0], true);
  failure = new Error("Settings service unavailable");
  await tick();
  assert.equal(state[0], false);
  assert.equal(state[1], "Settings service unavailable");
  failure = null;
  const pending = tick();
  cleanup();
  await pending;
  assert.equal(state[0], false, "Late requests cannot update an unfocused screen");
  assert.equal(cleared, "timer");
  assert.equal(removed, true);
});

test("mobile admin switch saves confirmed status and surfaces failures with a refresh action", async () => {
  const state = [];
  let index = 0, focus, fail = false;
  const writes = [];
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useCallback: (fn) => fn,
    useState: (initial) => {
      const slot = index++;
      if (state.length <= slot) state.push(initial);
      return [state[slot], (value) => { state[slot] = value; }];
    },
  };
  const { default: Settings } = load("Screens\\Admin\\SocialLoginSettings.js", {
    react,
    "react-native": { ActivityIndicator: "ActivityIndicator", Switch: "Switch", View: "View" },
    "react-native-paper": { Card: Object.assign(() => {}, { Content: "Content" }), Text: "Text", Button: "Button" },
    "@react-navigation/native": { useFocusEffect: (callback) => { focus = callback; } },
    "../../assets/common/authFeatures": {
      getSocialLoginSetting: async () => ({ success: true, enabled: false }),
      updateSocialLoginSetting: async (enabled) => {
        writes.push(enabled);
        if (fail) throw new Error("Admin access required");
        return { success: true, enabled };
      },
    },
  });
  const render = () => { index = 0; return Settings(); };
  const find = (node, type) => {
    if (!node || typeof node !== "object") return;
    if (node.type === type) return node;
    return node.children?.flat(Infinity).map((child) => find(child, type)).find(Boolean);
  };
  render();
  const cleanup = focus();
  await new Promise(setImmediate);
  let toggle = find(render(), "Switch");
  assert.equal(toggle.props.value, false);
  assert.equal(toggle.props.disabled, false);
  await toggle.props.onValueChange(true);
  toggle = find(render(), "Switch");
  assert.equal(toggle.props.value, true);
  fail = true;
  await toggle.props.onValueChange(false);
  const failed = render();
  assert.equal(find(failed, "Switch").props.disabled, true);
  assert.ok(JSON.stringify(failed).includes("Admin access required"));
  await find(failed, "Button").props.onPress();
  assert.equal(find(render(), "Switch").props.disabled, false);
  assert.deepEqual(writes, [true, false]);
  cleanup();
});
