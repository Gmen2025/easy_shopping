import React, { useCallback, useContext, useRef, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { AuthContext } from "../../Context/store/Auth";
import FinancialForm, { FinancialButton, FinancialCard, FinancialSelect } from "../../Shared/FinancialForm";
import { FinancialChart, FinancialMetrics, FinancialStatement } from "../../Shared/FinancialReports";
import FinancialTransfer from "../../Shared/FinancialTransfer";
import { financeError } from "../../assets/common/finance";
import {
  financialRequest, financialMoney, financialAmount, financialMinor, financialDate,
  financialToday, financialQuery, financialId, financialMajor, validateFinancialWorkspace,
} from "../../assets/common/financialManagement";

const TABS = [
  ["dashboard", "Dashboard"], ["entities", "Businesses & personal"], ["income", "Income"],
  ["expenses", "Expenses"], ["payments", "Payments & receivables"], ["accounts", "Accounts, assets & debts"],
  ["goals", "Savings & goals"], ["transfers", "Transfers"], ["reports", "Statements"],
  ["settings", "Categories, periods & audit"],
];
const PERIODS = ["daily", "weekly", "monthly", "yearly", "custom"];
const CREDIT_METHODS = ["CREDIT_CARD", "BUY_NOW_PAY_LATER", "PERSONAL_LOAN"];
const choice = (value, label = value.replace(/_/g, " ").toLowerCase()) => ({ value, label });
const emptyChoice = (label) => choice("", label);
const recordChoices = (rows, label) => [emptyChoice(label), ...rows.map((row) => choice(row._id, row.name))];
const field = (name, label, options = {}) => ({ name, label, ...options });
const moneyField = (name, label, required = true) => field(name, label, { money: true, required });
const dateField = (name, label, required = true) => field(name, label, { date: true, required, placeholder: "YYYY-MM-DD" });
const accountName = (account) => `${account.name} (${account.type.toLowerCase()} / ${account.subtype.toLowerCase()})`;

export default function FinancialManagement() {
  const auth = useContext(AuthContext);
  const admin = auth.user?.isAdmin === true;
  const [entityId, setEntityId] = useState("");
  const [currency, setCurrency] = useState("ETB");
  const [period, setPeriod] = useState("monthly");
  const [from, setFrom] = useState(financialToday());
  const [to, setTo] = useState(financialToday());
  const [range, setRange] = useState({ from: financialToday(), to: financialToday() });
  const [page, setPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);
  const [journalPage, setJournalPage] = useState(1);
  const [combined, setCombined] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [accountView, setAccountView] = useState("ALL");
  const [historyView, setHistoryView] = useState("ALL");
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState(null);
  const revision = useRef(0);
  const scope = `${entityId}:${currency}:${period}:${range.from}:${range.to}:${page}:${auditPage}:${journalPage}:${combined}`;
  const currentScope = useRef(scope);
  currentScope.current = scope;
  const data = workspace?.scope === scope ? workspace.data : null;
  const load = useCallback(async () => {
    if (!admin) return;
    const request = ++revision.current;
    setLoading(true); setError("");
    try {
      const query = financialQuery({ entityId, currency, period, ...range, page, auditPage, journalPage, combinedNetWorth: combined });
      const result = validateFinancialWorkspace(await financialRequest(`workspace?${query}`));
      if (result.report.currency !== currency || (entityId && financialId(result.entity) !== entityId)) {
        throw new Error("The returned ledger or currency does not match your selection. Please reload.");
      }
      if (request === revision.current && currentScope.current === scope) setWorkspace({ scope, data: result });
    } catch (failure) {
      if (request === revision.current && currentScope.current === scope) {
        setWorkspace(null); setError(financeError(failure));
      }
    } finally { if (request === revision.current) setLoading(false); }
  }, [admin, entityId, currency, period, range, page, auditPage, journalPage, combined, scope]);
  useFocusEffect(useCallback(() => {
    load();
    return () => { revision.current += 1; };
  }, [load]));
  const changeScope = (action) => {
    setForm(null); setNotice(""); setPage(1); setAuditPage(1); setJournalPage(1); action();
  };
  const save = async (path, body, requestKey, method = "post") => {
    const startedScope = scope;
    await financialRequest(path, { method, data: { ...body, requestKey } });
    if (startedScope === currentScope.current) {
      setForm(null); setNotice("Record saved. Reloading balances and statements...");
      await load();
    }
  };
  const open = (value) => { setNotice(""); setForm({ ...value, key: `${Date.now()}-${value.title}` }); };
  if (!admin) return <View style={styles.content}><Text accessibilityRole="alert">Admin access is required. Financial records are private to the admin who created them.</Text></View>;

  const money = (minor) => financialMoney(minor, currency);
  const accounts = (data?.accounts || []).filter((account) => account.currency === currency &&
    financialId(account.entityId) === financialId(data?.entity));
  const spendable = accounts.filter((account) => account.type === "ASSET" && ["CASH", "CHECKING", "SAVINGS"].includes(account.subtype));
  const editableAccounts = accounts.filter((account) => !account.system);
  const accountOptions = (rows) => recordChoices(rows.map((account) => ({ ...account, name: accountName(account) })), "Choose account");
  const categories = (data?.categories || []).filter((category) =>
    financialId(category.entityId) === financialId(data?.entity));
  const categoryChoices = (type) => recordChoices(categories.filter((row) => row.type === type).map((row) => {
    const parent = categories.find((entry) => entry._id === financialId(row.parentId));
    return { ...row, name: parent ? `${parent.name} / ${row.name}` : row.name };
  }), "Choose category");
  const methods = data?.constants?.paymentMethods || [];
  const newEntity = () => open({
    title: "Add business", initialValues: { name: "" },
    fields: [field("name", "Business name", { required: true, maxLength: 120 })],
    help: "Businesses and your personal ledger remain separate. Only this creating admin can access this workspace.",
    onSubmit: (values, key) => save("entities", { name: values.name.trim() }, key),
  });
  const newCategory = () => open({
    title: "Add category or subcategory", initialValues: { name: "", type: "EXPENSE", parentId: "" },
    fields: [
      field("type", "Classification", { options: ["INCOME", "EXPENSE"].map((value) => choice(value)), reset: { parentId: "" } }),
      field("name", "Category name", { required: true, maxLength: 120 }),
      field("parentId", "Parent category (optional)", { options: (values) => [
        emptyChoice("No parent / main category"),
        ...categories.filter((row) => row.type === values.type && !row.parentId).map((row) => choice(row._id, row.name)),
      ] }),
    ],
    onSubmit: (values, key) => save("categories", {
      entityId: data.entity._id, name: values.name.trim(), type: values.type, parentId: values.parentId || undefined,
    }, key),
  });
  const newTransaction = (type) => open({
    title: type === "INCOME" ? "Record income" : "Record expense",
    help: type === "EXPENSE" ?
      "The purchase is the expense. Choose a credit-card/loan liability account for a credit-funded purchase; later repay it using Transfers, not another expense. Unpaid supplier amounts remain payable." :
      "Record earned income once. Amount received changes cash; the unpaid portion remains receivable. Owner draws belong under Transfers, not earned income.",
    initialValues: { categoryId: "", accountId: "", amount: "", paidAmount: "0", paymentMethod: "CASH",
      date: financialToday(), dueDate: "", description: "" },
    fields: [
      field("categoryId", "Category / subcategory", { required: true, options: categoryChoices(type) }),
      moneyField("amount", "Total accrued amount"),
      moneyField("paidAmount", type === "INCOME" ? "Amount received now" : "Amount paid / credit-funded now"),
      field("accountId", "Payment / funding account", {
        options: accountOptions(type === "EXPENSE" ? [...spendable, ...editableAccounts.filter((row) => row.type === "LIABILITY")] : spendable),
        reset: (id) => {
          const account = accounts.find((row) => row._id === id);
          return { paymentMethod: account?.type === "LIABILITY" ?
            account.subtype === "CREDIT_CARD" ? "CREDIT_CARD" : "PERSONAL_LOAN" : "CASH" };
        },
      }),
      field("paymentMethod", "Payment method", { options: (values) => {
        const account = accounts.find((row) => row._id === values.accountId);
        const allowed = account?.type === "LIABILITY" ?
          methods.filter((value) => [...CREDIT_METHODS, "CARD", "OTHER"].includes(value) &&
            (value !== "CREDIT_CARD" || account.subtype === "CREDIT_CARD")) :
          methods.filter((value) => !CREDIT_METHODS.includes(value));
        return allowed.map((value) => choice(value));
      } }),
      dateField("date", "Transaction date"), dateField("dueDate", "Due date (optional)", false),
      field("description", "Description", { required: true, multiline: true }),
    ],
    onSubmit: (values, key) => {
      const amount = financialAmount(values.amount);
      const paidAmount = financialAmount(values.paidAmount, { allowZero: true });
      if (financialMinor(paidAmount) > financialMinor(amount)) throw new Error("Amount paid or received cannot exceed the total.");
      if (financialMinor(paidAmount) > 0 && !values.accountId) throw new Error("Choose the account receiving or funding the payment.");
      return save("transactions", { ...values, amount, paidAmount, type,
        accountId: values.accountId || undefined, date: financialDate(values.date),
        dueDate: financialDate(values.dueDate, true), entityId: data.entity._id, currency,
      }, key);
    },
  });
  const newAccount = () => open({
    title: "Add account, asset or liability",
    help: "Opening balances create an audited balanced entry, not income or an expense. Add credit-card or loan balances as liabilities. Cash and bank accounts belong to assets.",
    initialValues: { name: "", type: "ASSET", subtype: "", openingBalance: "0", date: financialToday(), dueDate: "" },
    fields: [
      field("name", "Account / asset name", { required: true, maxLength: 120 }),
      field("type", "Account classification", { options: ["ASSET", "LIABILITY", "EQUITY"].map((value) => choice(value)), reset: { subtype: "" } }),
      field("subtype", "Account kind", { required: true, options: (values) => [
        emptyChoice("Choose account kind"), ...(data.constants.accountSubtypes?.[values.type] || []).map((value) => choice(value)),
      ] }),
      moneyField("openingBalance", "Opening balance (zero allowed)"), dateField("date", "Opening balance date"),
      { ...dateField("dueDate", "Debt payment due date (optional)", false), showWhen: (values) => values.type === "LIABILITY" },
    ],
    onSubmit: (values, key) => save("accounts", {
      ...values, entityId: data.entity._id, currency, openingBalance: financialAmount(values.openingBalance, { allowZero: true }),
      date: financialDate(values.date),
      dueDate: values.type === "LIABILITY" ? financialDate(values.dueDate, true) : undefined,
    }, key),
  });
  const recordPayment = (transaction) => open({
    title: `Record ${transaction.type === "INCOME" ? "receipt" : "payment"}`,
    help: "This settles an existing receivable/payable. It does not create another income or expense.",
    initialValues: { amount: "", accountId: "", date: financialToday(), paymentMethod: "BANK_TRANSFER" },
    fields: [moneyField("amount", "Payment amount"), field("accountId", "Cash / bank account", { required: true, options: accountOptions(spendable) }),
      dateField("date", "Payment date"), field("paymentMethod", "Payment method", {
        options: methods.filter((value) => !CREDIT_METHODS.includes(value)).map((value) => choice(value)),
      })],
    onSubmit: (values, key) => save(`transactions/${transaction._id}/payments`, {
      ...values, amount: financialAmount(values.amount), date: financialDate(values.date),
    }, key),
  });
  const adjustAccount = (account) => open({
    title: "Adjust valuation / reconcile balance",
    help: "Enter a signed balance change, not the new total. This audited equity adjustment is not an income/expense, depreciation calculation or tax revaluation. Use income, expense or a transfer for actual activity.",
    initialValues: { amount: "", date: financialToday(), description: "" },
    fields: [moneyField("amount", "Signed adjustment (+ increase / - decrease)"),
      dateField("date", "Adjustment date"), field("description", "Reason / explanation", { required: true, multiline: true })],
    onSubmit: (values, key) => save(`accounts/${account._id}/adjustments`, {
      ...values, amount: financialAmount(values.amount, { signed: true }), date: financialDate(values.date),
    }, key),
  });
  const editAccount = (account) => open({
    title: "Edit account details",
    initialValues: { name: account.name, dueDate: account.dueDate?.slice(0, 10) || "" },
    fields: [field("name", "Account name", { required: true, maxLength: 120 }),
      ...(account.type === "LIABILITY" ? [dateField("dueDate", "Debt payment due date (optional)", false)] : [])],
    help: "Account classification, currency and posted history cannot be changed here.",
    onSubmit: (values, key) => save(`accounts/${account._id}`, {
      name: values.name.trim(), ...(account.type === "LIABILITY" ? { dueDate: financialDate(values.dueDate, true) || null } : {}),
    }, key, "put"),
  });
  const reverse = (transaction) => open({
    title: "Reverse posted record",
    help: "Posted records are never deleted or overwritten. Reversal includes direct payments and linked ledgers atomically. Separately posted debt-settlement transfers must be reversed first if the server requires it.",
    initialValues: { date: financialToday(), reason: "" },
    fields: [dateField("date", "Reversal date"), field("reason", "Reason for reversal", { required: true, multiline: true })],
    submitLabel: "Post reversal",
    onSubmit: (values, key) => save(`transactions/${transaction._id}/reverse`, { ...values, date: financialDate(values.date) }, key),
  });
  const createGoal = () => open({
    title: "Create savings goal",
    help: "Goals allocate existing savings, not expenses or new assets. Use an account transfer to move cash into savings first; allocations across goals cannot exceed that account's balance.",
    initialValues: { name: "", accountId: "", targetAmount: "", savedAmount: "0", targetDate: "" },
    fields: [field("name", "Goal name", { required: true }), field("accountId", "Savings account", {
      required: true, options: accountOptions(accounts.filter((row) => row.subtype === "SAVINGS")),
    }), moneyField("targetAmount", "Target amount"), moneyField("savedAmount", "Already saved / allocated (zero allowed)"),
    dateField("targetDate", "Target date (optional)", false)],
    onSubmit: (values, key) => save("goals", { ...values, entityId: data.entity._id,
      targetAmount: financialAmount(values.targetAmount), savedAmount: financialAmount(values.savedAmount, { allowZero: true }),
      targetDate: financialDate(values.targetDate, true),
    }, key),
  });
  const updateGoal = (goal) => open({
    title: "Update savings allocation",
    initialValues: { name: goal.name, targetAmount: financialMajor(goal.targetMinor), savedAmount: financialMajor(goal.savedMinor), targetDate: goal.targetDate?.slice(0, 10) || "" },
    fields: [field("name", "Goal name", { required: true }), moneyField("targetAmount", "Target amount"),
      moneyField("savedAmount", "Saved / allocated amount"), dateField("targetDate", "Target date (optional)", false)],
    onSubmit: (values, key) => save(`goals/${goal._id}`, {
      ...values, targetAmount: financialAmount(values.targetAmount), savedAmount: financialAmount(values.savedAmount, { allowZero: true }),
      targetDate: financialDate(values.targetDate, true),
    }, key, "put"),
  });
  const lockPeriod = () => open({
    title: "Close or reopen accounting period",
    help: "A lock blocks backdated journals, payments, opening balances and reversals through the selected date. Clearing the date reopens the period. Every change is audited.",
    initialValues: { lockedThrough: data.settings.lockedThrough?.slice(0, 10) || "" },
    fields: [dateField("lockedThrough", "Lock through date (blank reopens)", false)],
    onSubmit: (values, key) => save("settings", { lockedThrough: financialDate(values.lockedThrough, true) || null }, key, "put"),
  });
  const transactions = data?.transactions || [];
  const rows = transactions.filter((row) => {
    if (tab === "income" && row.type !== "INCOME") return false;
    if (tab === "expenses" && row.type !== "EXPENSE") return false;
    if (historyView === "OUTSTANDING") return row.outstandingMinor > 0 && !row.reversed;
    if (historyView === "REVERSED") return row.reversed;
    return true;
  });
  const visibleAccounts = accounts.filter((account) => {
    if (accountView === "CASH") return spendable.includes(account);
    if (accountView === "CARDS") return account.subtype === "CREDIT_CARD";
    if (accountView === "DEBTS") return account.type === "LIABILITY";
    if (accountView === "RECEIVABLES") return account.subtype === "RECEIVABLE";
    if (accountView === "ASSETS") return account.type === "ASSET";
    if (accountView === "SAVINGS") return account.subtype === "SAVINGS";
    return true;
  });
  const transactionCards = () => <>
    {rows.length ? rows.map((row) => <FinancialCard key={row._id} title={row.description || row.type}>
      <Text>{row.date?.slice(0, 10)} | {row.type} | {row.status}</Text>
      <Text>{money(row.amountMinor)}{Number.isSafeInteger(row.paidMinor) ? ` | Settled: ${money(row.paidMinor)}` : ""}</Text>
      {Number.isSafeInteger(row.outstandingMinor) ? <Text>Outstanding: {money(row.outstandingMinor)}{row.dueDate ? ` | Due ${row.dueDate.slice(0, 10)}` : ""}</Text> : null}
      {row.creditPurchase ? <Text>Credit-funded purchase: merchant settled; debt remains in the funding liability account, not in supplier payables.
        {Number.isSafeInteger(row.liabilityOutstandingMinor) ? ` Purchase debt outstanding: ${money(row.liabilityOutstandingMinor)}.` : ""}
        {Number.isSafeInteger(row.debtPaidMinor) ? ` Debt repaid: ${money(row.debtPaidMinor)}.` : ""}
        {row.liabilityStatus ? ` ${row.liabilityStatus}.` : ""}</Text> : null}
      {(row.payments || []).map((payment) => <View key={payment._id} style={styles.audit}>
        <Text>Payment {payment.date?.slice(0, 10)}: {money(payment.amountMinor)} | {payment.paymentMethod}
          {payment.reversed ? " | Reversed" : ""}</Text>
        <Text>Account: {accounts.find((account) => account._id === financialId(payment.accountId))?.name || financialId(payment.accountId)}</Text>
      </View>)}
      {row.reversedAt || row.reversed ? <Text>Reversed - retained in history</Text> : <>
        {["INCOME", "EXPENSE"].includes(row.type) && row.outstandingMinor > 0 ?
          <FinancialButton label="Record payment / receipt" onPress={() => recordPayment(row)} /> : null}
        <FinancialButton label="Reverse record" secondary onPress={() => reverse(row)} />
      </>}
    </FinancialCard>) : <Text>No matching records on this page and date range.</Text>}
    <Text>Page {page}. Reports cover the full selected date range, not just this history page.</Text>
    <View style={styles.row}>
      <FinancialButton label="Previous records" disabled={page <= 1 || loading} onPress={() => setPage((value) => value - 1)} />
      <FinancialButton label="Next records" disabled={loading || !data?.pagination?.transactions?.hasMore} onPress={() => setPage((value) => value + 1)} />
    </View>
  </>;

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}
    keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
    <Text style={styles.title}>Revenue and Expense Tracker</Text>
    <Text>Private to your admin account. Business accounting and personal finances use separate ledgers. Manual records only; existing sales and payouts are not imported.</Text>
    <FinancialSelect label="Business / personal ledger" value={data?.entity?._id || entityId}
      disabled={loading || Boolean(form)} onChange={(value) => changeScope(() => setEntityId(value))}
      options={data ? data.entities.map((entity) => choice(entity._id, `${entity.ownerType === "PERSONAL" ? "Personal" : "Business"}: ${entity.name}`)) :
        [emptyChoice("Loading ledgers...")]} />
    <FinancialSelect label="Report currency (never combined)" value={currency} disabled={Boolean(form)}
      onChange={(value) => changeScope(() => setCurrency(value))} options={["ETB", "USD"].map((value) => choice(value, value))} />
    <FinancialSelect label="Financial period" value={period} disabled={Boolean(form)}
      onChange={(value) => changeScope(() => setPeriod(value))} options={PERIODS.map((value) => choice(value))} />
    {period === "custom" ? <FinancialForm key={`range-${scope}`} title="Custom reporting dates"
      initialValues={{ from, to }} fields={[dateField("from", "From date"), dateField("to", "To date")]}
      submitLabel="Apply date range" onCancel={() => changeScope(() => setPeriod("monthly"))}
      onSubmit={async (values) => {
        financialDate(values.from); financialDate(values.to);
        if (values.from > values.to) throw new Error("From date must not be after to date.");
        setFrom(values.from); setTo(values.to);
        changeScope(() => setRange({ from: values.from, to: values.to }));
      }} /> : null}
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
      {TABS.map(([value, label]) => <FinancialButton key={value} label={label} secondary={tab !== value}
        disabled={Boolean(form)} onPress={() => { setTab(value); setForm(null); setNotice(""); }} />)}
    </ScrollView>
    {loading ? <ActivityIndicator size="large" /> : null}
    {error ? <FinancialCard title="Unable to load financial records">
      <Text accessibilityRole="alert" style={styles.error}>{error}</Text>
      <FinancialButton label="Retry financial workspace" onPress={load} />
    </FinancialCard> : null}
    {notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
    {data ? form ? <FinancialForm key={form.key} {...form} onCancel={() => setForm(null)} /> : <>
      {tab === "dashboard" ? <>
        <Text style={styles.title}>{data.entity.ownerType === "PERSONAL" ? "Personal dashboard" : data.entity.name}</Text>
        <Text>{data.report.from?.slice(0, 10)} through {data.report.to?.slice(0, 10)}. Income and expenses accrue during the range; asset/debt balances are as of its end.</Text>
        <FinancialMetrics currency={currency} rows={[
          ["Total accrued income", "incomeMinor"], ["Total expenses", "expenseMinor"], ["Net income", "netIncomeMinor"],
          ["Available cash & bank", "cashMinor"], ["Savings", "savingsMinor"], ["Personal / business debt", "debtMinor"],
          ["Receivables", "receivablesMinor"], ["Net worth", "netWorthMinor"],
          ["Cash received", "cashInMinor"], ["Cash paid", "cashOutMinor"], ["Net cash flow", "cashFlowMinor"],
        ].map(([label, key]) => ({ label, minor: data.report.totals[key] }))} />
        <FinancialButton label={combined ? "Hide combined net worth overview" : "Show optional combined net worth overview"} secondary
          onPress={() => changeScope(() => setCombined((value) => !value))} />
        {combined && data.combinedNetWorth ? <FinancialCard title="Private combined financial position">
          <Text>Net worth only, not a combined income statement. Inter-ledger money movements are not added as extra assets. Currencies are never summed.</Text>
          {data.combinedNetWorth.map((row) => <View key={row.currency} style={styles.audit}>
            <Text style={{ fontWeight: "700" }}>Combined: {financialMoney(row.netWorthMinor, row.currency)} | As of {row.asOf?.slice(0, 10)}</Text>
            {(row.entities || []).map((entity) => <Text key={entity.entityId}>
              {entity.name} ({entity.ownerType}): {financialMoney(entity.netWorthMinor, row.currency)}
            </Text>)}
          </View>)}
        </FinancialCard> : null}
        <FinancialChart title="Income vs. expenses" currency={currency}
          rows={data.report.series.monthlyIncomeExpense.map((row) => ({ label: row.date, values: [
            { label: "Income", minor: row.incomeMinor }, { label: "Expenses", minor: row.expenseMinor },
          ] }))} />
        <FinancialChart title="Monthly spending trends" currency={currency}
          rows={data.report.series.spending.map((row) => ({ label: row.date, values: [{ label: "Spending", minor: row.amountMinor }] }))} />
        <FinancialChart title="Spending by category" currency={currency}
          rows={data.report.series.category.map((row) => ({ label: row.name, values: [{ label: "Expense", minor: row.amountMinor }] }))} />
        <FinancialChart title="Savings growth" currency={currency}
          rows={data.report.series.savings.map((row) => ({ label: row.date, values: [{ label: "Savings balance", minor: row.amountMinor }] }))} />
        <FinancialChart title="Debt reduction" currency={currency}
          rows={data.report.series.debt.map((row) => ({ label: row.date, values: [{ label: "Debt balance", minor: row.amountMinor }] }))} />
        <FinancialChart title="Cash flow" currency={currency}
          rows={data.report.series.cashflow.map((row) => ({ label: row.date, values: [
            { label: "Received", minor: row.inMinor }, { label: "Paid", minor: row.outMinor }, { label: "Net", minor: row.netMinor },
          ] }))} />
      </> : null}
      {tab === "entities" ? <>
        <FinancialButton label="Add business" onPress={newEntity} />
        {data.entities.map((entity) => <FinancialCard key={entity._id} title={entity.name}>
          <Text>{entity.ownerType === "PERSONAL" ? "Personal finance - not another business" : "Business accounting"}</Text>
          <FinancialButton label={`Open ${entity.name}`} onPress={() => changeScope(() => { setEntityId(entity._id); setTab("dashboard"); })} />
        </FinancialCard>)}
      </> : null}
      {["income", "expenses", "payments"].includes(tab) ? <>
        {tab !== "payments" ? <FinancialButton label={tab === "income" ? "Record income" : "Record expense"}
          onPress={() => newTransaction(tab === "income" ? "INCOME" : "EXPENSE")} /> : null}
        <Text>Accrual records and settlements are separate. A card purchase is an expense; repaying the card uses Transfers. Pending and partial amounts remain receivable/payable.</Text>
        <FinancialSelect label="History view (current page)" value={historyView} onChange={setHistoryView}
          options={[choice("ALL", "All records"), choice("OUTSTANDING", "Outstanding payables / receivables"), choice("REVERSED", "Reversed records")]} />
        {transactionCards()}
      </> : null}
      {tab === "accounts" ? <>
        <FinancialButton label="Add account, asset or liability" onPress={newAccount} />
        <Text>Assets include wallets, cash, bank accounts, savings, property, vehicles and investments. Liabilities include credit cards, loans, mortgages and other debts. Balances are journal-derived; principal repayments are not expenses.</Text>
        <FinancialSelect label="Account view" value={accountView} onChange={setAccountView} options={[
          choice("ALL", "All accounts"), choice("CASH", "Cash, bank & wallets"), choice("SAVINGS", "Savings"),
          choice("CARDS", "Credit cards"), choice("DEBTS", "Debts & payables"), choice("RECEIVABLES", "Receivables"), choice("ASSETS", "All assets"),
        ]} />
        {visibleAccounts.map((account) => <FinancialCard key={account._id} title={account.name}>
          <Text>{account.type} / {account.subtype}</Text><Text>{money(account.balanceMinor)}</Text>
          {account.dueDate ? <Text>Due: {account.dueDate.slice(0, 10)}</Text> : null}
          {account.system ? <Text>System control account</Text> : null}
          {!account.system ? <>
            <FinancialButton label="Edit account details" secondary onPress={() => editAccount(account)} />
            <FinancialButton label="Adjust valuation / reconcile balance" secondary onPress={() => adjustAccount(account)} />
          </> : null}
        </FinancialCard>)}
        {!visibleAccounts.length ? <Text>No accounts in this view for the selected currency.</Text> : null}
      </> : null}
      {tab === "goals" ? <>
        <FinancialButton label="Create savings goal" onPress={createGoal} />
        {data.goals.map((goal) => <FinancialCard key={goal._id} title={goal.name}>
          <Text>{money(goal.savedMinor)} of {money(goal.targetMinor)}</Text>
          <View accessibilityLabel={`${Math.min(100, Math.round(goal.savedMinor / goal.targetMinor * 100))}% saved`} style={styles.track}>
            <View style={[styles.progress, { width: `${Math.min(100, Math.max(0, goal.savedMinor / goal.targetMinor * 100))}%` }]} />
          </View>
          <Text>{goal.targetDate ? `Target date: ${goal.targetDate.slice(0, 10)}` : "No target date"}</Text>
          <FinancialButton label="Update savings allocation" onPress={() => updateGoal(goal)} />
        </FinancialCard>)}
      </> : null}
      {tab === "transfers" ? <FinancialTransfer key={`${data.entity._id}:${currency}`}
        workspace={data} currency={currency} onSaved={async () => {
          setNotice("Linked transfer posted. Both ledgers were updated together.");
          await load();
        }} /> : null}
      {tab === "settings" ? <>
        <FinancialButton label="Add category or subcategory" onPress={newCategory} />
        <FinancialButton label="Close or reopen accounting period" onPress={lockPeriod} />
        <Text>Period locked through: {data.settings.lockedThrough?.slice(0, 10) || "Not locked"}. Permissions: creating admin only. No other administrator shares this workspace.</Text>
        {["INCOME", "EXPENSE"].map((type) => <FinancialCard key={type} title={`${type} categories`}>
          {categories.filter((entry) => entry.type === type && !entry.parentId).map((entry) => <View key={entry._id}>
            <Text style={{ fontWeight: "700" }}>{entry.name}</Text>
            {categories.filter((child) => financialId(child.parentId) === entry._id).map((child) =>
              <Text key={child._id}>  - {child.name}</Text>)}
          </View>)}
        </FinancialCard>)}
        <FinancialCard title="Audit history">
          {data.audit.map((entry) => <View key={entry._id} style={styles.audit}>
            <Text>{entry.createdAt} | {entry.action}</Text>
            <Text>{entry.description || entry.resourceId || ""}</Text>
          </View>)}
          <Text>Audit page {auditPage}</Text>
          <FinancialButton label="Previous audit records" disabled={auditPage <= 1} onPress={() => setAuditPage((value) => value - 1)} />
          <FinancialButton label="Next audit records" disabled={!data.pagination?.audit?.hasMore} onPress={() => setAuditPage((value) => value + 1)} />
        </FinancialCard>
      </> : null}
      {tab === "reports" ? <>
        <Text>Statements in {currency}. Financial events remain immutable; reversals appear as linked journals.</Text>
        <FinancialStatement title="Income statement (accrual)" currency={currency} rows={[
          { label: "Income", minor: data.report.incomeStatement.incomeMinor },
          { label: "Expenses", minor: data.report.incomeStatement.expenseMinor },
          { label: "Net income", minor: data.report.incomeStatement.netIncomeMinor, total: true },
        ]} />
        <FinancialStatement title="Balance sheet" currency={currency} rows={[
          { label: "Assets", minor: data.report.balanceSheet.assetsMinor },
          { label: "Liabilities", minor: data.report.balanceSheet.liabilitiesMinor },
          { label: "Equity (including retained result)", minor: data.report.balanceSheet.equityMinor },
          { label: "Net worth", minor: data.report.balanceSheet.netWorthMinor, total: true },
        ]} help={data.report.balanceSheet.balanced ? "Assets = liabilities + equity." : "UNBALANCED - review required."} />
        <FinancialStatement title="Cash-flow statement" currency={currency} rows={[
          { label: "Cash received", minor: data.report.totals.cashInMinor },
          { label: "Cash paid", minor: data.report.totals.cashOutMinor },
          { label: "Net cash flow", minor: data.report.totals.cashFlowMinor, total: true },
        ]} help="Cash/bank movements are separate from accruals. Internal account transfers do not create income or expenses." />
        <FinancialCard title="Trial balance">
          {data.report.trialBalance.accounts.map((account) => <View key={account.accountId} style={styles.audit}>
            <Text>{account.name} ({account.type})</Text>
            <Text>Debit {money(account.debitMinor)} | Credit {money(account.creditMinor)}</Text>
          </View>)}
          <Text>Debits {money(data.report.trialBalance.debitMinor)} | Credits {money(data.report.trialBalance.creditMinor)}</Text>
          <Text>{data.report.trialBalance.balanced ? "Balanced" : "UNBALANCED - review required"}</Text>
        </FinancialCard>
        <FinancialCard title="General journal">
          {data.report.journal.map((journal) => <View key={journal._id} style={styles.audit}>
            <Text>{journal.date?.slice(0, 10)} | {journal.kind} | {journal.description}</Text>
            {journal.groupId ? <Text>Linked group: {journal.groupId}</Text> : null}
            {journal.reversalOf ? <Text>Reversal of: {journal.reversalOf}</Text> : null}
            {journal.lines.map((line, index) => <Text key={`${financialId(line.accountId)}-${index}`}>
              {accounts.find((account) => account._id === financialId(line.accountId))?.name || financialId(line.accountId)}:
              Debit {money(line.debitMinor)} | Credit {money(line.creditMinor)}
            </Text>)}
          </View>)}
          <Text>Journal page {journalPage} of {data.report.journalPagination.pages}</Text>
          <FinancialButton label="Previous journal page" disabled={journalPage <= 1} onPress={() => setJournalPage((value) => value - 1)} />
          <FinancialButton label="Next journal page" disabled={journalPage >= data.report.journalPagination.pages} onPress={() => setJournalPage((value) => value + 1)} />
        </FinancialCard>
      </> : null}
    </> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f1f5f9" },
  content: { padding: 16, paddingBottom: 40, gap: 12 },
  title: { fontSize: 25, fontWeight: "800", color: "#0f172a" },
  tabs: { gap: 8, paddingVertical: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  error: { color: "#b91c1c" },
  audit: { paddingVertical: 8, borderBottomWidth: 1, borderColor: "#e2e8f0" },
  track: { height: 12, borderRadius: 6, backgroundColor: "#e2e8f0", overflow: "hidden" },
  progress: { height: 12, backgroundColor: "#16a34a" },
});
