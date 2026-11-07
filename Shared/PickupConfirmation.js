import React, { useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { storeRequest } from "../assets/common/storefront";
import { addressText } from "../assets/common/rides";

export default function PickupConfirmation({ order, party = "customer", onSaved }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const guard = useRef(false);
  if (order.fulfillmentMethod !== "pickup") return null;
  const confirmation = order.pickupConfirmation || {};
  const ready = !order.internationalShipping || ["arrived_ethiopia", "delivered"].includes(order.internationalShipping.status);
  const complete = Boolean(confirmation.customerAt && confirmation.operatorAt);
  const confirmed = Boolean(confirmation[party === "customer" ? "customerAt" : "operatorAt"]);
  return <View style={{ padding: 12, gap: 8 }}>
    <Text style={{ fontWeight: "700" }}>{order.internationalShipping ? "Collect in Ethiopia" : "Collect from store"}</Text>
    <Text>{order.pickupAddress?.name || order.assignedStoreSnapshot?.name}</Text>
    <Text selectable>{order.pickupAddress?.address || addressText(order.pickupAddress)}</Text>
    {order.pickupAddress?.phone ? <Text>Collection contact: {order.pickupAddress.phone}</Text> : null}
    <Text>Customer: {confirmation.customerAt ? "Confirmed" : "Awaiting confirmation"} | Store/Admin: {confirmation.operatorAt ? "Confirmed" : "Awaiting confirmation"}</Text>
    {confirmation.customerAt ? <Text>Customer confirmation: {new Date(confirmation.customerAt).toLocaleString()} - {confirmation.customerNote}</Text> : null}
    {confirmation.operatorAt ? <Text>Store/Admin confirmation: {new Date(confirmation.operatorAt).toLocaleString()} - {confirmation.operatorNote}</Text> : null}
    <Text>{complete ? "Collection cross-checked and complete." : "Both parties must confirm physical collection. Do not confirm before receiving/handing over the products."}</Text>
    {!ready ? <Text>Awaiting arrival in Ethiopia. International shipping charges still apply.</Text> : null}
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    {!complete && !confirmed && order.fulfillmentStatus !== "cancelled" && ready ? <>
      <TextInput label="Collection note / handover reference" maxLength={300} value={note} onChangeText={setNote} disabled={busy} />
      <Button disabled={busy || !note.trim()} onPress={async () => {
        if (guard.current) return;
        guard.current = true;
        setBusy(true); setError("");
        try {
          await storeRequest(`checkouts/${order.checkoutGroup}/orders/${order._id}/pickup-confirmation`, {
            method: "post", data: { party, note: note.trim() },
          });
          await onSaved();
        } catch (failure) { setError(failure.response?.data?.message || failure.message); }
        finally { guard.current = false; setBusy(false); }
      }}>{party === "customer" ? "I collected my products" : "Confirm products handed to customer"}</Button>
    </> : null}
  </View>;
}
