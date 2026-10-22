import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useCurrency } from "../assets/common/currency";
import { paymentText } from "../assets/common/exchangeRate";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const measurementText = (value, unit) => Number.isFinite(value) && value > 0
  ? `${value} ${unit}` : "Not available currently";

export const CheckoutHeader = ({ step = 0, title, onBack, disabled }) => {
  const insets = useSafeAreaInsets();
  return <View>
  <View style={[checkoutStyles.brand, { paddingTop: insets.top + 16 }]}>
    {onBack ? <TouchableOpacity accessibilityRole="button" accessibilityLabel="Back"
      disabled={disabled} onPress={onBack} style={checkoutStyles.back}><Text style={checkoutStyles.backText}>{"<"}</Text></TouchableOpacity> : null}
    <View style={checkoutStyles.bag} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={checkoutStyles.bagHandle} />
    </View>
    <View style={{ flex: 1 }}><Text style={checkoutStyles.brandName}>Addu Genet Eshop</Text>
      <Text style={checkoutStyles.tagline}>Global Products - Local Access</Text></View>
  </View>
  <View style={checkoutStyles.progress} accessible accessibilityLabel={`Checkout step ${Math.min(step + 1, 4)} of 4`}>
    {["Cart", "Address", "Delivery", "Payment"].map((label, index) => <View key={label} style={checkoutStyles.progressStep}>
      <View style={[checkoutStyles.number, index <= step && checkoutStyles.activeNumber]}><Text style={checkoutStyles.numberText}>{index + 1}</Text></View>
      <Text style={checkoutStyles.stepText}>{label}</Text>
    </View>)}
  </View>
  {title ? <Text style={checkoutStyles.title}>{title}</Text> : null}
</View>;
};

export const DeliveryWindow = ({ value }) => value?.deliveryWindowStart && value?.deliveryWindowEnd ? <View>
  <Text style={styles.heading}>{value.international || value.internationalShipping ? "Estimated US hub delivery" : "Estimated delivery"}</Text>
  <Text>{new Date(value.deliveryWindowStart).toLocaleDateString()} - {new Date(value.deliveryWindowEnd).toLocaleDateString()}</Text>
  {value.international || value.internationalShipping ? <Text>US delivery to consolidation hub only. International arrival is tracked separately.</Text> : null}
</View> : null;

export const PackageMeasurements = ({ size }) => <View>
  <Text>Packaged weight: {measurementText(size?.weightKg, "kg")}</Text>
  <Text>Packaged dimensions (L x W x H): {["lengthCm", "widthCm", "heightCm"]
    .every((key) => Number.isFinite(size?.[key]) && size[key] > 0)
    ? `${size.lengthCm} x ${size.widthCm} x ${size.heightCm} cm`
    : ["lengthCm", "widthCm", "heightCm"].some((key) => Number.isFinite(size?.[key]) && size[key] > 0)
      ? `L: ${measurementText(size?.lengthCm, "cm")} | W: ${measurementText(size?.widthCm, "cm")} | H: ${measurementText(size?.heightCm, "cm")}`
      : "Not available currently"}</Text>
</View>;

export const CargoSummary = ({ cargo }) => <View>
  <Text>Load weight: {Number.isFinite(cargo?.weightKg) ? `${cargo.weightKg.toFixed(2)} kg` : "Not available currently"}</Text>
  <Text>Load volume: {Number.isFinite(cargo?.volumeLiters) ? `${cargo.volumeLiters.toFixed(2)} liters` : "Not available currently"}</Text>
</View>;

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

export const DeliveryPricingReceipt = ({ value }) => {
  const { formatPrice } = useCurrency();
  const group = value.deliveryPricingGroup;
  if (!group) return null;
  const fee = value.deliveryFee;
  return <Text>{group.storeCount > 1
    ? `Delivery fee share: ${formatPrice(fee)}. Shared across ${group.storeCount} stores within ${group.radiusMeters} meters using ${group.vehicle}, priced from ${group.storeName}. Shared total: ${formatPrice(group.deliveryFee)}.`
    : `Delivery fee: ${formatPrice(fee)} (once for all products from this store).`}</Text>;
};

