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

test("hub steps walk arrive, charges, customs, release and completion with waiting hints", () => {
  const byKey = (steps) => Object.fromEntries(steps.map((step) => [step.key, step]));
  const shipped = byKey(hub.hubSteps({ status: "shipped", destination: { stage: "in_transit" }, packages: [] }));
  assert.deepEqual([shipped.arrive.state, shipped.charges.state], ["current", "pending"]);
  assert.match(shipped.arrive.hint, /mark it arrived/);

  const legacy = byKey(hub.hubSteps({ status: "arrived_ethiopia", destination: null, packages: [] }));
  assert.equal(legacy.arrive.state, "current");
  assert.match(legacy.arrive.hint, /start hub processing/);

  const inCustoms = byKey(hub.hubSteps({ status: "arrived_ethiopia", destination: { stage: "in_customs" }, packages: [] }));
  assert.deepEqual([inCustoms.arrive.state, inCustoms.charges.state, inCustoms.clear.state], ["done", "current", "pending"]);

  const unpaid = byKey(hub.hubSteps({ status: "arrived_ethiopia",
    destination: { stage: "cleared", charges: { status: "awaiting_payment" } }, packages: [] }));
  assert.deepEqual([unpaid.charges.state, unpaid.clear.state, unpaid.ready.state], ["done", "done", "current"]);
  assert.match(unpaid.ready.hint, /customer to pay/);

  const dispatched = byKey(hub.hubSteps({ status: "arrived_ethiopia",
    destination: { stage: "dispatched", charges: { status: "paid" }, driver: { name: "Abebe" } }, packages: [] }));
  assert.deepEqual([dispatched.ready.state, dispatched.complete.state], ["done", "current"]);
  assert.match(dispatched.complete.hint, /driver to pick up/);

  const delivered = byKey(hub.hubSteps({ status: "delivered",
    destination: { stage: "delivered", charges: { status: "waived" } }, packages: [] }));
  assert.ok(Object.values(delivered).every((step) => step.state !== "current"));
  assert.equal(delivered.complete.state, "done");
});
