import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import FinancialForm, { FinancialButton, FinancialSelect } from "./FinancialForm";
import { financeError } from "../assets/common/finance";
import {
  financialRequest, financialQuery, financialId, financialAmount, financialDate, financialToday,
} from "../assets/common/financialManagement";

const options = (rows, label) => [{ value: "", label }, ...rows.map((row) => ({ value: row._id, label: row.name }))];
const kindLabel = (kind) => ({
  ACCOUNT: "Account transfer / debt principal / borrowing",
  SALARY: "Business salary to personal",
  OWNER_DRAW: "Business to personal owner withdrawal",
  BUSINESS_PERSONAL_EXPENSE: "Personal purchase paid by business",
  PERSONAL_BUSINESS_EXPENSE: "Business purchase paid personally",
}[kind] || kind.replace(/_/g, " ").toLowerCase());
const liquid = (account) => account.type === "ASSET" &&
  ["CASH", "CHECKING", "SAVINGS"].includes(account.subtype);

export default function FinancialTransfer({ workspace, currency, onSaved }) {
  const [kind, setKind] = useState("ACCOUNT");
  const [fromEntityId, setFromEntityId] = useState(workspace.entity._id);
  const [toEntityId, setToEntityId] = useState(workspace.entity._id);
  const [ledgers, setLedgers] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const [posting, setPosting] = useState(false);
  const [generation, setGeneration] = useState(0);
  const revision = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const entities = workspace.entities;
  const scope = `${fromEntityId}:${toEntityId}:${currency}:${kind}`;
  const data = ledgers?.scope === scope ? ledgers : null;
  useEffect(() => {
    let active = true;
    const request = ++revision.current;
    setError(""); setLedgers(null); setLoading(true);
    const read = async (entityId) => {
      const result = await financialRequest(`workspace?${financialQuery({ entityId, currency, period: "daily" })}`);
      if (financialId(result?.entity) !== entityId || !Array.isArray(result.accounts) || !Array.isArray(result.categories)) {
        throw new Error("Unable to verify transfer accounts. Please retry.");
      }
      return result;
    };
    Promise.all([read(fromEntityId), fromEntityId === toEntityId ? Promise.resolve(null) : read(toEntityId)])
      .then(([source, destination]) => {
        if (active && request === revision.current) setLedgers({ scope, source, destination: destination || source });
      })
      .catch((failure) => { if (active) setError(financeError(failure)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [fromEntityId, toEntityId, currency, scope, retry]);
  const changeKind = (value) => {
    setKind(value);
    const personal = entities.find((entity) => entity.ownerType === "PERSONAL");
    const business = entities.find((entity) => entity.ownerType === "BUSINESS");
    if (value !== "ACCOUNT" && personal && business) {
      const personalSource = value === "PERSONAL_BUSINESS_EXPENSE";
      setFromEntityId(personalSource ? personal._id : business._id);
      setToEntityId(personalSource ? business._id : personal._id);
    }
  };
  const purchase = ["BUSINESS_PERSONAL_EXPENSE", "PERSONAL_BUSINESS_EXPENSE"].includes(kind);
  const categoryRequired = purchase || kind === "SALARY";
  const sourceAccounts = (data?.source.accounts || []).filter((account) =>
    account.currency === currency && financialId(account.entityId) === fromEntityId && !account.system &&
    (kind === "ACCOUNT" ? ["ASSET", "LIABILITY"].includes(account.type) : liquid(account)));
  const targetAccounts = (data?.destination.accounts || []).filter((account) =>
    account.currency === currency && financialId(account.entityId) === toEntityId && !account.system &&
    (kind === "ACCOUNT" ? ["ASSET", "LIABILITY"].includes(account.type) : liquid(account)));
  const categories = ((kind === "SALARY" ? data?.source : data?.destination)?.categories || []).filter((category) => category.type === "EXPENSE");
  return <View style={{ gap: 12 }}>
    <Text>Transfers move balances, not new expenses or income. Borrowing moves a liability to cash; principal repayment moves cash to a liability. Lending moves cash to a custom receivable asset; repayment moves it back. Salary creates linked business expense and personal income. Owner draws and contributions affect equity.</Text>
    <Text>A personal purchase paid by a business creates a business owner draw and a personal expense, without inventing personal cash. Both ledgers post together or neither does.</Text>
    <Text>Personal contributions to a business use an Account transfer between ledgers. A business purchase paid personally uses its dedicated linked purchase kind.</Text>
    <FinancialSelect label="Transfer kind" value={kind} options={workspace.constants.transferKinds.map((value) => ({ value, label: kindLabel(value) }))}
      disabled={posting} onChange={changeKind} />
    <FinancialSelect label="From ledger" value={fromEntityId} disabled={posting}
      options={entities.map((entity) => ({ value: entity._id, label: `${entity.ownerType}: ${entity.name}` }))} onChange={setFromEntityId} />
    <FinancialSelect label="To ledger" value={toEntityId} disabled={posting}
      options={entities.map((entity) => ({ value: entity._id, label: `${entity.ownerType}: ${entity.name}` }))} onChange={setToEntityId} />
    {loading ? <ActivityIndicator /> : null}
    {error ? <><Text accessibilityRole="alert" style={{ color: "#b91c1c" }}>{error}</Text>
      <FinancialButton label="Retry transfer accounts" onPress={() => setRetry((value) => value + 1)} /></> : null}
    {data ? <FinancialForm key={`${scope}:${generation}`} title="Post linked transfer" submitLabel="Post transfer"
      initialValues={{ fromAccountId: "", toAccountId: "", amount: "", date: financialToday(), description: "", categoryId: "" }}
      fields={[
        { name: "fromAccountId", label: "Source / funding account", required: true,
          options: options(sourceAccounts.map((account) => ({ ...account, name: `${account.name} (${account.type} / ${account.subtype})` })), "Choose source account") },
        ...(!purchase ? [{ name: "toAccountId", label: "Destination / liability account", required: true,
          options: options(targetAccounts.map((account) => ({ ...account, name: `${account.name} (${account.type} / ${account.subtype})` })), "Choose destination account") }] : []),
        ...(categoryRequired ? [{ name: "categoryId", label: kind === "SALARY" ? "Business salary expense category (optional)" :
          kind === "PERSONAL_BUSINESS_EXPENSE" ? "Business expense category" : "Personal expense category",
          required: purchase, options: options(categories, kind === "SALARY" ? "Use default Salary category" : "Choose expense category") }] : []),
        { name: "amount", label: "Transfer amount", money: true, required: true },
        { name: "date", label: "Transfer date", date: true, required: true, placeholder: "YYYY-MM-DD" },
        { name: "description", label: "Transfer description", required: true, multiline: true },
      ]}
      onCancel={() => { setKind("ACCOUNT"); setFromEntityId(workspace.entity._id); setToEntityId(workspace.entity._id); }}
      onSubmit={async (values, requestKey) => {
        setPosting(true);
        try {
          await financialRequest("transfers", { method: "post", data: {
            ...values, kind, fromEntityId, toEntityId, currency,
            toAccountId: purchase ? undefined : values.toAccountId,
            categoryId: categoryRequired ? values.categoryId || undefined : undefined,
            amount: financialAmount(values.amount), date: financialDate(values.date), requestKey,
          } });
          if (mounted.current) {
            if (mounted.current) setGeneration((value) => value + 1);
            await onSaved();
          }
        } finally { if (mounted.current) setPosting(false); }
      }} /> : null}
  </View>;
}
