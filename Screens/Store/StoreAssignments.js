import React, { useCallback, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { storeRequest } from "../../assets/common/storefront";
import { useCurrency } from "../../assets/common/currency";

const StoreAssignments = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState("");
  const [now, setNow] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const { formatPrice } = useCurrency();
  useFocusEffect(useCallback(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await storeRequest("me/assignments");
        if (active) { setOrders(result); setError(""); }
      } catch (failure) {
        if (active) setError(failure.response?.data?.message || "Unable to refresh assignments. Pull to retry.");
      } finally { pending = false; if (active) setLoading(false); }
    };
    load();
    const refresh = setInterval(load, 15000);
    const clock = setInterval(() => { if (active) setNow(Date.now()); }, 1000);
    return () => { active = false; clearInterval(refresh); clearInterval(clock); };
  }, [refreshKey]));
  const respond = async (order, decision) => {
    if (actingId) return;
    setActingId(order._id);
    try {
      await storeRequest(`me/assignments/${order._id}/${decision}`, { method: "post" });
      setOrders(await storeRequest("me/assignments"));
    } catch (failure) { Alert.alert("Assignment response failed", failure.response?.data?.message || failure.message); }
    finally { setActingId(""); }
  };
  return (
    <FlatList style={styles.screen} contentContainerStyle={styles.content}
      data={orders} keyExtractor={(order) => order._id}
      refreshing={loading} onRefresh={() => { setLoading(true); setRefreshKey((value) => value + 1); }}
      ListHeaderComponent={<View><Text style={styles.title}>Store assignments</Text><Text>Accept and prepare the complete order within the response window. Rejections and unanswered requests are rerouted automatically.</Text>{error ? <Text style={styles.warning}>{error}</Text> : null}</View>}
      ListEmptyComponent={loading ? <ActivityIndicator /> : <Text>No active assignments.</Text>}
      renderItem={({ item: order }) => {
        const store = order.assignedStoreSnapshot;
        const seconds = Math.max(0, Math.ceil((new Date(order.fulfillmentDeadline).getTime() - now) / 1000));
        return <View style={styles.card}>
          {store?.logo ? <Image source={{ uri: store.logo }} style={styles.logo} /> : null}
          <Text style={styles.heading}>Order #{order._id.slice(-6).toUpperCase()}</Text>
          <Text>{store?.name}</Text><Text>{store?.address}</Text><Text selectable>Store ID: {store?.storeId}</Text>
          {order.checkoutGroup ? <Text selectable>Combined checkout: {order.checkoutGroup}</Text> : null}
          {order.requiredVehicle ? <Text>Delivery vehicle: {order.requiredVehicle}</Text> : null}
          <Text>Deliver to: {order.shippingAddress1}, {order.city}, {order.zip}</Text>
          {(order.orderItems || []).map((line) => <Text key={line._id}>{line.quantity} x {line.product?.name || "Product"} - {formatPrice(line.unitPrice)}</Text>)}
          <Text>Products: {formatPrice(order.itemsSubtotal)}</Text>
          <Text>{order.fulfillmentStatus === "accepted" ? "Accepted - prepare for pickup" : `Respond within ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</Text>
          {order.fulfillmentStatus === "pending" ? <View style={styles.actions}>
            <TouchableOpacity style={styles.button} disabled={Boolean(actingId) || seconds === 0} onPress={() => respond(order, "accept")}><Text>Accept & prepare</Text></TouchableOpacity>
            <TouchableOpacity style={styles.button} disabled={Boolean(actingId)} onPress={() => Alert.alert("Reject assignment?", "The entire order will move to another eligible store.", [
              { text: "Cancel", style: "cancel" }, { text: "Reject", style: "destructive", onPress: () => respond(order, "reject") },
            ])}><Text>Reject</Text></TouchableOpacity>
          </View> : null}
        </View>;
      }}
    />
  );
};
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6fb" }, content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 12 }, heading: { fontSize: 18, fontWeight: "700" },
  card: { padding: 16, borderRadius: 12, backgroundColor: "#fff", marginVertical: 12, gap: 8 },
  actions: { flexDirection: "row", gap: 12 }, button: { padding: 12, backgroundColor: "#facc15", borderRadius: 8 },
  warning: { color: "#b45309" }, logo: { width: 60, height: 60, borderRadius: 8 },
});
export default StoreAssignments;
