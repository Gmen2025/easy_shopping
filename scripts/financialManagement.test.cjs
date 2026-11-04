const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const babel = require("@babel/core");

function load(relative, dependencies = {}) {
  const filename = path.join(__dirname, "..", relative);
  const { code } = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename, configFile: false, babelrc: false,
    plugins: ["@babel/plugin-transform-react-jsx", "@babel/plugin-transform-modules-commonjs"],
  });
  const exports = {};
  vm.runInNewContext(code, {
    exports, console, require: (name) => {
      assert.ok(name in dependencies, `Unexpected dependency: ${name}`);
      return dependencies[name];
    },
  });
  return exports;
}
const helper = (request = async () => ({})) =>
  load("assets\\common\\financialManagement.js", { "./finance": { operatorRequest: request } });

test("manual accounting uses the existing authenticated region-scoped transport, isolated from payout APIs", async () => {
  let call;
  const api = helper(async (...args) => { call = args; return { _id: "posted" }; });
  const result = await api.financialRequest("transactions", { method: "post", data: { amount: "12.34", requestKey: "retry-key" } });
  assert.equal(call[0], "financial-management/transactions");
  assert.equal(call[1].method, "post");
  assert.equal(call[1].data.amount, "12.34");
  assert.equal(result._id, "posted");
  await assert.rejects(helper(async () => { throw new Error("Not permitted"); }).financialRequest("workspace"), /Not permitted/);
});

test("accounting values never round away fractional cents or overflow safe minor units", () => {
  const api = helper();
  for (const value of ["", " ", "12.345", "1e2", "NaN", "Infinity", "-1", "1,000", "90071992547409.92"]) {
    assert.throws(() => api.financialAmount(value));
  }
  assert.throws(() => api.financialAmount("0"));
  assert.equal(api.financialAmount("0.00", { allowZero: true }), "0.00");
  assert.equal(api.financialMinor("0.10"), 10);
  assert.equal(api.financialMinor("90071992547409.91"), Number.MAX_SAFE_INTEGER);
  assert.equal(api.financialMajor(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.equal(api.financialMajor(-123), "-1.23");
  assert.equal(api.financialMoney(12345, "USD"), "USD 123.45");
  assert.equal(api.financialMoney(-10, "ETB"), "-ETB 0.10");
  assert.throws(() => api.financialMoney(1.2, "USD"));
  assert.throws(() => api.financialMoney(123, "EUR"));
});

test("custom reporting dates are actual inclusive calendar dates, never normalized invalid dates", () => {
  const api = helper();
  for (const value of ["2026-02-29", "2026-11-31", "2026-1-01", "bad", "2026-11-04T00:00:00Z"]) {
    assert.throws(() => api.financialDate(value));
  }
  assert.equal(api.financialDate("2028-02-29"), "2028-02-29");
  assert.equal(api.financialDate("", true), undefined);
  assert.throws(() => api.financialQuery({ currency: "USD", period: "custom", from: "2026-11-05", to: "2026-11-04" }));
  const query = api.financialQuery({ entityId: "entity", currency: "USD", period: "custom", from: "2026-11-01", to: "2026-11-04" });
  assert.match(query, /entityId=entity/);
  assert.match(query, /from=2026-11-01/);
  assert.match(query, /to=2026-11-04/);
  assert.throws(() => api.financialQuery({ currency: "USD", period: "unknown" }));
});

function hooks() {
  const values = [], deps = [], cleanups = [], effects = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
      return [values[index], (next) => { values[index] = typeof next === "function" ? next(values[index]) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in values)) values[index] = { current: initial };
      return values[index];
    },
    useCallback(fn, next = []) {
      const index = cursor++;
      if (!deps[index] || next.some((value, at) => !Object.is(value, deps[index][at]))) {
        deps[index] = next; values[index] = fn;
      }
      return values[index];
    },
    useMemo(fn) { return fn(); },
    useEffect(effect, next = []) {
      const index = cursor++;
      if (!deps[index] || next.some((value, at) => !Object.is(value, deps[index][at]))) {
        deps[index] = next; effects.push(() => { cleanups[index]?.(); cleanups[index] = effect(); });
      }
    },
  };
  return { react, render(Component, props = {}) {
    cursor = 0;
    const tree = Component(props);
    effects.splice(0).forEach((effect) => effect());
    return tree;
  } };
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (typeof tree === "string" || typeof tree === "number") return String(tree);
  if (Array.isArray(tree)) return tree.map(text).join("");
  return text(tree?.props?.children || []);
}
const native = new Proxy({ StyleSheet: { create: (styles) => styles } }, { get: (target, key) => target[key] || key });
const tick = () => new Promise(setImmediate);

