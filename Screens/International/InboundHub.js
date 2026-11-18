import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import { apiRequest } from "../../assets/common/storefront";
import {
  ACTION_LABELS, CHARGE_TYPES, chargeStatusLabel, chargesPayload, destinationTimeline, errorMessage, formatMoney, hubSteps, stageLabel,
} from "../../assets/common/internationalHub";

const request = (path, options) => apiRequest("international", path, options);
const blankRow = () => ({ type: "customs_duty", amount: "", label: "" });

function ChargesForm({ currency, busy, onSubmit }) {
  const [rows, setRows] = useState([blankRow()]);
  const [note, setNote] = useState("");
  const edit = (index, field, value) => setRows((previous) => previous.map((row, position) => position === index ? { ...row, [field]: value } : row));
  const submit = () => {
    let payload;
    try { payload = chargesPayload(rows, note); } catch (failure) { Alert.alert("Check the charges", failure.message); return; }
    Alert.alert("Send charges to the customer?", payload.total > 0
      ? `The customer will be asked to pay ${formatMoney(payload.total, currency)} online before release.`
      : "No customs charges will be due and the shipment can be released.", [
      { text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: () => onSubmit(payload.body) },
    ]);
  };
  return <View style={styles.form}>
    {rows.map((row, index) => <View key={index} style={styles.row}>
      <View style={styles.chips}>
        {CHARGE_TYPES.map((type) => <Button key={type.value} compact mode={row.type === type.value ? "contained" : "outlined"} style={styles.chip}
          onPress={() => edit(index, "type", type.value)}>{type.label}</Button>)}
      </View>
      <TextInput dense keyboardType="decimal-pad" label={`Amount (${currency.toUpperCase()})`} value={row.amount} onChangeText={(value) => edit(index, "amount", value)} />
      {row.type === "other" ? <TextInput dense label="Describe this cost" value={row.label} onChangeText={(value) => edit(index, "label", value)} /> : null}
      <Button compact onPress={() => setRows((previous) => previous.filter((_, position) => position !== index))}>Remove</Button>
    </View>)}
    {rows.length < 12 ? <Button compact onPress={() => setRows((previous) => [...previous, blankRow()])}>Add charge</Button> : null}
    <TextInput dense label="Note to customer (optional)" value={note} onChangeText={setNote} />
    <Button mode="contained" disabled={busy} onPress={submit}>{rows.some((row) => String(row.amount).trim()) ? "Send charges" : "No charges due"}</Button>
  </View>;
}