export const DeliverySummary = ({ group }) => {
  const { formatPrice } = useCurrency();
  return <View style={styles.card}>
    <Text selectable style={styles.title}>Checkout #{String(group._id).slice(-6).toUpperCase()}</Text>
    <Text>Status: {group.status} | Payment: {group.paymentStatus}</Text>
    <DeliveryWindow value={group} />
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
      <Text>{group.deliveries?.some((delivery) => delivery.pricingGroup)
        ? "Delivery is priced once per store and destination. Stores within 500 meters of each other share one fee when the same vehicle type is selected, using the nearest store's road distance to the drop-off. Different vehicle types or distant stores are charged separately. Shared fees are split equally between store orders for refunds. Pickups remain separately tracked."
        : "Each pickup/destination pair is a separate delivery, not one combined driver route."}</Text>}
  </View>;
};

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6fb" }, content: { padding: 16, paddingBottom: 48, gap: 12 },
  card: { padding: 16, backgroundColor: "#fff", borderRadius: 12, gap: 8 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827" },
  heading: { fontSize: 17, fontWeight: "700", color: "#111827" }, input: { backgroundColor: "#fff", marginVertical: 4 },
  error: { color: "#b91c1c" }, success: { color: "#166534" },
});

export const checkoutStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#fff" },
  content: { padding: 16, paddingTop: 0, paddingBottom: 40, gap: 14 },
  card: { padding: 16, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", gap: 10 },
  title: { fontSize: 22, fontWeight: "800", color: "#101820", marginVertical: 12 },
  heading: { fontSize: 16, fontWeight: "700", color: "#101820" },
  brand: { backgroundColor: "#ffdb00", paddingHorizontal: 16, paddingVertical: 22, flexDirection: "row", alignItems: "center", gap: 18, marginHorizontal: -16 },
  brandName: { fontSize: 20, fontWeight: "800", color: "#101820" },
  bag: { width: 24, height: 27, borderWidth: 2, borderColor: "#101820", borderRadius: 3, marginTop: 5 },
  bagHandle: { position: "absolute", width: 12, height: 12, borderWidth: 2, borderColor: "#101820", borderRadius: 6, top: -8, left: 4 },
  tagline: { fontSize: 11, color: "#27313d", marginTop: 4 },
  back: { padding: 8 },
  backText: { fontSize: 24, color: "#101820", fontWeight: "700" },
  progress: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 20 },
  progressStep: { alignItems: "center", flex: 1, gap: 5 },
  number: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  activeNumber: { backgroundColor: "#ffdb00", borderColor: "#ffdb00" },
  numberText: { color: "#101820", fontWeight: "700" },
  stepText: { fontSize: 11, color: "#374151" },
  primary: { backgroundColor: "#ffdb00", borderRadius: 10, paddingVertical: 5 },
  primaryLabel: { color: "#101820", fontWeight: "800" },
  option: { padding: 16, borderRadius: 12, borderWidth: 1, borderColor: "#e5e7eb", flexDirection: "row", alignItems: "center", gap: 14 },
  selectedOption: { borderColor: "#e6bd00", backgroundColor: "#fffbea" },
  optionBody: { flex: 1, gap: 5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#9ca3af", padding: 4 },
  radioSelected: { borderColor: "#d4ab00", backgroundColor: "#ffdb00" },
  radioDot: { flex: 1, borderRadius: 8, backgroundColor: "#101820" },
  note: { color: "#596579", fontSize: 13, lineHeight: 19 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  successPanel: { borderRadius: 16, padding: 22, backgroundColor: "#f0fdf4", gap: 14, alignItems: "center" },
  successTitle: { color: "#166534", fontSize: 24, fontWeight: "800", textAlign: "center" },
});