test("accounting form blocks incomplete records and reuses an idempotency key after uncertain failures", async () => {
  const h = hooks(), requests = [], canceled = [];
  let keys = 0;
  const Form = load("Shared\\FinancialForm.js", {
    react: h.react, "react-native": native, "@react-native-picker/picker": { Picker: "Picker" },
    "expo-crypto": { randomUUID: () => `request-${++keys}` },
    "../assets/common/finance": { financeError: (error) => error.message },
  }).default;
  const props = { title: "Record expense", fields: [{ name: "amount", label: "Amount", required: true }],
    initialValues: { amount: "" }, onCancel: () => canceled.push(true), onSubmit: async (values, key) => {
      requests.push({ ...values, key }); throw new Error("Connection interrupted");
    } };
  const render = () => h.render(Form, props);
  let tree = render();
  const submit = (value) => nodes(value).find((node) => node.props?.label === "Save record");
  await submit(tree).props.onPress();
  assert.equal(requests.length, 0);
  assert.match(text(render()), /Amount is required/);
  nodes(render()).find((node) => node.type === "TextInput").props.onChangeText("12.34");
  await submit(render()).props.onPress();
  await submit(render()).props.onPress();
  assert.equal(requests[0].key, requests[1].key);
  assert.match(text(render()), /Connection interrupted/);
  nodes(render()).find((node) => node.type === "TextInput").props.onChangeText("13.00");
  await submit(render()).props.onPress();
  assert.notEqual(requests[1].key, requests[2].key);
});