function ShipmentCard({ shipment, busy, act, loadDrivers, drivers }) {
  const [open, setOpen] = useState("");
  const [note, setNote] = useState("");
  const [orderId, setOrderId] = useState("");
  const destination = shipment.destination;
  const charges = destination?.charges;
  const pendingPickups = shipment.packages.filter((entry) => entry.fulfillmentMethod === "pickup" && !entry.cancelled && !entry.pickupConfirmation.operatorAt);
  const submit = async (action, body) => {
    if (await act(shipment, action, body)) { setOpen(""); setNote(""); setOrderId(""); }
  };
  const choose = (action) => {
    setOpen(open === action ? "" : action);
    if (action === "dispatch") loadDrivers();
  };
  return <View style={styles.card}>
    <Text selectable style={styles.heading}>{shipment.trackingCode || shipment.shipmentId}</Text>
    <Text>{shipment.origin} → {shipment.destinationCountry} | {shipment.status} | {stageLabel(destination?.stage)}</Text>
    <Text selectable>Carrier: {shipment.carrier || "-"} {shipment.trackingNumber || ""}</Text>
    {shipment.customer ? <Text>Customer: {shipment.customer.name} {shipment.customer.phone}</Text> : null}
    <Text>Recipient: {shipment.recipient?.label} - {shipment.recipient?.address1}, {shipment.recipient?.city} ({shipment.recipient?.phone})</Text>
    {shipment.packages.map((entry) => <Text key={entry.orderId}>
      • {entry.fulfillmentMethod === "pickup" ? "Pickup" : "Delivery"}{entry.cancelled ? " (cancelled)" : ""}: {entry.items.map((item) => `${item.quantity} x ${item.name}`).join(", ")}
      {entry.fulfillmentMethod === "pickup" ? ` | customer ${entry.pickupConfirmation.customerAt ? "confirmed" : "pending"}, hub ${entry.pickupConfirmation.operatorAt ? "handed over" : "pending"}` : ""}
    </Text>)}
    {charges ? <Text style={styles.bold}>Charges: {formatMoney(charges.total, charges.currency)} - {chargeStatusLabel(charges.status)}{charges.method ? ` (${charges.method})` : ""}</Text> : null}
    {destination?.driver ? <Text>Driver: {destination.driver.name} {destination.driver.phone} {destination.driver.deliveredAt ? "- delivered" : destination.driver.pickedUpAt ? "- picked up" : "- assigned"}</Text> : null}
    {destinationTimeline(shipment).map((entry) => <Text key={entry.key} style={styles.muted}>{entry.label} - {new Date(entry.at).toLocaleString()} {entry.note}</Text>)}
    <View style={styles.steps}>
      <Text style={styles.stepsTitle}>Hub steps</Text>
      {hubSteps(shipment).map((step, index) => <Text key={step.key}
        style={[styles.step, step.state === "done" ? styles.stepDone : step.state === "current" ? styles.stepCurrent : null]}>
        {step.state === "done" ? "✓" : `${index + 1}.`} {step.label}{step.hint ? ` — ${step.hint}` : ""}
      </Text>)}
    </View>
    <View style={styles.chips}>
      {(shipment.actions || []).map((action) => <Button key={action} compact mode={open === action ? "contained" : "outlined"} style={styles.chip} disabled={busy}
        onPress={() => choose(action)}>{ACTION_LABELS[action] || action}</Button>)}
    </View>
    {open === "charges" ? <ChargesForm currency={shipment.currency} busy={busy} onSubmit={(body) => submit("charges", body)} /> : null}
    {["arrive", "clear", "ready"].includes(open) ? <View style={styles.form}>
      <TextInput dense label="Note (optional)" value={note} onChangeText={setNote} />
      <Button mode="contained" disabled={busy} onPress={() => submit(open, { note })}>{ACTION_LABELS[open]}</Button>
    </View> : null}
    {open === "dispatch" ? <View style={styles.form}>
      {!drivers.length ? <Text>No approved drivers available.</Text> : null}
      {drivers.map((driver) => <Button key={driver._id} mode="outlined" style={styles.chip} disabled={busy}
        onPress={() => Alert.alert("Dispatch shipment?", `Assign ${driver.name} (${driver.vehicleType || "vehicle"}) to deliver this shipment.`, [
          { text: "Cancel", style: "cancel" }, { text: "Dispatch", onPress: () => submit("dispatch", { driverId: driver._id }) },
        ])}>{driver.name} - {driver.vehicleType || ""} {driver.isAvailable === false ? "(busy)" : ""}</Button>)}
    </View> : null}
    {open === "handover" ? <View style={styles.form}>
      {pendingPickups.length > 1 ? pendingPickups.map((entry) => <Button key={entry.orderId} compact mode={orderId === entry.orderId ? "contained" : "outlined"} style={styles.chip}
        onPress={() => setOrderId(orderId === entry.orderId ? "" : entry.orderId)}>Package #{entry.orderId.slice(-6).toUpperCase()}</Button>) : null}
      <TextInput dense label="Collected by / ID checked" value={note} onChangeText={setNote} />
      <Button mode="contained" disabled={busy} onPress={() => submit("handover", { note, ...(orderId ? { orderId } : {}) })}>
        {orderId ? "Hand over selected package" : "Hand over all pickup packages"}</Button>
    </View> : null}
  </View>;
}

export default function InboundHub() {
  const [access, setAccess] = useState(null);
  const [hub, setHub] = useState(null);
  const [stores, setStores] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [all, setAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  const run = async (action) => {
    if (guard.current) return false;
    guard.current = true;
    setBusy(true);
    setError("");
    try { await action(); return true; }
    catch (failure) { setError(errorMessage(failure)); return false; }
    finally { guard.current = false; setBusy(false); }
  };
  const load = async (includeAll = all) => {
    const allowed = await request("hub/access");
    setAccess(allowed);
    if (!allowed.allowed) { setShipments([]); return; }
    setHub(await request("hub/config"));
    if (allowed.role === "admin") setStores(await request("hub/stores"));
    setShipments(await request(`hub/shipments${includeAll ? "?include=all" : ""}`));
  };
  useFocusEffect(useCallback(() => { run(() => load()); }, []));
  const act = (shipment, action, body) => run(async () => {
    await request(`hub/shipments/${shipment.groupId}/${encodeURIComponent(shipment.shipmentId)}/${action}`, { method: "post", data: body, timeout: 60000 });
    await load();
  });
  const loadDrivers = () => run(async () => setDrivers(await request("hub/drivers")));
  const saveHub = (store) => Alert.alert("Use this inbound hub?", `${store.name} will receive and manage inbound international shipments.`, [
    { text: "Cancel", style: "cancel" },
    { text: "Save", onPress: () => run(async () => { await request("hub/config", { method: "put", data: { storeId: store._id } }); await load(); }) },
  ]);
  const toggleAll = () => { const next = !all; setAll(next); run(() => load(next)); };

  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {hub ? <Text style={styles.title}>{hub.origin} → {hub.destination} inbound hub</Text> : null}
    {access && !access.allowed ? <Text>Only the AdduGenet inbound hub store owner or Admin can manage inbound shipments.</Text> : null}
    {access?.role === "admin" ? <View style={styles.card}>
      <Text style={styles.heading}>Inbound hub store</Text>
      <Text>{hub?.config ? `${hub.config.storeName} - ${hub.config.storeAddress}` : "No hub store selected. Choose an approved AdduGenet company store."}</Text>
      {stores.map((store) => <Button key={store._id} compact mode={hub?.config?.storeId === store._id ? "contained" : "outlined"} style={styles.chip}
        disabled={busy} onPress={() => saveHub(store)}>{store.name}{store.city ? ` - ${store.city}` : ""}</Button>)}
      {!stores.length ? <Text>No approved company-owned stores in this region.</Text> : null}
    </View> : null}
    {access?.allowed ? <>
      <View style={styles.chips}>
        <Button disabled={busy} onPress={() => run(() => load())}>Refresh</Button>
        <Button disabled={busy} onPress={toggleAll}>{all ? "Hide delivered" : "Show delivered"}</Button>
      </View>
      {!busy && !shipments.length ? <Text>No inbound shipments.</Text> : null}
      {shipments.map((shipment) => <ShipmentCard key={`${shipment.groupId}-${shipment.shipmentId}`} shipment={shipment} busy={busy}
        act={act} loadDrivers={loadDrivers} drivers={drivers} />)}
    </> : null}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 12, paddingBottom: 48 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  heading: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  bold: { fontWeight: "700", marginTop: 4 },
  muted: { color: "#6b7280", fontSize: 12 },
  steps: { marginTop: 8, backgroundColor: "#f9fafb", borderRadius: 8, padding: 8 },
  stepsTitle: { fontWeight: "700", fontSize: 12, marginBottom: 2 },
  step: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  stepDone: { color: "#15803d" },
  stepCurrent: { color: "#1d4ed8", fontWeight: "700" },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 12 },
  form: { marginTop: 8 },
  row: { borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 6, marginBottom: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  chip: { marginRight: 6, marginBottom: 6 },
  error: { color: "#b91c1c", marginBottom: 8 },
});
