const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function loadStores(stores) {
  const filename = path.join(__dirname, "..", "assets", "common", "stores.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  const dependencies = {
    "@react-native-async-storage/async-storage": { setItem: async () => {} },
    axios: { get: async () => ({ data: stores }) },
    "./baseUrl": "https://example.invalid/api/",
  };
  vm.runInNewContext(code, {
    exports, require: (name) => {
      if (!(name in dependencies)) throw new Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    }, console,
  }, { filename });
  return exports;
}

test("store normalization reads GeoJSON and preserves missing coordinates instead of mapping them to zero", () => {
  const { normalizeStore } = loadStores([]);
  const normalized = normalizeStore({ _id: "company", isCompanyOwned: true, location: { coordinates: [38, 9] } });
  assert.equal(normalized.longitude, 38);
  assert.equal(normalized.latitude, 9);
  assert.equal(normalized.isCompanyOwned, true);
  assert.equal(normalizeStore({ _id: "missing", longitude: null, latitude: null }).latitude, null);
  assert.equal(normalizeStore({ _id: "closed", isOpen: false }).isActive, false);
});

test("nearby partners take priority over closer company stores", async () => {
  const { findNearestStore } = loadStores([
    { _id: "partner", location: { coordinates: [0.01, 0] } },
    { _id: "company", isCompanyOwned: true, location: { coordinates: [0, 0] } },
  ]);
  assert.equal((await findNearestStore({ latitude: 0, longitude: 0 }))._id, "partner");
});

test("nearest company outside the radius wins over distant partners, excluding closed stores", async () => {
  const { findNearestStore } = loadStores([
    { _id: "partner", location: { coordinates: [0.1, 0] } },
    { _id: "far", isCompanyOwned: true, location: { coordinates: [2, 0] } },
    { _id: "nearer", isCompanyOwned: true, location: { coordinates: [1, 0] } },
    { _id: "closed", isCompanyOwned: true, isOpen: false, location: { coordinates: [0, 0] } },
  ]);
  assert.equal((await findNearestStore({ latitude: 0, longitude: 0 }))._id, "nearer");
});

test("the sole available company store is the fallback without coordinates", async () => {
  const { findNearestStore } = loadStores([{ _id: "sole", isCompanyOwned: true }]);
  assert.equal((await findNearestStore({ latitude: 0, longitude: 0 }))._id, "sole");
});

test("an out-of-radius partner alone does not produce a false assignment", async () => {
  const { findNearestStore } = loadStores([{ _id: "partner", location: { coordinates: [1, 0] } }]);
  assert.equal(await findNearestStore({ latitude: 0, longitude: 0 }), null);
});

test("multiple company stores still have an available default when coordinates cannot be ranked", async () => {
  const { findNearestStore } = loadStores([
    { _id: "b", isCompanyOwned: true },
    { _id: "a", isCompanyOwned: true },
    { _id: "pending", isCompanyOwned: true, approvalStatus: "pending" },
  ]);
  assert.equal((await findNearestStore({ latitude: 0, longitude: 0 }))._id, "a");
  assert.equal((await findNearestStore(null))._id, "a");
});