const personal = { _id: "personal", ownerType: "PERSONAL", name: "Personal" };
const business = { _id: "business", ownerType: "BUSINESS", name: "Shop" };
function workspace(entity = personal) {
  const totals = Object.fromEntries(["incomeMinor", "expenseMinor", "netIncomeMinor", "cashInMinor", "cashOutMinor",
    "cashFlowMinor", "cashMinor", "savingsMinor", "receivablesMinor", "debtMinor", "assetsMinor", "liabilitiesMinor",
    "netWorthMinor"].map((key) => [key, 0]));
  return {
    entity, entities: [personal, business], accounts: [
      { _id: "cash", entityId: entity._id, name: "Cash", type: "ASSET", subtype: "CASH", currency: "ETB", balanceMinor: 10000 },
      { _id: "card", entityId: entity._id, name: "Credit card", type: "LIABILITY", subtype: "CREDIT_CARD", currency: "ETB", balanceMinor: 25000 },
    ],
    categories: [{ _id: "clothes", entityId: entity._id, name: "Clothes", type: "EXPENSE", parentId: null }],
    goals: [], transactions: [{ _id: "invoice", type: "EXPENSE", date: "2026-11-04", description: "Purchase",
      amountMinor: 25000, paidMinor: 5000, outstandingMinor: 20000, status: "PARTIALLY_PAID" }],
    audit: [], settings: { lockedThrough: null }, report: {
      currency: "ETB",
      totals,
      series: { monthlyIncomeExpense: [], spending: [], category: [], savings: [], debt: [], cashflow: [] },
      balanceSheet: { assetsMinor: 0, liabilitiesMinor: 0, equityMinor: 0, netWorthMinor: 0, balanced: true, accounts: [] },
      incomeStatement: { incomeMinor: 0, expenseMinor: 0, netIncomeMinor: 0 },
      trialBalance: { accounts: [], debitMinor: 0, creditMinor: 0, balanced: true },
      journal: [], journalPagination: { page: 1, pages: 0 },
    },
    constants: { paymentMethods: ["CASH", "DEBIT_CARD", "CREDIT_CARD", "BANK_TRANSFER", "MOBILE_MONEY", "BUY_NOW_PAY_LATER", "PERSONAL_LOAN", "CARD", "CHECK", "OTHER"],
      accountSubtypes: { ASSET: ["CASH"], LIABILITY: ["CREDIT_CARD"] },
      transferKinds: ["ACCOUNT", "SALARY", "OWNER_DRAW", "BUSINESS_PERSONAL_EXPENSE", "PERSONAL_BUSINESS_EXPENSE"] },
    pagination: { transactions: { hasMore: false }, audit: { hasMore: false } },
  };
}
function screen({ admin = true, request = async () => workspace() } = {}) {
  const h = hooks(), calls = [];
  h.react.useContext = () => ({ user: { isAdmin: admin } });
  const Component = load("Screens\\Finance\\FinancialManagement.js", {
    react: h.react, "react-native": native,
    "@react-navigation/native": { useFocusEffect: (effect) => h.react.useEffect(effect, [effect]) },
    "../../Context/store/Auth": { AuthContext: {} },
    "../../Shared/FinancialForm": { __esModule: true, default: "FinancialForm",
      FinancialButton: "FinancialButton", FinancialCard: "FinancialCard", FinancialSelect: "FinancialSelect" },
    "../../Shared/FinancialReports": { FinancialChart: "FinancialChart", FinancialMetrics: "FinancialMetrics", FinancialStatement: "FinancialStatement" },
    "../../Shared/FinancialTransfer": "FinancialTransfer",
    "../../assets/common/finance": { financeError: (error) => error.message },
    "../../assets/common/financialManagement": {
      ...helper(), financialRequest: async (...args) => { calls.push(args); return request(...args); },
    },
  }).default;
  return { calls, render: () => h.render(Component), start: async function () {
    this.render(); await tick(); return this.render();
  } };
}
const labeled = (tree, label) => nodes(tree).find((node) => node.props?.label === label);

test("private tracker never requests data for non-admins", async () => {
  const ui = screen({ admin: false });
  assert.match(text(await ui.start()), /Admin access is required/);
  assert.equal(ui.calls.length, 0);
});

test("expense accrual sends selected entity, currency and payment exactly once without converting card repayment to an expense", async () => {
  const ui = screen();
  let tree = await ui.start();
  labeled(tree, "Expenses").props.onPress();
  tree = ui.render();
  labeled(tree, "Record expense").props.onPress();
  tree = ui.render();
  const form = nodes(tree).find((node) => node.type === "FinancialForm");
  assert.match(form.props.help, /later repay it using Transfers/);
  const methods = form.props.fields.find((field) => field.name === "paymentMethod");
  assert.ok(methods.options({ accountId: "card" }).some((option) => option.value === "CREDIT_CARD"));
  assert.equal(methods.options({ accountId: "card" }).some((option) => option.value === "CASH"), false);
  assert.ok(methods.options({ accountId: "cash" }).some((option) => option.value === "MOBILE_MONEY"));
  assert.equal(methods.options({ accountId: "cash" }).some((option) => option.value === "CREDIT_CARD"), false);
  assert.equal(form.props.fields.find((field) => field.name === "accountId").reset("card").paymentMethod, "CREDIT_CARD");
  const values = { amount: "250.00", paidAmount: "250", accountId: "card", categoryId: "clothes",
    paymentMethod: "CREDIT_CARD", date: "2026-11-04", dueDate: "2026-12-01", description: "Clothes" };
  await form.props.onSubmit(values, "stable-key");
  const save = ui.calls.find((call) => call[0] === "transactions");
  assert.equal(save[1].data.entityId, "personal");
  assert.equal(save[1].data.currency, "ETB");
  assert.equal(save[1].data.amount, "250.00");
  assert.equal(save[1].data.paidAmount, "250");
  assert.equal(save[1].data.accountId, "card");
  assert.equal(save[1].data.requestKey, "stable-key");
});

