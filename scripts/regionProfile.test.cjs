const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function extract(relativePath, name, context) {
  const filename = path.join(__dirname, "..", relativePath);
  const ast = babel.parseSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, parserOpts: { plugins: ["jsx"] },
  });
  let declaration;
  const visit = (node) => {
    if (!node || typeof node !== "object") return;
    if (node.type === "VariableDeclaration" && node.declarations.some((entry) => entry.id.name === name)) {
      declaration = node;
      return;
    }
    Object.values(node).forEach((value) => {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    });
  };
  visit(ast);
  assert.ok(declaration, `Missing ${name}`);
  ast.program.body = [declaration];
  const { code } = babel.transformFromAstSync(ast, null, { configFile: false, babelrc: false });
  vm.runInNewContext(`${code}\nresult = ${name};`, context);
  return context.result;
}

test("refreshProfile fetches region-specific roles and replaces stale permissions", async () => {
  const actions = [];
  const profile = { _id: "user", isDriver: true, isCompanyOwnedDriver: true,
    isStoreOwner: true, isCompanyOwnedStore: true };
  const refreshProfile = extract("Context\\store\\Auth.js", "refreshProfile", {
    useCallback: (fn) => fn, dispatch: (action) => actions.push(action),
    AsyncStorage: { getItem: async () => "session" }, baseUrl: "https://example.invalid/",
    extractUserProfile: (data) => data.user,
    axios: { get: async (url, config) => {
      assert.equal(url, "https://example.invalid/users/profile");
      assert.equal(config.timeout, 15000);
      assert.equal(config.headers.Authorization, "Bearer session");
      return { data: { user: profile } };
    } },
  });
  await refreshProfile();
  assert.equal(actions.at(-1).type, "LOGIN_SUCCESS");
  assert.equal(actions.at(-1).payload, profile);
});

test("failed role refresh clears stale profile and propagates failure", async () => {
  const actions = [];
  const refreshProfile = extract("Context\\store\\Auth.js", "refreshProfile", {
    useCallback: (fn) => fn, dispatch: (action) => actions.push(action),
    AsyncStorage: { getItem: async () => "session" }, baseUrl: "",
    axios: { get: async () => { throw new Error("Profile unavailable"); } },
  });
  await assert.rejects(refreshProfile(), /Profile unavailable/);
  assert.equal(actions.at(-1).type, "LOGOUT");
});

test("country switch signs out before saving the new region and remounting navigation in both directions", async () => {
  for (const [selectedCountry, target, db] of [
    ["USA", "Ethio", "E_Shopping"], ["Ethio", "USA", "E_ShopUSA"],
  ]) {
    const events = [], alerts = [];
    const select = extract("Shared\\Header.js", "handleCountrySelect", {
      selectedCountry, setIsDropdownVisible: () => {}, setSelectedCountry: (value) => events.push(value),
      regionSwitchGuard: { current: false }, setSwitchingRegion: () => {},
      COUNTRY_DB_MAP: { Ethio: "E_Shopping", USA: "E_ShopUSA" },
      setDatabaseNameInStorage: async (value) => events.push(value),
      context: { logout: async () => events.push("logout"), refreshProfile: () => assert.fail("Old session must not be refreshed in the new region") },
      onDatabaseChanged: () => events.push("navigation"),
      Alert: { alert: (...args) => alerts.push(args) },
    });
    await select({ value: target });
    assert.deepEqual(events, ["logout", db, target, "navigation"]);
    assert.equal(alerts[0][0], "Region changed");
    assert.match(alerts[0][1], /Sign in to your account for this region/);
  }
});

test("region switch stops before persistence or remount when logout fails", async () => {
  const alerts = [], guard = { current: false };
  const select = extract("Shared\\Header.js", "handleCountrySelect", {
    selectedCountry: "Ethio", setIsDropdownVisible: () => {},
    regionSwitchGuard: guard, setSwitchingRegion: () => {},
    COUNTRY_DB_MAP: { USA: "E_ShopUSA" },
    setDatabaseNameInStorage: () => assert.fail("Region must not change while logout failed"),
    context: { logout: async () => { throw new Error("Unable to clear session"); } },
    onDatabaseChanged: () => assert.fail("Navigation must not remount"),
    Alert: { alert: (...args) => alerts.push(args) },
  });
  await select({ value: "USA" });
  assert.deepEqual(alerts, [["Region switch failed", "Unable to clear session"]]);
  assert.equal(guard.current, false);
});

