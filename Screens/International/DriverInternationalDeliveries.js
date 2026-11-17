import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import { apiRequest } from "../../assets/common/storefront";
import { errorMessage, stageLabel } from "../../assets/common/internationalHub";

const request = (path, options) => apiRequest("international", path, options);

function DeliveryCard({ shipment, busy, act }) {
  const [proof, setProof] = useState("");
  const recipient = shipment.recipient || {};
  const pickup = () => Alert.alert("Confirm pickup", `Confirm you collected ${shipment.trackingCode} from ${shipment.pickupFrom?.name || "the hub"}.`, [
    { text: "Cancel", style: "cancel" }, { text: "Picked up", onPress: () => act(shipment, "pickup", {}) },
  ]);
  const deliver = () => {
    if (!proof.trim()) { Alert.alert("Proof required", "Enter who received the shipment or another delivery proof."); return; }
    Alert.alert("Confirm delivery", `Mark ${shipment.trackingCode} as delivered to the customer?`, [
      { text: "Cancel", style: "cancel" }, { text: "Delivered", onPress: () => act(shipment, "deliver", { note: proof.trim() }) },
    ]);
  };
  return <View style={styles.card}>
    <Text selectable style={styles.heading}>{shipment.trackingCode}</Text>
    <Text>{stageLabel(shipment.destination?.stage)}</Text>
    <Text>Pick up from: {shipment.pickupFrom?.name} {shipment.pickupFrom?.address ? `- ${shipment.pickupFrom.address}` : ""}</Text>
    <Text>Deliver to: {recipient.label} - {recipient.address1}{recipient.address2 ? `, ${recipient.address2}` : ""}, {recipient.city}</Text>
    {recipient.phone ? <Text selectable>Phone: {recipient.phone}</Text> : null}
    {(shipment.packages || []).filter((entry) => entry.fulfillmentMethod !== "pickup" && !entry.cancelled).map((entry) => <Text key={entry.orderId}>
      • {entry.items.map((item) => `${item.quantity} x ${item.name}`).join(", ")}
    </Text>)}
    {shipment.actions.includes("pickup") ? <Button mode="contained" style={styles.button} disabled={busy} onPress={pickup}>Confirm pickup from hub</Button> : null}
    {shipment.actions.includes("deliver") ? <View>
      <TextInput dense label="Received by / delivery proof" value={proof} onChangeText={setProof} />
      <Button mode="contained" style={styles.button} disabled={busy} onPress={deliver}>Confirm delivery</Button>
    </View> : null}
  </View>;
}

export default function DriverInternationalDeliveries() {
  const [shipments, setShipments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  const run = async (action) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try { await action(); } catch (failure) { setError(errorMessage(failure)); } finally { guard.current = false; setBusy(false); }
  };
  const load = async () => setShipments(await request("driver/deliveries"));
  useFocusEffect(useCallback(() => { run(load); }, []));
  const act = (shipment, action, body) => run(async () => {
    await request(`driver/deliveries/${shipment.groupId}/${encodeURIComponent(shipment.shipmentId)}/${action}`, { method: "post", data: body, timeout: 60000 });
    await load();
  });
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Button disabled={busy} onPress={() => run(load)}>Refresh</Button>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!busy && !error && !shipments.length ? <Text>No international deliveries assigned to you.</Text> : null}
    {shipments.map((shipment) => <DeliveryCard key={`${shipment.groupId}-${shipment.shipmentId}`} shipment={shipment} busy={busy} act={act} />)}
  </ScrollView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f4f6" },
  content: { padding: 12, paddingBottom: 48 },
  heading: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 12 },
  button: { marginTop: 8 },
  error: { color: "#b91c1c", marginBottom: 8 },
});