test("invoice settlement uses the payment endpoint instead of creating another expense", async () => {
  const ui = screen();
  labeled(await ui.start(), "Payments & receivables").props.onPress();
  labeled(ui.render(), "Record payment / receipt").props.onPress();
  const form = nodes(ui.render()).find((node) => node.type === "FinancialForm");
  assert.equal(form.props.fields.find((field) => field.name === "paymentMethod").options.some((option) =>
    ["CREDIT_CARD", "BUY_NOW_PAY_LATER", "PERSONAL_LOAN"].includes(option.value)), false);
  await form.props.onSubmit({ amount: "200.00", accountId: "cash", paymentMethod: "CASH", date: "2026-11-04" }, "payment-key");
  assert.ok(ui.calls.some((call) => call[0] === "transactions/invoice/payments"));
  assert.equal(ui.calls.some((call) => call[0] === "transactions"), false);
});

test("changing entity hides old data immediately and ignores a late previous-ledger response", async () => {
  const pending = [];
  const ui = screen({ request: (url) => new Promise((resolve) => pending.push({ url, resolve })) });
  ui.render();
  pending[0].resolve(workspace()); await tick();
  let tree = ui.render();
  labeled(tree, "Business / personal ledger").props.onChange("business");
  tree = ui.render();
  assert.equal(nodes(tree).some((node) => node.props?.label === "Record income"), false);
  assert.match(pending[1].url, /entityId=business/);
  pending[1].resolve(workspace(business)); await tick();
  tree = ui.render();
  assert.equal(labeled(tree, "Business / personal ledger").props.value, "business");
});

test("late responses cannot replace a newer ledger/currency after a switch", async () => {
  const pending = [];
  const ui = screen({ request: (url) => new Promise((resolve) => pending.push({ url, resolve })) });
  ui.render(); pending[0].resolve(workspace()); await tick();
  labeled(ui.render(), "Business / personal ledger").props.onChange("business");
  ui.render();
  labeled(ui.render(), "Report currency (never combined)").props.onChange("USD");
  ui.render();
  const latest = workspace(business);
  latest.report.currency = "USD";
  latest.report.totals.incomeMinor = 7700;
  latest.accounts.forEach((account) => { account.currency = "USD"; });
  pending[2].resolve(latest); await tick();
  const stale = workspace(business);
  stale.report.totals.incomeMinor = 9900;
  pending[1].resolve(stale); await tick();
  const tree = ui.render();
  const metrics = nodes(tree).find((node) => node.type === "FinancialMetrics");
  assert.equal(metrics.props.currency, "USD");
  assert.equal(metrics.props.rows[0].minor, 7700);
});

test("incomplete or unsafe financial statements are blocked instead of rendered as zeros", () => {
  const api = helper();
  const valid = workspace();
  assert.equal(api.validateFinancialWorkspace(valid), valid);
  for (const change of [
    { report: {} }, { accounts: null }, { constants: {} }, { pagination: {} },
    { report: { ...valid.report, totals: { ...valid.report.totals, cashMinor: "100" } } },
    { accounts: [{ ...valid.accounts[0], balanceMinor: Number.MAX_SAFE_INTEGER + 1 }] },
  ]) {
    assert.throws(() => api.validateFinancialWorkspace({ ...valid, ...change }));
  }
});

test("personal dashboard renders six server-backed financial graphs and per-currency balances", async () => {
  const data = workspace();
  data.report.totals.incomeMinor = 500000;
  data.report.totals.expenseMinor = 25000;
  data.report.totals.debtMinor = 25000;
  data.report.series.monthlyIncomeExpense.push({ date: "2026-11", incomeMinor: 500000, expenseMinor: 25000 });
  const ui = screen({ request: async () => data });
  const tree = await ui.start();
  const metrics = nodes(tree).find((node) => node.type === "FinancialMetrics");
  assert.equal(metrics.props.currency, "ETB");
  assert.equal(metrics.props.rows.find((row) => row.label === "Total accrued income").minor, 500000);
  const charts = nodes(tree).filter((node) => node.type === "FinancialChart");
  assert.equal(charts.length, 6);
  assert.equal(charts[0].props.rows[0].values[1].minor, 25000);
});

