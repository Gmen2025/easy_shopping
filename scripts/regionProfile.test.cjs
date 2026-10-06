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

test("country switch refreshes profile before remounting navigation in both directions", async () => {
  for (const [selectedCountry, target, db] of [
    ["USA", "Ethio", "E_Shopping"], ["Ethio", "USA", "E_ShopUSA"],
  ]) {
    const events = [];
    const select = extract("Shared\\Header.js", "handleCountrySelect", {
      selectedCountry, setIsDropdownVisible: () => {}, setSelectedCountry: (value) => events.push(value),
      COUNTRY_DB_MAP: { Ethio: "E_Shopping", USA: "E_ShopUSA" },
      DB_COUNTRY_MAP: { E_Shopping: "Ethio", E_ShopUSA: "USA" },
      setDatabaseNameInStorage: async (value) => events.push(value),
      AsyncStorage: { getItem: async () => "session" }, baseUrl: "",
      axios: { post: async () => ({ data: { database: db } }) },
      context: { refreshProfile: async () => events.push("profile") },
      onDatabaseChanged: () => events.push("navigation"),
      Alert: { alert: () => assert.fail("Unexpected switch failure") },
    });
    await select({ value: target });
    assert.equal(events.at(-2), "profile");
    assert.equal(events.at(-1), "navigation");
    assert.ok(events.indexOf(db) < events.indexOf("profile"));
  }
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
