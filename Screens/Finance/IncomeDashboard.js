import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import * as Crypto from "expo-crypto";
import { financeError, financeMoney, financeRequest } from "../../assets/common/finance";

const PERIODS = { daily: "24 hours", weekly: "7 days", monthly: "30 days", quarterly: "90 days", yearly: "365 days" };

export default function IncomeDashboard({ navigation, route }) {
  const { kind = "store", admin = false } = route.params || {};
  const [accountId, setAccountId] = useState(route.params?.accountId || "me");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [period, setPeriod] = useState("weekly");
  const [currency, setCurrency] = useState("ETB");
  const [owned, setOwned] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [fees, setFees] = useState({});
  const [paymentAmount, setPaymentAmount] = useState("");
  const [editingStock, setEditingStock] = useState(null);
  const request = useRef(null);
  const loadRevision = useRef(0);
  const inFlight = useRef(false);
  const path = `accounts/${kind}/${accountId}`;
  const load = useCallback(async () => {
    const revision = ++loadRevision.current;
    setLoading(true);
    setError("");
    try {
      const result = await financeRequest(`accounts/${kind}/${accountId}`);
      if (revision !== loadRevision.current) return;
      setData(result);
      setOwned(result.account.isCompanyOwned);
      setEnabled(result.account.payoutsEnabled);
      setFees(Object.fromEntries(Object.entries(result.account.financeFees).map(([key, fee]) => [key, { ...fee, value: String(fee.value) }])));
    } catch (failure) {
      if (revision === loadRevision.current) { setData(null); setError(financeError(failure)); }
    } finally { if (revision === loadRevision.current) setLoading(false); }
  }, [kind, accountId]);
  useFocusEffect(useCallback(() => {
    request.current = null;
    load();
    return () => { loadRevision.current += 1; };
  }, [load]));
  const run = async (action) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try { await action(); }
    catch (failure) { Alert.alert("Unable to complete action", financeError(failure)); }
    finally { setBusy(false); inFlight.current = false; }
  };
  const notifyWarning = (result) => {
    if (result.notification?.error) Alert.alert("Saved; notification failed", result.notification.error);
  };
  const saveSettings = () => {
    if (Object.values(fees).some((fee) => fee.value.trim() === "" || !Number.isFinite(Number(fee.value)))) {
      Alert.alert("Invalid fee", "Enter a number for every fee.");
      return;
    }
    Alert.alert("Update financial settings?", "Ownership and fee changes affect future completed transactions only. Existing allocations and unpaid balances remain unchanged.", [
      { text: "Cancel", style: "cancel" },
      { text: "Save", onPress: () => run(async () => {
        const result = await financeRequest(`${path}/settings`, { method: "put", data: {
          isCompanyOwned: owned, payoutsEnabled: enabled,
          financeFees: Object.fromEntries(Object.entries(fees).map(([key, fee]) => [key, { ...fee, value: Number(fee.value) }])),
        } });
        await load();
        notifyWarning(result);
      }) },
    ]);
  };
  const submitPayout = () => {
    const value = Number(paymentAmount);
    if (!paymentAmount.trim() || !Number.isFinite(value) || value <= 0 ||
        Math.abs(value * 100 - Math.round(value * 100)) > 1e-7) {
      Alert.alert("Invalid amount", "Enter a positive amount with at most two decimal places.");
      return;
    }
    Alert.alert("Request manual payment?", `Submit ${financeMoney(value, currency)} for manual payment? Requests above available collected earnings enter unreserved admin review. No automatic transfer will occur.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Request", onPress: () => run(async () => {
        const signature = `${accountId}:${currency}:${value}`;
        if (request.current?.signature !== signature) request.current = { signature, key: Crypto.randomUUID() };
        const result = await financeRequest(`${path}/payouts`, {
          method: "post", data: { amount: value, currency, requestKey: request.current.key },
        });
        request.current = null;
        setPaymentAmount("");
        await load();
        Alert.alert("Payment requested", result.message);
      }) },
    ]);
  };
  const money = (value) => financeMoney(value, currency);
  const balance = data?.balances.find((item) => item.currency === currency);
  const summary = data?.periods[period]?.[currency];
  const updateFee = (category, field, value) => setFees((current) => ({
    ...current, [category]: { ...current[category], [field]: value },
  }));
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}
    refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
    {loading ? <ActivityIndicator /> : null}
    {error ? <TouchableOpacity onPress={load}><Text style={styles.error}>{error} Tap to retry.</Text></TouchableOpacity> : null}
    {data ? <>
      <Text style={styles.title}>{data.account.name}</Text>
      <Text>{data.account.isCompanyOwned ? "AdduGenet-owned: income belongs to AdduGenet" : "Independent: income after platform fees"}</Text>
      {data.locations.length > 1 ? <Picker selectedValue={data.account._id} enabled={!busy}
        onValueChange={(value) => { setData(null); setAccountId(value); }}>
        {data.locations.map((location) => <Picker.Item key={location._id} value={location._id} label={location.name} />)}
      </Picker> : null}
      <Picker selectedValue={currency} onValueChange={setCurrency}>
        <Picker.Item label="ETB" value="ETB" /><Picker.Item label="USD" value="USD" />
      </Picker>
      <Picker selectedValue={period} onValueChange={setPeriod}>
        {Object.entries(PERIODS).map(([key, label]) => <Picker.Item key={key} value={key} label={label} />)}
      </Picker>
      <View style={styles.card}>
        <Text style={styles.heading}>Income for selected period</Text>
        <Text style={styles.row}>Gross completed income: {money(summary.gross)}</Text>
        <Text style={styles.row}>AdduGenet allocation: {money(summary.adduGenetIncome)}</Text>
        <Text style={styles.row}>Independent net income: {money(summary.independentIncome)}</Text>
        {Object.entries(summary.categories).map(([category, values]) => <Text style={styles.row} key={category}>
          {category}: gross {money(values.gross)} / net {money(values.independentIncome)}
        </Text>)}
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Lifetime balance ({currency})</Text>
        {[
          ["Net earned", balance.totalEarned], ["Collected for payout", balance.collected],
          ["Paid out", balance.paidOut], ["Reserved for pending payouts", balance.pending],
          ["Available to request", balance.available], ["Cash collections (manual reconciliation; excluded)", balance.cashReceived],
        ].map(([label, value]) => <Text key={label} style={styles.row}>{label}: {money(value)}</Text>)}
        {balance.shortfall > 0 ? <Text style={styles.error}>Adjustment shortfall: {money(balance.shortfall)}. Admin review required.</Text> : null}
        <Text style={styles.note}>{data.schedule}</Text>
        <Text style={styles.note}>Only completed, confirmed non-cash collections are eligible. Cash requires manual reconciliation. Refunds and pending payments reduce availability. Requests above available funds enter unreserved admin review.</Text>
        <Text>Payout requests {data.account.payoutsEnabled ? "enabled" : "disabled by admin"}.</Text>
        <TextInput style={styles.input} placeholder="Payment amount" keyboardType="decimal-pad" value={paymentAmount}
          editable={!busy} onChangeText={setPaymentAmount} />
        <Button label={admin ? "Reserve manual payout" : "Request early payment"}
          disabled={busy || !data.account.payoutsEnabled} onPress={submitPayout} />
        {admin ? <Button label="Review and confirm paid payouts" onPress={() => navigation.navigate("Payouts")} disabled={busy} /> : null}
      </View>
      {admin ? <View style={styles.card}>
        <Text style={styles.heading}>Admin ownership & fees</Text>
        <View style={styles.toggle}><Text>AdduGenet-owned</Text><Switch value={owned} onValueChange={setOwned} disabled={busy} /></View>
        <View style={styles.toggle}><Text>Enable payout requests</Text><Switch value={enabled} onValueChange={setEnabled} disabled={busy} /></View>
        {Object.entries(fees).map(([category, fee]) => <View key={category}>
          <Text style={styles.heading}>{category} platform fee</Text>
          <Picker selectedValue={fee.type} enabled={!busy} onValueChange={(value) => updateFee(category, "type", value)}>
            <Picker.Item label="Percentage of completed amount" value="percent" />
            <Picker.Item label="Fixed amount per completed transaction (transaction currency)" value="fixed" />
          </Picker>
          <TextInput style={styles.input} value={fee.value} editable={!busy} keyboardType="decimal-pad"
            accessibilityLabel={`${category} platform fee`} onChangeText={(value) => updateFee(category, "value", value)} />
        </View>)}
        <Text style={styles.note}>Owned income goes entirely to AdduGenet. Independent fees are capped at the transaction amount. Fees apply to future completions, not existing balances.</Text>
        <Button label="Save ownership, fees & payout access" onPress={saveSettings} disabled={busy} />
      </View> : null}
      {kind === "store" ? <View style={styles.card}>
        <Text style={styles.heading}>Products & inventory</Text>
        {data.products.length === 0 && data.inventory.length === 0 ? <Text>No products for this store.</Text> : null}
        {data.products.map((product) => <View key={product._id} style={styles.item}>
          <Text>{product.name} - {product.price} - Stock {product.countInStock}</Text>
          {admin ? <Button label={`Edit ${product.name}`} disabled={busy}
            onPress={() => navigation.navigate("ProductForm", { item: product })} /> : null}
        </View>)}
        {data.inventory.map((stock) => <View key={stock._id} style={styles.item}>
          <Text>{stock.product?.name || "Unavailable product"} - Price {stock.price} - Stock {stock.countInStock} - Reserved {stock.reserved}</Text>
          {admin && stock.product ? <>
            <Button label="Edit shared product details" disabled={busy} onPress={() => navigation.navigate("ProductForm", { item: stock.product })} />
            <Button label="Edit store price & stock" disabled={busy} onPress={() => setEditingStock({
              productId: stock.product._id, price: String(stock.price), countInStock: String(stock.countInStock), minStock: String(stock.minStock),
            })} />
          </> : null}
        </View>)}
        {editingStock ? <View>
          {["price", "countInStock", "minStock"].map((field) => <View key={field}>
            <Text>{field}</Text><TextInput style={styles.input} value={editingStock[field]} keyboardType="decimal-pad" editable={!busy}
              onChangeText={(value) => setEditingStock((current) => ({ ...current, [field]: value }))} />
          </View>)}
          <Button label="Save store inventory & notify owner" disabled={busy} onPress={() => run(async () => {
            if (["price", "countInStock", "minStock"].some((field) => editingStock[field].trim() === "")) throw new Error("Complete all inventory fields.");
            const result = await financeRequest(`accounts/store/${data.account._id}/inventory/${editingStock.productId}`, { method: "put",
              data: { price: Number(editingStock.price), countInStock: Number(editingStock.countInStock), minStock: Number(editingStock.minStock) } });
            setEditingStock(null);
            await load();
            notifyWarning(result);
          })} />
          <Button label="Cancel inventory edit" disabled={busy} onPress={() => setEditingStock(null)} />
        </View> : null}
      </View> : null}
      <View style={styles.card}>
        <Text style={styles.heading}>Recent payouts</Text>
        {data.payouts.filter((payout) => payout.currency === currency).map((payout) => <View key={payout._id} style={styles.item}>
          <Text>{payout.payoutType} - {money(payout.amount)} - {payout.status}</Text>
          <Text>{new Date(payout.dateRequested).toLocaleString()} {payout.reference || ""}</Text>
          {payout.adminNotes ? <Text>{payout.adminNotes}</Text> : null}
        </View>)}
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Recent completed transactions</Text>
        {data.entries.filter((entry) => entry.currency === currency).map((entry) => <View key={entry._id} style={styles.item}>
          <Text>{entry.category} #{String(entry.sourceId).slice(-6)} - {entry.ownership}</Text>
          <Text>Gross {money(entry.grossMinor / 100)} / AdduGenet {money(entry.platformMinor / 100)} / Net {money(entry.netMinor / 100)}</Text>
          <Text>{entry.voided ? "Refund/cancellation adjustment" : entry.collected ? "Collected" : "Awaiting collection"} - {new Date(entry.completedAt).toLocaleDateString()}</Text>
        </View>)}
      </View>
    </> : null}
  </ScrollView>;
}

function Button({ label, disabled, onPress }) {
  return <TouchableOpacity accessibilityLabel={label} disabled={disabled} onPress={onPress}
    style={[styles.button, disabled && { opacity: 0.45 }]}><Text style={styles.buttonText}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" }, content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  card: { padding: 16, borderRadius: 10, backgroundColor: "#fff", marginVertical: 10 },
  heading: { fontSize: 17, fontWeight: "700", marginVertical: 8 }, row: { marginVertical: 5, color: "#334155" },
  note: { color: "#475569", marginVertical: 10 }, error: { color: "#b91c1c", marginVertical: 10 },
  input: { padding: 12, marginVertical: 8, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, backgroundColor: "#fff" },
  toggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 8 },
  button: { backgroundColor: "#0f766e", padding: 12, borderRadius: 8, marginTop: 10 },
  buttonText: { color: "#fff", fontWeight: "600" }, item: { paddingVertical: 12, borderBottomWidth: 1, borderColor: "#e5e7eb" },
});
