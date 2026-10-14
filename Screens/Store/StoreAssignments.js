import React, { useCallback, useRef, useState } from "react";
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
  const actionInFlight = useRef(false);
  const { formatPrice } = useCurrency();
  useFocusEffect(useCallback(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await storeRequest("me/assignments");
        if (!Array.isArray(result)) throw new Error("The server returned an invalid assignment list.");
        if (active) { setOrders(result); setError(""); }
      } catch (failure) {
        if (active) setError(failure.response?.data?.message || failure.message || "Unable to refresh assignments. Pull to retry.");
      } finally { pending = false; if (active) setLoading(false); }
    };
    load();
    const refresh = setInterval(load, 15000);
    const clock = setInterval(() => { if (active) setNow(Date.now()); }, 1000);
    return () => { active = false; clearInterval(refresh); clearInterval(clock); };
  }, [refreshKey]));
  const respond = async (order, decision) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setActingId(order._id);
    try {
      await storeRequest(`me/assignments/${order._id}/${decision}`, { method: "post" });
      const result = await storeRequest("me/assignments");
      if (!Array.isArray(result)) throw new Error("The server returned an invalid assignment list.");
      setOrders(result);
    } catch (failure) { Alert.alert("Assignment response failed", failure.response?.data?.message || failure.message); }
    finally { actionInFlight.current = false; setActingId(""); }
  };
  return (
    <FlatList style={styles.screen} contentContainerStyle={styles.content}
      data={orders} keyExtractor={(order) => order._id}
      refreshing={loading} onRefresh={() => { setLoading(true); setRefreshKey((value) => value + 1); }}
      ListHeaderComponent={<View><Text style={styles.title}>Store assignments</Text><Text>Timed assignments are rerouted automatically. Default-store fallback requests stay listed until claimed, rerouted, or rejected for Admin review. Open your store and ensure matching stock/prices before claiming.</Text>{error ? <Text style={styles.warning}>{error}</Text> : null}</View>}
      ListEmptyComponent={loading ? <ActivityIndicator /> : <Text>No active assignments.</Text>}
      renderItem={({ item: order }) => {
        const fallback = Boolean(order.fallbackStore);
        const store = fallback ? order.fallbackStore : order.assignedStoreSnapshot;
        const seconds = Math.max(0, Math.ceil((new Date(order.fulfillmentDeadline).getTime() - now) / 1000));
        return <View style={styles.card}>
          {store?.logo ? <Image source={{ uri: store.logo }} style={styles.logo} /> : null}
          <Text style={styles.heading}>Order #{order._id.slice(-6).toUpperCase()}</Text>
          <Text>{store?.name}</Text><Text>{store?.address}</Text><Text selectable>Store ID: {store?.storeId || store?._id}</Text>
          {order.checkoutGroup ? <Text selectable>Combined checkout: {order.checkoutGroup}</Text> : null}
          {order.requiredVehicle ? <Text>Delivery vehicle: {order.requiredVehicle}</Text> : null}
          <Text>Deliver to: {order.shippingAddress1}, {order.city}, {order.zip}</Text>
          {(order.orderItems || []).map((line) => <Text key={line._id}>{line.quantity} x {line.product?.name || "Product"} - {line.unitPrice != null || line.product?.price != null ? formatPrice(line.unitPrice ?? line.product.price) : "Price unavailable"}</Text>)}
          <Text>Products: {formatPrice(order.itemsSubtotal)}</Text>
          <Text>{fallback ? "Default-store fallback - awaiting a decision (no expiry)" : order.fulfillmentStatus === "accepted" ? "Accepted - prepare for pickup" : `Respond within ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`}</Text>
          {fallback || order.fulfillmentStatus === "pending" ? <View style={styles.actions}>
            <TouchableOpacity style={styles.button} disabled={Boolean(actingId) || (!fallback && seconds === 0)} onPress={() => respond(order, "accept")}><Text>{fallback ? "Claim & prepare" : "Accept & prepare"}</Text></TouchableOpacity>
            {fallback ? <TouchableOpacity style={styles.button} disabled={Boolean(actingId)} onPress={() => respond(order, "reroute")}><Text>Reroute</Text></TouchableOpacity> : null}
            <TouchableOpacity style={styles.button} disabled={Boolean(actingId)} onPress={() => Alert.alert("Reject assignment?", fallback ? "This order will wait for Admin to cancel or delete it. This does not cancel payment or issue a refund." : "The entire order will move to another eligible store.", [
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
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, button: { padding: 12, backgroundColor: "#facc15", borderRadius: 8 },
  warning: { color: "#b45309" }, logo: { width: 60, height: 60, borderRadius: 8 },
});
export default StoreAssignments;