test("savings goals allocate backing savings and use the goal endpoint, not an expense", async () => {
  const data = workspace();
  data.accounts.push({ _id: "savings", entityId: personal._id, name: "Savings", type: "ASSET",
    subtype: "SAVINGS", currency: "ETB", balanceMinor: 100000 });
  const ui = screen({ request: async () => data });
  labeled(await ui.start(), "Savings & goals").props.onPress();
  labeled(ui.render(), "Create savings goal").props.onPress();
  const form = nodes(ui.render()).find((node) => node.type === "FinancialForm");
  await form.props.onSubmit({ name: "Emergency fund", accountId: "savings", targetAmount: "10000",
    savedAmount: "1000", targetDate: "2027-01-01" }, "goal-key");
  const save = ui.calls.find((call) => call[0] === "goals");
  assert.equal(save[1].data.entityId, personal._id);
  assert.equal(save[1].data.savedAmount, "1000");
  assert.equal(save[1].data.accountId, "savings");
  assert.equal(ui.calls.some((call) => call[0] === "transactions"), false);
});

test("period settings and reversals submit explicit dates/reasons without deleting history", async () => {
  const ui = screen();
  labeled(await ui.start(), "Categories, periods & audit").props.onPress();
  labeled(ui.render(), "Close or reopen accounting period").props.onPress();
  let form = nodes(ui.render()).find((node) => node.type === "FinancialForm");
  await form.props.onSubmit({ lockedThrough: "2026-10-31" }, "lock-key");
  assert.equal(ui.calls.find((call) => call[0] === "settings")[1].method, "put");
  assert.equal(ui.calls.find((call) => call[0] === "settings")[1].data.lockedThrough, "2026-10-31");
  labeled(ui.render(), "Expenses").props.onPress();
  labeled(ui.render(), "Reverse record").props.onPress();
  form = nodes(ui.render()).find((node) => node.type === "FinancialForm");
  await form.props.onSubmit({ date: "2026-11-05", reason: "Duplicate invoice correction" }, "reverse-key");
  const reversal = ui.calls.find((call) => call[0] === "transactions/invoice/reverse");
  assert.equal(reversal[1].method, "post");
  assert.equal(reversal[1].data.reason, "Duplicate invoice correction");
  assert.equal(ui.calls.some((call) => call[1]?.method === "delete"), false);
});

test("asset adjustments send signed deltas to an audited equity adjustment, not income", async () => {
  const ui = screen();
  labeled(await ui.start(), "Accounts, assets & debts").props.onPress();
  labeled(ui.render(), "Adjust valuation / reconcile balance").props.onPress();
  const form = nodes(ui.render()).find((node) => node.type === "FinancialForm");
  assert.match(form.props.help, /not an income\/expense/);
  await form.props.onSubmit({ amount: "-50.00", date: "2026-11-04", description: "Correct opening valuation" }, "adjust-key");
  assert.equal(ui.calls.find((call) => call[0] === "accounts/cash/adjustments")[1].data.amount, "-50.00");
  assert.equal(ui.calls.some((call) => call[0] === "transactions"), false);
});

