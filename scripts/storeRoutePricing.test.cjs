const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

const filename = path.join(__dirname, "..", "assets", "common", "deliveryPricing.js");
const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
  filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
});
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject });
const { calculateDeliveryPricing, selectDeliveryVehicle } = exportsObject;

test("per-store fee previews count each store once across drop-offs and change only that store's vehicle", () => {
  const deliveries = ["a", "b", "c"].map((key, index) => ({
    key, store: { _id: index < 2 ? "store1" : "store2", name: "Store" }, distanceKm: 5, vehicle: "car",
    pricingGroup: { kind: "store-route", key: index < 2 ? "store-route:1" : "store-route:2" },
    vehicleOptions: [{ type: "car", fee: 10.01 }, { type: "van", fee: 20.03 }],
  }));
  const initial = calculateDeliveryPricing(deliveries);
  assert.equal(initial.deliveryFee, 20.02);
  assert.deepEqual(Object.values(initial.byKey).map((entry) => entry.deliveryFee), [5.01, 5, 10.01]);
  assert.ok(Object.values(initial.byKey).every((entry) => entry.storeCount === 1));
  const selected = selectDeliveryVehicle(deliveries, {}, deliveries[0], "van");
  assert.deepEqual(Object.entries(selected), [["a", "van"], ["b", "van"]]);
  assert.equal(calculateDeliveryPricing(deliveries, selected).deliveryFee, 30.04);
  assert.throws(() => calculateDeliveryPricing(deliveries, { a: "van" }), /one vehicle/);
});
