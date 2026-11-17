const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load() {
  const filename = path.join(__dirname, "..", "assets", "common", "internationalHub.js");
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false, plugins: ["@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => assert.fail(`Unexpected dependency: ${name}`) });
  return exports;
}

const hub = load();

test("charges payload skips blank rows, totals in cents and keeps the note", () => {
  const { body, total } = hub.chargesPayload([
    { type: "customs_duty", amount: "10.10", label: "" },
    { type: "tariff", amount: " 0.20 ", label: "" },
    { type: "tax", amount: "", label: "" },
    { type: "other", amount: "5", label: " Port fee " },
  ], " Paid at Bole ");
  assert.equal(total, 15.3);
  assert.deepEqual(JSON.parse(JSON.stringify(body)), {
    charges: [
      { type: "customs_duty", amount: "10.10" },
      { type: "tariff", amount: "0.20" },
      { type: "other", amount: "5", label: "Port fee" },
    ],
    note: "Paid at Bole",
  });
  assert.equal(hub.chargesPayload([{ type: "tax", amount: "" }]).total, 0);
});

test("charges payload rejects invalid amounts and unlabeled other costs", () => {
  for (const amount of ["-1", "1.234", "abc"]) {
    assert.throws(() => hub.chargesPayload([{ type: "tax", amount }]), /non-negative number/);
  }
  assert.throws(() => hub.chargesPayload([{ type: "other", amount: "3", label: " " }]), /other related cost/);
  assert.throws(() => hub.chargesPayload([{ type: "other", amount: "", label: "Storage" }]), /non-negative number/);
});

test("payment methods follow the shipment currency and lock to the started method", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(hub.chargeMethods("USD").map((entry) => entry.value))), ["card", "bank"]);
  assert.deepEqual(JSON.parse(JSON.stringify(hub.chargeMethods("etb").map((entry) => entry.value))), ["telebirr", "bank"]);
  assert.deepEqual({ ...hub.chargePaymentState({ status: "awaiting_payment" }) }, { payable: true, started: null });
  assert.deepEqual({ ...hub.chargePaymentState({ status: "awaiting_payment", method: "telebirr" }) }, { payable: true, started: "telebirr" });
  for (const status of ["bank_review", "paid", "waived"]) assert.equal(hub.chargePaymentState({ status }).payable, false);
  assert.equal(hub.chargePaymentState(null).payable, false);
});
