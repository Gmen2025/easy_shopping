import React, { useEffect, useRef, useState } from "react";
import { Alert, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import * as WebBrowser from "expo-web-browser";
import { apiRequest, storeRequest } from "../assets/common/storefront";
import CheckoutCardPayment from "./CheckoutCardPayment";
import {
  chargeMethods, chargePaymentState, chargeStatusLabel, destinationTimeline, errorMessage, formatMoney, stageLabel,
} from "../assets/common/internationalHub";

const box = { borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, marginTop: 8, backgroundColor: "#f9fafb" };
const strong = { fontWeight: "700" };

export default function InternationalShipmentStatus({ groupId, shipment, admin = false, onChanged }) {
  const destination = shipment.destination;
  const charges = destination?.charges;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [method, setMethod] = useState(charges?.method || "");
  const [card, setCard] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [bank, setBank] = useState({ bankAccountId: "", sender: "", reference: "" });
  const guard = useRef(false);
  const path = `checkouts/${groupId}/shipments/${encodeURIComponent(shipment.id)}/charges`;
  const { payable, started } = chargePaymentState(charges);
  const chosen = started || method;

  useEffect(() => {
    if (chosen !== "bank" || started || !charges) return;
    storeRequest(`delivery-bank-accounts?currency=${charges.currency.toUpperCase()}`)
      .then((list) => setAccounts(Array.isArray(list) ? list : [])).catch((failure) => setError(errorMessage(failure)));
  }, [chosen, started, charges?.currency]);

  const run = async (action) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try { await action(); }
    catch (failure) { setError(errorMessage(failure)); }
    finally { guard.current = false; setBusy(false); }
  };
  const post = (suffix, data) => apiRequest("international", `${path}/${suffix}`, { method: "post", data, timeout: 60000 });
  const done = async () => { setCard(null); await onChanged?.(); };

  const startCard = () => run(async () => {
    const result = await post("pay", { method: "card", clientType: "mobile" });
    if (result.charges?.status === "paid") return done();
    setCard({ clientSecret: result.clientSecret, publishableKey: result.publishableKey });
  });
  const payCard = (confirmPayment) => run(async () => {
    const result = await confirmPayment(card.clientSecret, { paymentMethodType: "Card" });
    if (result.error) throw new Error(`${result.error.message} Check payment status before retrying.`);
    await post("confirm");
    await done();
  });
  const payTelebirr = () => run(async () => {
    const result = await post("pay", { method: "telebirr", clientType: "mobile" });
    if (result.paymentUrl) await WebBrowser.openBrowserAsync(result.paymentUrl);
    await onChanged?.();
  });
  const payBank = () => run(async () => {
    if (!bank.bankAccountId || !bank.sender.trim() || !bank.reference.trim()) throw new Error("Choose a bank account and enter the sender and transfer reference.");
    await post("pay", { method: "bank", ...bank });
    await done();
  });
  const checkStatus = () => run(async () => { await post("confirm"); await done(); });
  const review = (decision) => Alert.alert(
    decision === "confirm" ? "Confirm customs-charge funds?" : "Reject transfer?",
    decision === "confirm" ? "Verify the amount arrived in the bank account first." : "Only reject after verifying no funds were received.",
    [{ text: "Cancel", style: "cancel" }, { text: decision === "confirm" ? "Funds received" : "No funds received",
      onPress: () => run(async () => { await post(decision === "confirm" ? "bank-confirm" : "bank-reject", decision === "reject" ? { noFundsReceived: true } : {}); await done(); }) }],
  );

  return <View style={box}>
    {shipment.trackingCode ? <Text selectable style={strong}>Tracking number: {shipment.trackingCode}</Text> : null}
    {destination ? <>
      <Text>Destination status: {stageLabel(destination.stage)}</Text>
      {destination.hubStoreName ? <Text>Hub: {destination.hubStoreName}{destination.hubStoreAddress ? ` - ${destination.hubStoreAddress}` : ""}</Text> : null}
      {destinationTimeline(shipment).map((entry) => <Text key={entry.key}>• {entry.label} - {new Date(entry.at).toLocaleString()}{entry.note ? ` - ${entry.note}` : ""}</Text>)}
      {destination.driver ? <Text>Driver: {destination.driver.name} {destination.driver.phone ? `(${destination.driver.phone})` : ""}
        {destination.driver.deliveredAt ? ` - delivered: ${destination.driver.proof}` : destination.driver.pickedUpAt ? " - out for delivery" : ""}</Text> : null}
    </> : null}
    {charges ? <View style={{ marginTop: 6 }}>
      <Text style={strong}>Customs, duty & related charges: {chargeStatusLabel(charges.status)}</Text>
      {charges.items.map((item, index) => <Text key={index}>{item.label}: {formatMoney(item.amount, charges.currency)}</Text>)}
      <Text style={strong}>Total: {formatMoney(charges.total, charges.currency)}</Text>
      {charges.note ? <Text>{charges.note}</Text> : null}
      {charges.status === "bank_review" ? <Text>Transfer reference {charges.bankReference} is awaiting Admin verification.</Text> : null}
      {payable && !admin ? <>
        {!started ? <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {chargeMethods(charges.currency).map((option) => <Button key={option.value} mode={method === option.value ? "contained" : "outlined"}
            style={{ marginRight: 6, marginTop: 6 }} disabled={busy} onPress={() => setMethod(option.value)}>{option.label}</Button>)}
        </View> : <Text>Payment started by {started}. Finish it or check its status; do not pay twice.</Text>}
        {chosen === "card" ? card ? <CheckoutCardPayment publishableKey={card.publishableKey} disabled={busy} label="Pay customs charges" pay={payCard} /> :
          <Button disabled={busy} onPress={startCard}>{started ? "Continue card payment" : "Pay by card"}</Button> : null}
        {chosen === "card" && started ? <Button disabled={busy} onPress={checkStatus}>Check card payment</Button> : null}
        {chosen === "telebirr" ? <>
          <Button disabled={busy} onPress={payTelebirr}>{started ? "Reopen Telebirr payment" : "Pay with Telebirr"}</Button>
          {started ? <Button disabled={busy} onPress={checkStatus}>I paid - check Telebirr status</Button> : null}
        </> : null}
        {chosen === "bank" && !started ? <>
          {accounts.map((account) => <Button key={account._id} mode={bank.bankAccountId === account._id ? "contained" : "outlined"} style={{ marginTop: 6 }}
            onPress={() => setBank((previous) => ({ ...previous, bankAccountId: account._id }))}>{account.bankName} - {account.accountNumber}</Button>)}
          {!accounts.length ? <Text>No {charges.currency.toUpperCase()} bank account is available.</Text> : null}
          <TextInput label="Sender name" value={bank.sender} onChangeText={(sender) => setBank((previous) => ({ ...previous, sender }))} />
          <TextInput label="Transfer reference" value={bank.reference} onChangeText={(reference) => setBank((previous) => ({ ...previous, reference }))} />
          <Button mode="contained" disabled={busy} onPress={payBank}>Submit bank transfer</Button>
        </> : null}
      </> : null}
      {admin && charges.status === "bank_review" ? <>
        <Button disabled={busy} onPress={() => review("confirm")}>Mark customs-charge transfer received</Button>
        <Button disabled={busy} onPress={() => review("reject")}>Reject: no funds received</Button>
      </> : null}
    </View> : destination && ["in_customs", "cleared"].includes(destination.stage) ? <Text>Customs charges will be shown here once the hub assesses them.</Text> : null}
    {error ? <Text style={{ color: "#b91c1c" }}>{error}</Text> : null}
  </View>;
}
