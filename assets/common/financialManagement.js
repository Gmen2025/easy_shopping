import { operatorRequest } from "./finance";

export const financialRequest = (path, options) =>
  operatorRequest(`financial-management/${path}`, options);

export const customerFinancialRequest = (path, options) =>
  operatorRequest(`financial-health/${path}`, options);

export function financialMoney(minor, currency) {
  if (!Number.isSafeInteger(minor) || !["ETB", "USD"].includes(currency)) {
    throw new Error("The server returned an invalid accounting amount or currency.");
  }
  const sign = minor < 0 ? "-" : "";
  const absolute = Math.abs(minor);
  return `${sign}${currency} ${Math.floor(absolute / 100).toLocaleString()}.${String(absolute % 100).padStart(2, "0")}`;
}

export function financialAmount(value, { allowZero = false, signed = false } = {}) {
  const text = String(value ?? "").trim();
  const pattern = signed ? /^-?\d+(\.\d{1,2})?$/ : /^\d+(\.\d{1,2})?$/;
  if (!pattern.test(text)) throw new Error("Enter an amount with at most two decimal places.");
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  const minor = Number(`${whole}${fraction.padEnd(2, "0")}`);
  if (!Number.isSafeInteger(minor) || (!allowZero && minor === 0)) {
    throw new Error("Enter a valid non-zero monetary amount.");
  }
  return text;
}

export function financialMinor(value) {
  const text = financialAmount(value, { allowZero: true, signed: true });
  const [whole, fraction = ""] = text.replace(/^-/, "").split(".");
  return Number(`${whole}${fraction.padEnd(2, "0")}`) * (text.startsWith("-") ? -1 : 1);
}

export function financialDate(value, optional = false) {
  if (optional && !value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T00:00:00Z`)) ||
      new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error("Enter a valid date in YYYY-MM-DD format.");
  }
  return value;
}

export const financialToday = () => {
  const today = new Date();
  return [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"),
    String(today.getDate()).padStart(2, "0")].join("-");
};

export function financialQuery({ entityId, currency, period, from, to, page = 1, auditPage = 1, journalPage = 1, combinedNetWorth = false }) {
  if (!["ETB", "USD"].includes(currency)) throw new Error("Choose ETB or USD.");
  if (!["daily", "weekly", "monthly", "yearly", "custom"].includes(period)) throw new Error("Choose a financial period.");
  const values = { currency, period, page, auditPage, journalPage };
  if (combinedNetWorth) values.combinedNetWorth = "true";
  if (entityId) values.entityId = entityId;
  if (period === "custom") {
    values.from = financialDate(from);
    values.to = financialDate(to);
    if (from > to) throw new Error("The start date must not be after the end date.");
  }
  return Object.entries(values).map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

export const financialId = (value) => String(value?._id || value || "");

export function financialMajor(minor) {
  if (!Number.isSafeInteger(minor)) throw new Error("Invalid accounting balance.");
  const absolute = Math.abs(minor);
  return `${minor < 0 ? "-" : ""}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

export function validateFinancialWorkspace(data) {
  if (!data?.entity?._id || !["PERSONAL", "BUSINESS"].includes(data.entity.ownerType) ||
      !Array.isArray(data.entities) || !Array.isArray(data.accounts) || !Array.isArray(data.categories) ||
      !Array.isArray(data.transactions) || !Array.isArray(data.goals) || !Array.isArray(data.audit) ||
      !data.settings || !Array.isArray(data.constants?.paymentMethods) ||
      !Array.isArray(data.constants.transferKinds) ||
      !data.constants.accountSubtypes || !data.pagination?.transactions || !data.pagination?.audit) {
    throw new Error("The financial workspace could not be verified. Reload before continuing.");
  }
  const report = data.report;
  const totals = ["incomeMinor", "expenseMinor", "netIncomeMinor", "cashInMinor", "cashOutMinor", "cashFlowMinor",
    "cashMinor", "savingsMinor", "receivablesMinor", "debtMinor", "assetsMinor", "liabilitiesMinor", "netWorthMinor"];
  if (!report || !["ETB", "USD"].includes(report.currency) || totals.some((key) => !Number.isSafeInteger(report.totals?.[key])) ||
      !["monthlyIncomeExpense", "spending", "category", "savings", "debt", "cashflow"].every((key) => Array.isArray(report.series?.[key])) ||
      !report.balanceSheet || !report.incomeStatement || !report.trialBalance ||
      !Array.isArray(report.balanceSheet.accounts) || !Array.isArray(report.trialBalance.accounts) ||
      !Array.isArray(report.journal) || !report.journalPagination ||
      ["assetsMinor", "liabilitiesMinor", "equityMinor", "netWorthMinor"].some((key) => !Number.isSafeInteger(report.balanceSheet[key])) ||
      ["incomeMinor", "expenseMinor", "netIncomeMinor"].some((key) => !Number.isSafeInteger(report.incomeStatement[key])) ||
      ["debitMinor", "creditMinor"].some((key) => !Number.isSafeInteger(report.trialBalance[key]))) {
    throw new Error("Incomplete accounting statements. Reload before continuing.");
  }
  if (data.accounts.some((account) => !account._id || !account.name || !account.type || !account.subtype ||
      !["ETB", "USD"].includes(account.currency) || !Number.isSafeInteger(account.balanceMinor)) ||
      data.goals.some((goal) => !goal._id || !Number.isSafeInteger(goal.targetMinor) || goal.targetMinor <= 0 ||
        !Number.isSafeInteger(goal.savedMinor) || goal.savedMinor < 0)) {
    throw new Error("Incomplete account or savings balances. Reload before continuing.");
  }
  function validateAmounts(value) {
    if (!value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value)) {
      if (key.endsWith("Minor") && !Number.isSafeInteger(entry)) {
        throw new Error("The server returned an invalid accounting amount.");
      }
      if (entry && typeof entry === "object") validateAmounts(entry);
    }
  }
  validateAmounts(data);
  return data;
}
