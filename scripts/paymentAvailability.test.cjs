const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

const filename = path.join(__dirname, "..", "assets", "common", "paymentAvailability.js");
const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
  filename, configFile: false, babelrc: false,
  plugins: ["@babel/plugin-transform-modules-commonjs"],
});
const exportsObject = {};
vm.runInNewContext(code, { exports: exportsObject });
const { isCashOnDeliveryAvailable, isCashOnDeliveryMethod } = exportsObject;

test("USA cash checkout is enabled only for development, never release or unspecified flags", () => {
  for (const database of ["E_ShopUSA", "E_ShoppingUSA"]) {
    assert.equal(isCashOnDeliveryAvailable(database, true), true);
    for (const flag of [false, undefined, null, "true"]) {
      assert.equal(isCashOnDeliveryAvailable(database, flag), false);
    }
  }
});

test("Ethiopia cash checkout is unchanged for development and release", () => {
  for (const database of ["E_Shopping", "E_Shopping_2"]) {
    assert.equal(isCashOnDeliveryAvailable(database, true), true);
    assert.equal(isCashOnDeliveryAvailable(database, false), true);
  }
});

test("confirmation recognizes existing cash method representations but not other payments", () => {
  for (const method of [1, "1", "Cash on delivery", " CASH ON DELIVERY "]) {
    assert.equal(isCashOnDeliveryMethod(method), true);
  }
  for (const method of [2, 3, 4, "Card Payment", "Bank Transfer", undefined, null]) {
    assert.equal(isCashOnDeliveryMethod(method), false);
  }
});
