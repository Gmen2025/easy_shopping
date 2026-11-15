const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function loadSearch() {
  const filename = path.join(__dirname, "..", "assets", "common", "rides.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const calls = [];
  const exports = {};
  vm.runInNewContext(code, {
    exports, require: (name) => {
      assert.equal(name, "./storefront");
      return { apiRequest: (resource, requestPath) => { calls.push({ resource, requestPath }); return []; } };
    },
  });
  return { ...exports, calls };
}

test("delivery suggestions and details use the same recipient country independently of the store", () => {
  const helper = loadSearch();
  for (const [country, region] of [["Ethiopia", "ET"], ["USA", "US"], ["United States", "US"], ["et", "ET"]]) {
    helper.searchPlaces("Bole & Mall", "session-123", country);
    helper.placeAddress("ChIJexample", "session-123", country);
    for (const call of helper.calls.slice(-2)) {
      const url = new URL(call.requestPath, "https://example.test/");
      assert.equal(call.resource, "rides");
      assert.equal(url.searchParams.get("region"), region);
      assert.equal(url.searchParams.get("session"), "session-123");
    }
    assert.equal(new URL(helper.calls.at(-2).requestPath, "https://example.test/").searchParams.get("input"), "Bole & Mall");
  }
});

test("ride searches preserve the database default and unsupported recipient countries surface errors", () => {
  const helper = loadSearch();
  helper.searchPlaces("Bole", "session-123");
  helper.placeAddress("ChIJexample", "session-123");
  assert.ok(helper.calls.every((call) => !call.requestPath.includes("region=")));
  assert.throws(() => helper.searchPlaces("Nairobi", "session-123", "Kenya"), /Ethiopia and USA only/);
  assert.equal(helper.calls.length, 2);
});
