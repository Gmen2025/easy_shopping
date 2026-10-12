import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useCurrency } from "../assets/common/currency";
import { paymentText } from "../assets/common/exchangeRate";

export const ExchangeReceipt = ({ value }) => value.exchangeRate ? <View>
  <Text style={styles.heading}>{value.exchangeRate.direction === "usd-to-etb" ? "Birr" : "USD"} payment: {paymentText(value)}</Text>
  <Text>Locked exchange rate: 1 USD = {value.exchangeRate.birrPerUsd} ETB</Text>
  <Text>Rate applied: {new Date(value.exchangeRate.appliedAt).toLocaleString()} | {value.exchangeRate.source}</Text>
  <Text>Rate revision: {value.exchangeRate.revision}. {value.exchangeRate.direction === "usd-to-etb" ? "US catalog costs remain USD; recovery uses the saved birr amount." : "Birr costs remain unchanged; recovery uses this saved USD amount."}</Text>
</View> : null;

export const InternationalReceipt = ({ value }) => value.internationalShipping ? <View>
  <Text style={styles.heading}>US-to-Ethiopia shipment: {value.internationalShipping.status}</Text>
  <Text>US delivery status refers to the consolidation hub, not final delivery in Ethiopia.</Text>
  <Text>Recipient: {value.internationalShipping.recipient?.address1}, {value.internationalShipping.recipient?.city}, Ethiopia</Text>
  <Text>{value.internationalShipping.carrier || ""} {value.internationalShipping.trackingNumber || ""}</Text>
  <Text>{value.internationalShipping.customsNotice}</Text>
</View> : null;

export const DeliverySummary = ({ group }) => {
  const { formatPrice } = useCurrency();
  return <View style={styles.card}>
    <Text selectable style={styles.title}>Checkout #{String(group._id).slice(-6).toUpperCase()}</Text>
    <Text>Status: {group.status} | Payment: {group.paymentStatus}</Text>
    <Text>{group.kind === "service" ? "Service quote" : "Products"}: {formatPrice(group.itemsSubtotal)}</Text>
    <Text>Delivery: {formatPrice(group.deliveryFee)}</Text>
    {group.international ? <>
      <Text>US delivery is to the consolidation hub. It is not delivery to the Ethiopian recipient.</Text>
      <Text>International shipping: {formatPrice(group.international.shippingFee)}</Text>
      <Text>{group.international.customsNotice}</Text>
      {group.international.shipments.map((shipment) => <View key={shipment.id}>
        <Text>Ethiopian recipient: {shipment.recipient.label} - {shipment.recipient.address1}, {shipment.recipient.city}, {shipment.recipient.zip}</Text>
        <Text>Shipment: {shipment.status} | {shipment.carrier || ""} {shipment.trackingNumber || ""}</Text>
      </View>)}
      {group.status === "bank_review" ? <Text>ETB transfer submitted for Admin review. Stock remains reserved; stores cannot start fulfillment before funds are verified. Do not pay again.</Text> : null}
    </> : null}
    <Text style={styles.heading}>Combined total: {formatPrice(group.totalPrice)}</Text>
    <ExchangeReceipt value={group} />
    {group.kind === "service" ? <Text selectable>Service request: {group.serviceRequest}</Text> :
      <Text>Each pickup/destination pair is a separate delivery, not one combined driver route.</Text>}
  </View>;
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6fb" }, content: { padding: 16, paddingBottom: 48, gap: 12 },
  card: { padding: 16, backgroundColor: "#fff", borderRadius: 12, gap: 8 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  heading: { fontSize: 17, fontWeight: "700", color: "#111827" }, input: { backgroundColor: "#fff", marginVertical: 4 },
  error: { color: "#b91c1c" }, success: { color: "#166534" },
});
