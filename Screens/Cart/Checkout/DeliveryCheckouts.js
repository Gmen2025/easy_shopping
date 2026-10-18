import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, ScrollView, Text, View } from "react-native";
import { Button, TextInput } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import { storeRequest } from "../../../assets/common/storefront";
import { useCurrency } from "../../../assets/common/currency";
import { DeliverySummary, DeliveryWindow, ExchangeReceipt, InternationalReceipt, styles } from "../../../Shared/DeliveryCheckout";
import { deliveryModeLabel } from "../../../assets/common/delivery";
import { paymentText } from "../../../assets/common/exchangeRate";
import { getDatabaseNameFromStorage } from "../../../assets/common/databaseConfig";

const DeliveryCheckouts = ({ navigation, route }) => {
  const [groups, setGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refundReference, setRefundReference] = useState("");
  const [shipmentForms, setShipmentForms] = useState({});
  const region = useRef("");
  const guard = useRef(false);
  const { formatPrice } = useCurrency();
  const admin = route.params?.admin === true;
  const load = async (id = selected?._id || route.params?.groupId) => {
    if (id) setSelected(await storeRequest(`checkouts/${id}`));
    else setGroups(await storeRequest(`checkouts${admin ? "?all=true" : ""}`));
  };
  const run = async (action) => {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError("");
    try {
      const db = await getDatabaseNameFromStorage();
      if (region.current && region.current !== db) throw new Error("Region changed. Reopen payments in their original catalog region.");
      region.current = db; await action();
    }
    catch (failure) { setError(failure.response?.data?.message || failure.message); }
    finally { guard.current = false; setBusy(false); }
  };
  useFocusEffect(useCallback(() => {
    run(() => load(route.params?.groupId));
  }, [route.params?.groupId, admin]));
  const change = (path, data) => run(async () => {
    await storeRequest(path, { method: "post", data, timeout: 60000 });
    await load(selected._id);
  });
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Button disabled={busy} onPress={() => run(() => load())}>Refresh status</Button>
    {selected ? <>
      <DeliverySummary group={selected} />
      {selected.status === "awaiting_payment" && !admin ? <Button mode="contained" onPress={() =>
        navigation.push(selected.kind === "service" ? "ServiceUsdCheckout" : "MultiDeliveryCheckout", { groupId: selected._id })}>Resume payment / checkout</Button> : null}
      {admin && selected.paymentMethod === "bank" && ["placed", "bank_review"].includes(selected.status) && selected.paymentStatus === "pending" ? <View style={styles.card}>
        <Text>Verify funds: {selected.exchangeRate ? paymentText(selected) : formatPrice(selected.totalPrice)}</Text>
        <Text>{selected.bankAccount?.bankName} - {selected.bankAccount?.accountNumber}</Text>
        <Text>{selected.bankSender} - {selected.bankReference}</Text>
        <Button disabled={busy} onPress={() => Alert.alert("Confirm received funds?", "Verify the combined total in your bank account before confirming.", [
          { text: "Cancel", style: "cancel" }, { text: "Funds received", onPress: () => change(`checkouts/${selected._id}/bank-confirm`) },
        ])}>Mark combined bank payment received</Button>
        {selected.status === "bank_review" ? <Button disabled={busy} onPress={() => Alert.alert("Reject unpaid transfer reference?", "Only reject after verifying no funds were received. If funds arrived, verify payment and record a refund instead. This releases stock.", [
          { text: "Keep reviewing", style: "cancel" }, { text: "No funds received", onPress: () => change(`checkouts/${selected._id}/bank-reject`, { noFundsReceived: true }) },
        ])}>Reject reference: no funds received</Button> : null}
      </View> : null}
      {selected.international?.shipments.map((shipment) => {
        const stages = ["awaiting_hub", "at_hub", "shipped", "arrived_ethiopia", "delivered"];
        const next = stages[stages.indexOf(shipment.status) + 1];
        const form = shipmentForms[shipment.id] || {};
        return <View key={shipment.id} style={styles.card}>
          <Text style={styles.heading}>Ethiopia shipment: {shipment.status}</Text>
          <Text>Recipient: {shipment.recipient.label} - {shipment.recipient.address1}, {shipment.recipient.city}, {shipment.recipient.zip}, Ethiopia</Text>
          <Text>Recipient phone: {shipment.recipient.phone}</Text>
          <Text>Billable weight: {shipment.billableKg} kg | Shipping: {formatPrice(shipment.shippingUsd)}</Text>
          <Text selectable>{shipment.carrier || "Carrier pending"} {shipment.trackingNumber || ""}</Text>
          {(shipment.history || []).map((entry, index) => <Text key={index}>{entry.status} - {new Date(entry.at).toLocaleString()} - {entry.note}</Text>)}
          {admin && next && selected.status === "placed" ? <>
            {["carrier", "trackingNumber", "note"].map((field) => <TextInput key={field} label={field === "note" ? "Shipment note / delivery proof" : field}
              value={form[field] || ""} onChangeText={(value) => setShipmentForms((previous) => ({
                ...previous, [shipment.id]: { ...previous[shipment.id], [field]: value },
              }))} />)}
            <Button disabled={busy} onPress={() => Alert.alert("Advance international shipment?", `Mark ${next}. Verify all pickup deliveries reached the US hub and the actual shipment milestone occurred.`, [
              { text: "Cancel", style: "cancel" }, { text: "Confirm", onPress: () => change(`checkouts/${selected._id}/shipments/${shipment.id}`, { ...form, status: next }) },
            ])}>Mark shipment {next}</Button>
          </> : null}
        </View>;
      })}
      {(selected.childOrders || []).map((order) => <View key={order._id} style={styles.card}>
        <Text selectable style={styles.heading}>Delivery #{order._id}</Text>
        <Text>Pickup: {order.assignedStoreSnapshot?.name}</Text>
        {order.assignedStoreSnapshot?.logo ? <Image source={{ uri: order.assignedStoreSnapshot.logo }} style={{ width: 56, height: 56 }} /> : null}
        <Text selectable>Store ID: {order.assignedStoreSnapshot?.storeId}</Text>
        <Text>{order.assignedStoreSnapshot?.address}</Text>
        <Text>Destination: {order.shippingAddress1}, {order.shippingAddress2}, {order.city}, {order.zip}, {order.country}</Text>
        <Text>Vehicle: {order.requiredVehicle}</Text>
        <Text>Delivery method: {deliveryModeLabel(order.deliveryMode)}</Text>
        <DeliveryWindow value={order} />
        {(order.orderItems || []).map((line) => <Text key={line._id}>
          {line.quantity} x {line.product?.name || "Product no longer available"} - {line.unitPrice == null ? "Price unavailable" : formatPrice(line.unitPrice)} each
        </Text>)}
        <Text>Store: {order.fulfillmentStatus} | Delivery: {order.deliveryStatus}</Text>
        <Text>Products: {formatPrice(order.itemsSubtotal)} | Route fee: {formatPrice(order.deliveryFee)}</Text>
        <Text>Total: {formatPrice(order.totalPrice)}</Text>
        <ExchangeReceipt value={order} />
        <InternationalReceipt value={order} />
        {!admin && selected.status === "placed" && order.fulfillmentStatus !== "cancelled" ? <Button onPress={() =>
          navigation.navigate("User", { screen: "OrderTracking", params: { orderId: order._id } })}>Track this delivery</Button> : null}
        {order.refundStatus ? <Text>Refund: {order.refundStatus} {order.refundId || ""} - {order.exchangeRate ? paymentText(order) : formatPrice(order.totalPrice)}</Text> : null}
        {selected.status === "placed" && order.deliveryStatus === "Pending" &&
          ["pending", "accepted", "unassigned"].includes(order.fulfillmentStatus) ? <Button disabled={busy}
          onPress={() => Alert.alert("Cancel this delivery?", "Other deliveries in this checkout remain active. Paid deliveries are recorded for refund reconciliation.", [
            { text: "Keep delivery", style: "cancel" },
            { text: "Cancel delivery", style: "destructive", onPress: () => change(`checkouts/${selected._id}/deliveries/${order._id}/cancel`) },
          ])}>Cancel this delivery</Button> : null}
        {admin && ["pending", "failed"].includes(order.refundStatus) ? selected.paymentMethod === "card" ?
          <Button disabled={busy} onPress={() => change(`checkouts/${selected._id}/deliveries/${order._id}/refund`, { retryFailed: order.refundStatus === "failed" })}>Retry / reconcile card refund</Button> :
          <View><TextInput label="Completed bank refund reference" value={refundReference} onChangeText={setRefundReference} />
            <Button disabled={busy} onPress={() => change(`checkouts/${selected._id}/deliveries/${order._id}/manual-refund`, { reference: refundReference })}>Record money returned to customer</Button></View> : null}
      </View>)}
      <Button onPress={() => { setSelected(null); navigation.setParams({ groupId: undefined }); run(async () => {
        setGroups(await storeRequest(`checkouts${admin ? "?all=true" : ""}`));
      }); }}>All checkouts</Button>
    </> : <>
      <Text style={styles.title}>{admin ? "Combined payments & refunds" : "My delivery & service checkouts"}</Text>
      {!busy && !groups.length ? <Text>No multi-delivery checkouts yet.</Text> : null}
      {groups.map((group) => <View key={group._id} style={styles.card}>
        <Text>#{group._id.slice(-6).toUpperCase()} - {group.status} - {formatPrice(group.totalPrice)}</Text>
        {group.exchangeRate ? <Text>Payment: {paymentText(group)}</Text> : null}
        <Text>{group.kind === "service" ? "Quoted service" : `${group.deliveries.length} separate deliveries`} | {group.paymentStatus}</Text>
        <Button disabled={busy} onPress={() => run(() => load(group._id))}>View deliveries / recover payment</Button>
      </View>)}
    </>}
  </ScrollView>;
};
export default DeliveryCheckouts;