test("linked transfer form uses each ledger's accounts and posts business-funded personal expense atomically", async () => {
  const h = hooks(), calls = [], saved = [];
  const source = workspace(business), target = workspace(personal);
  source.accounts = source.accounts.map((account) => ({ ...account, _id: `business-${account._id}` }));
  const Transfer = load("Shared\\FinancialTransfer.js", {
    react: h.react, "react-native": native,
    "./FinancialForm": { __esModule: true, default: "FinancialForm", FinancialButton: "FinancialButton", FinancialSelect: "FinancialSelect" },
    "../assets/common/finance": { financeError: (error) => error.message },
    "../assets/common/financialManagement": {
      ...helper(), financialRequest: async (...args) => {
        calls.push(args);
        if (args[0] === "transfers") return { transaction: { _id: "linked" } };
        return args[0].includes("entityId=business") ? source : target;
      },
    },
  }).default;
  const props = { workspace: target, currency: "ETB", onSaved: async () => saved.push(true) };
  const render = () => h.render(Transfer, props);
  render(); await tick();
  labeled(render(), "Transfer kind").props.onChange("BUSINESS_PERSONAL_EXPENSE");
  render(); await tick();
  let tree = render();
  const form = nodes(tree).find((node) => node.type === "FinancialForm");
  assert.ok(form.props.fields.find((field) => field.name === "fromAccountId").options.some((option) => option.value === "business-cash"));
  assert.equal(form.props.fields.some((field) => field.name === "toAccountId"), false);
  await form.props.onSubmit({ fromAccountId: "business-cash", amount: "300.00", date: "2026-11-04",
    categoryId: "clothes", description: "Personal clothes funded by business" }, "linked-key");
  const post = calls.find((call) => call[0] === "transfers");
  assert.equal(post[1].data.kind, "BUSINESS_PERSONAL_EXPENSE");
  assert.equal(post[1].data.fromEntityId, "business");
  assert.equal(post[1].data.toEntityId, "personal");
  assert.equal(post[1].data.categoryId, "clothes");
  assert.equal(post[1].data.toAccountId, undefined);
  assert.equal(post[1].data.requestKey, "linked-key");
  assert.equal(saved.length, 1);
});

test("personal-funded business purchases and optional salary categories use the correct ledger", async () => {
  const h = hooks(), calls = [];
  const source = workspace(business), target = workspace(personal);
  source.accounts = source.accounts.map((account) => ({ ...account, _id: `business-${account._id}` }));
  source.categories = [{ _id: "business-category", entityId: business._id, type: "EXPENSE", name: "Business expense" }];
  const Transfer = load("Shared\\FinancialTransfer.js", {
    react: h.react, "react-native": native,
    "./FinancialForm": { __esModule: true, default: "FinancialForm", FinancialButton: "FinancialButton", FinancialSelect: "FinancialSelect" },
    "../assets/common/finance": { financeError: (error) => error.message },
    "../assets/common/financialManagement": {
      ...helper(), financialRequest: async (...args) => {
        calls.push(args);
        if (args[0] === "transfers") return {};
        return args[0].includes("entityId=business") ? source : target;
      },
    },
  }).default;
  const props = { workspace: target, currency: "ETB", onSaved: async () => {} };
  const render = () => h.render(Transfer, props);
  render(); await tick();
  labeled(render(), "Transfer kind").props.onChange("PERSONAL_BUSINESS_EXPENSE");
  render(); await tick();
  let form = nodes(render()).find((node) => node.type === "FinancialForm");
  assert.ok(form.props.fields.find((field) => field.name === "categoryId").options.some((entry) => entry.value === "business-category"));
  await form.props.onSubmit({ fromAccountId: "cash", categoryId: "business-category", amount: "20", date: "2026-11-04",
    description: "Personally funded business supplies" }, "supplies-key");
  const post = calls.find((call) => call[0] === "transfers");
  assert.equal(post[1].data.fromEntityId, "personal");
  assert.equal(post[1].data.toEntityId, "business");
  assert.equal(post[1].data.toAccountId, undefined);
  labeled(render(), "Transfer kind").props.onChange("SALARY");
  render(); await tick();
  form = nodes(render()).find((node) => node.type === "FinancialForm");
  assert.equal(form.props.fields.find((field) => field.name === "categoryId").required, false);
  assert.ok(form.props.fields.some((field) => field.name === "toAccountId"));
  await form.props.onSubmit({ fromAccountId: "business-cash", toAccountId: "cash", categoryId: "", amount: "5000",
    date: "2026-11-04", description: "Salary" }, "salary-key");
  const salary = calls.filter((call) => call[0] === "transfers")[1];
  assert.equal(salary[1].data.categoryId, undefined);
  assert.equal(salary[1].data.kind, "SALARY");
});