test("region-switch persistence failure keeps the current region and allows retry", async () => {
  const alerts = [], guard = { current: false };
  const select = extract("Shared\\Header.js", "handleCountrySelect", {
    selectedCountry: "Ethio", setIsDropdownVisible: () => {},
    regionSwitchGuard: guard, setSwitchingRegion: () => {},
    COUNTRY_DB_MAP: { USA: "E_ShopUSA" },
    context: { logout: async () => {} },
    setDatabaseNameInStorage: async () => { throw new Error("Storage unavailable"); },
    setSelectedCountry: () => assert.fail("Selection must not change without persistence"),
    onDatabaseChanged: () => assert.fail("Navigation must not remount"),
    Alert: { alert: (...args) => alerts.push(args) },
  });
  await select({ value: "USA" });
  assert.deepEqual(alerts, [["Region switch failed", "Storage unavailable"]]);
  assert.equal(guard.current, false);
});

test("region switch ignores the current selection and concurrent taps", async () => {
  let release;
  const events = [];
  const guard = { current: false };
  const select = extract("Shared\\Header.js", "handleCountrySelect", {
    selectedCountry: "Ethio", setIsDropdownVisible: () => {},
    regionSwitchGuard: guard, setSwitchingRegion: () => {}, setSelectedCountry: () => {},
    COUNTRY_DB_MAP: { Ethio: "E_Shopping", USA: "E_ShopUSA" },
    context: { logout: () => { events.push("logout"); return new Promise((resolve) => { release = resolve; }); } },
    setDatabaseNameInStorage: async (value) => events.push(value),
    onDatabaseChanged: () => events.push("navigation"),
    Alert: { alert: () => {} },
  });
  await select({ value: "Ethio" });
  assert.equal(events.length, 0);
  const pending = select({ value: "USA" });
  await select({ value: "USA" });
  assert.deepEqual(events, ["logout"]);
  release();
  await pending;
  assert.deepEqual(events, ["logout", "E_ShopUSA", "navigation"]);
});

test("logout clears the persisted session before publishing signed-out state", async () => {
  const events = [];
  const logout = extract("Context\\store\\Auth.js", "logout", {
    useCallback: (fn) => fn,
    AsyncStorage: { removeItem: async (key) => events.push(key) },
    dispatch: (action) => events.push(action.type),
  });
  await logout();
  assert.deepEqual(events, ["token", "lastActivityTime", "LOGOUT"]);
});

test("saving a region propagates storage failures rather than reporting a successful switch", async () => {
  const save = extract("assets\\common\\databaseConfig.js", "setDatabaseNameInStorage", {
    sanitizeDatabaseName: (name) => name, DB_STORAGE_KEY: "selectedDatabaseName",
    AsyncStorage: { setItem: async () => { throw new Error("Storage unavailable"); } },
  });
  await assert.rejects(save("E_ShopUSA"), /Storage unavailable/);
});

test("combined company-driver/store account qualifies for both dashboard tabs", () => {
  const profile = { isDriver: true, isCompanyOwnedDriver: true,
    isStoreOwner: true, isCompanyOwnedStore: true, isAdmin: false, role: "driver" };
  for (const name of ["isCompanyDriverUser", "isCompanyStoreUser"]) {
    const guard = extract("Context\\store\\Auth.js", name, { extractUserProfile: (value) => value });
    assert.equal(guard(profile), true);
  }
});

test("editing the account refreshes computed company flags instead of replacing them with raw user data", () => {
  const source = fs.readFileSync(path.join(__dirname, "..", "Screens", "User", "EditProfile.js"), "utf8");
  assert.match(source, /await context\.refreshProfile\(\)/);
  assert.doesNotMatch(source, /context\.fetchUser\(/);
});
