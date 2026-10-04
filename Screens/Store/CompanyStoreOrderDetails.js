import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { useCurrency } from "../../assets/common/currency";
import { formatScheduledDeliveryDate } from "../../assets/common/delivery";

const ORDER_STATUSES = { "1": "Pending", "2": "Processing", "3": "Delivered", "4": "Cancelled" };

const CompanyStoreOrderDetails = ({ route }) => {
  const { order, storeName } = route.params || {};
  const { formatPrice } = useCurrency();

  if (!order) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Order details unavailable</Text>
        <Text style={styles.detail}>Go back and refresh AdminStore, then select the order again.</Text>
      </View>
    );
  }

  const money = (value) => Number.isFinite(value) ? formatPrice(value) : "Unavailable";
  const date = order.dateOrdered ? new Date(order.dateOrdered) : null;
  const scheduledDate = formatScheduledDeliveryDate(order);

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.content}
      data={Array.isArray(order.orderItems) ? order.orderItems : []}
      keyExtractor={(item, index) => `${item.product?._id || "removed"}-${index}`}
      ListHeaderComponent={
        <View>
          <Text style={styles.title}>Order #{String(order._id || order.orderId).slice(-6).toUpperCase()}</Text>
          <Text selectable style={styles.detail}>Order ID: {order._id || order.orderId}</Text>
          {storeName ? <Text style={styles.detail}>Store: {storeName}</Text> : null}
          <Text style={styles.detail}>Order status: {ORDER_STATUSES[order.status] || order.status || "Unavailable"}</Text>
          <Text style={styles.detail}>Delivery status: {order.deliveryStatus || "Unavailable"}</Text>
          <Text style={styles.detail}>Ordered: {date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "Unavailable"}</Text>
          {scheduledDate ? <Text style={styles.detail}>Scheduled delivery: {scheduledDate}</Text> : null}
          <Text style={styles.sectionTitle}>Products for your store</Text>
          <Text style={styles.note}>Assigned orders show all products. Mixed-store fulfillments show only products associated with your store.</Text>
        </View>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Text style={styles.productName}>{item.product?.name || "Product no longer available"}</Text>
          <Text style={styles.detail}>Quantity: {item.quantity ?? "Unavailable"}</Text>
          <Text style={styles.detail}>Unit price: {money(item.product?.price)}</Text>
          <Text style={styles.amount}>
            Line total: {money(Number.isFinite(item.product?.price) && Number.isFinite(item.quantity)
              ? item.product.price * item.quantity : null)}
          </Text>
        </View>
      )}
      ListEmptyComponent={<Text style={styles.detail}>No product details are available for this order.</Text>}
      ListFooterComponent={
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Order summary</Text>
          <Text style={styles.detail}>Store units: {order.units ?? "Unavailable"}</Text>
          <Text style={styles.amount}>Store product total: {money(order.sales)}</Text>
          <Text style={styles.detail}>Whole-order delivery fee: {money(order.deliveryFee)}</Text>
          <Text style={styles.detail}>Whole-order total: {money(order.totalPrice)}</Text>
          <Text style={styles.note}>Details reflect the dashboard when this order was opened. Return and refresh to see updates. Product prices are current catalog prices, not historical purchase prices.</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f5f7" },
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 22, fontWeight: "800", color: "#1f2937", marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: "700", color: "#1f2937", marginVertical: 12 },
  detail: { fontSize: 14, color: "#4b5563", marginBottom: 6 },
  note: { fontSize: 12, color: "#6b7280", marginBottom: 12, lineHeight: 18 },
  card: { backgroundColor: "#fff", borderRadius: 10, padding: 16, marginTop: 12 },
  productName: { fontSize: 16, fontWeight: "700", color: "#1f2937", marginBottom: 8 },
  amount: { fontSize: 14, fontWeight: "700", color: "#059669", marginBottom: 6 },
});

export default CompanyStoreOrderDetails;
