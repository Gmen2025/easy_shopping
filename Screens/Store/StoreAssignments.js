import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { apiRequest, storeRequest } from "../../assets/common/storefront";
import { useCurrency } from "../../assets/common/currency";

const StoreAssignments = ({ route, navigation } = {}) => {
  const admin = route?.params?.admin === true;
  const scope = admin ? "admin" : "me";
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actingId, setActingId] = useState("");
  const [now, setNow] = useState(Date.now());
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [driverIds, setDriverIds] = useState({});
  const [preparationVehicles, setPreparationVehicles] = useState({});
  const actionInFlight = useRef(false);
  const { formatPrice } = useCurrency();
  useFocusEffect(useCallback(() => {
    let active = true;
    let pending = false;
    const load = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await storeRequest(`${scope}/assignments`);
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
  }, [refreshKey, scope]));
  const respond = async (order, decision) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setActingId(order._id);
    try {
      if (decision === "delete") await apiRequest("orders", order._id, { method: "delete" });
      else if (decision === "driver-reroute" || decision === "driver-assign") await storeRequest(
        `${scope}/assignments/${order._id}/drivers/${decision === "driver-assign" ? "assign" : "reroute"}`,
        { method: "post", ...(decision === "driver-assign" ? { data: { driverId: driverIds[order._id]?.trim() } } : {}) });
      else await storeRequest(`${scope}/assignments/${order._id}/${decision}`, { method: "post",
        ...(decision === "enable-preparation" ? { data: { vehicle: preparationVehicles[order._id] } } : {}) });
      setSelectedIds((current) => decision === "ready"
        ? current.includes(order._id) ? current : [...current, order._id]
        : current.filter((key) => key !== order._id));
      const result = await storeRequest(`${scope}/assignments`);
      if (!Array.isArray(result)) throw new Error("The server returned an invalid assignment list.");
      setOrders(result);
    } catch (failure) { Alert.alert("Assignment response failed", failure.response?.data?.message || failure.message); }
    finally { actionInFlight.current = false; setActingId(""); }
  };
  const dispatchSelected = async () => {
    if (actionInFlight.current || !selectedIds.length) return;
    actionInFlight.current = true;
    setActingId("batch");
    try {
      await storeRequest(`${scope}/dispatch-batches`, { method: "post", data: { orderIds: selectedIds } });
      setSelectedIds([]);
      setRefreshKey((value) => value + 1);
      Alert.alert("Dispatch queued", "These packages will be offered together to one compatible driver. They stay queued if no driver is available.");
    } catch (failure) {
      Alert.alert("Dispatch failed", failure.response?.data?.message || failure.message);
    } finally { actionInFlight.current = false; setActingId(""); }
  };
  const selected = orders.filter((order) => selectedIds.includes(order._id));
  const selectable = (order) => order.storeRouteVersion === 1 && order.fulfillmentStatus === "accepted" &&
    order.storeReadyAt && !order.storeDispatchBatch && !order.driver;
  return (
    <FlatList style={styles.screen} contentContainerStyle={styles.content}
      data={orders} keyExtractor={(order) => order._id}
      refreshing={loading} onRefresh={() => { setLoading(true); setRefreshKey((value) => value + 1); }}
      ListHeaderComponent={<View><Text style={styles.title}>{admin ? "Admin store assignments & rejections" : "Store assignments"}</Text><Text>Claiming and rerouting do not need Admin review. Rerouting offers another eligible store a chance to accept. Only rejected fallback requests wait for Admin review. Default-store requests stay listed even while offline. Open your store and ensure matching stock/prices before claiming. Claim the order, prepare its package, then mark it ready. Marking ready automatically selects it for dispatch. Dispatch selected sends ready packages from one store with the same vehicle. Single-package dispatch is also allowed.</Text>
        <Text>Driver routing tries nearby available drivers, the nearest available company driver, then an eligible offline company driver. Batches stay together and can reroute before pickup.</Text>
        {admin ? <Text>Admin can override ownership and online status to claim, prepare, dispatch or assign an approved compatible driver. Stock, capacity, payment and pickup safeguards remain enforced. Cancel and reconcile any required refund before deleting paid orders.</Text> : null}
        <TouchableOpacity style={styles.button} disabled={Boolean(actingId) || !selectedIds.length || Boolean(error) ||
          selected.length !== selectedIds.length || selected.some((order) => !selectable(order))}
          onPress={dispatchSelected}><Text>Dispatch selected ({selectedIds.length})</Text></TouchableOpacity>
        {!selectedIds.length ? <Text>Nothing selected. Claim an order, prepare it, then tap Mark package ready to select it automatically. Already-ready packages can be selected below.</Text> : null}
        {error ? <Text style={styles.warning}>{error}</Text> : null}</View>}
      ListEmptyComponent={loading ? <ActivityIndicator /> : <Text>No active assignments.</Text>}
      renderItem={({ item: order }) => {
        const fallback = Boolean(order.fallbackStore);
        const store = fallback ? order.fallbackStore : order.assignedStoreSnapshot;
        const seconds = Math.max(0, Math.ceil((new Date(order.fulfillmentDeadline).getTime() - now) / 1000));
        const rejected = order.adminReviewRequired === "store";
        const driverRejections = (order.companyDriverResponses || []).filter((response) => response.status === "rejected" && response.action !== "reroute");
        const driverManageable = (order.storeDispatchBatch || !order.storeRouteVersion && (!order.inventoryManaged || order.fulfillmentStatus === "accepted")) &&
          ["Pending", "Driver Assigned"].includes(order.deliveryStatus) &&
          !["completed", "cancelled", "payment_pending"].includes(order.fulfillmentStatus) && !rejected && !order.fallbackStore;
        const active = !["completed", "cancelled", "payment_pending"].includes(order.fulfillmentStatus) &&
          !order.driver && !order.storeDispatchBatch;
        return <View style={styles.card}>
          {store?.logo ? <Image source={{ uri: store.logo }} style={styles.logo} /> : null}
          <Text style={styles.heading}>Order #{order._id.slice(-6).toUpperCase()}</Text>
          <Text>{store?.name}</Text><Text>{store?.address}</Text><Text selectable>Store ID: {store?.storeId || store?._id}</Text>
          {order.checkoutGroup ? <Text selectable>Combined checkout: {order.checkoutGroup}</Text> : null}
          {order.requiredVehicle ? <Text>Delivery vehicle: {order.requiredVehicle}</Text> : null}
          {order.driver ? <Text>Assigned driver: {String(order.driver)}</Text> : order.companyOfferDriver ? <Text>Company-driver offer: {String(order.companyOfferDriver)} (persists offline)</Text> : null}
          {driverRejections.length ? <Text>Driver rejection - Admin review ({driverRejections.length}). Payment is unchanged; rejection does not block delivery.</Text> : null}
          {admin ? driverRejections.map((response, index) => <Text key={response._id || index}>
            Rejected by driver {String(response.driver)}{response.respondedAt ? ` at ${new Date(response.respondedAt).toLocaleString()}` : ""}
          </Text>) : null}
          <Text>Deliver to: {order.shippingAddress1}, {order.city}, {order.zip}</Text>
          {(order.orderItems || []).map((line) => <Text key={line._id}>{line.quantity} x {line.product?.name || "Product"} - {line.unitPrice != null || line.product?.price != null ? formatPrice(line.unitPrice ?? line.product.price) : "Price unavailable"}</Text>)}
          <Text>Products: {formatPrice(order.itemsSubtotal)}</Text>
          <Text>{rejected ? `Rejected - Admin review | ${order.fulfillmentStatus}` : fallback ? "Default-store fallback - awaiting a decision (no expiry)" : order.fulfillmentStatus === "accepted" ? order.storeDispatchBatch ? "Dispatched to drivers" : order.storeReadyAt ? "Ready for dispatch" : "Claimed - prepare the package, then tap Mark package ready" : order.fulfillmentStatus === "pending" ? `Respond within ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : `Delivery status: ${order.deliveryStatus} | ${order.fulfillmentStatus || order.status}`}</Text>
          {admin ? <View style={styles.actions}>
            {active ? <>
              {order.fulfillmentStatus !== "accepted" ? <TouchableOpacity style={styles.button} disabled={Boolean(actingId)}
                onPress={() => respond(order, "accept")}><Text>Claim for assigned/default store</Text></TouchableOpacity> : null}
              <TouchableOpacity style={styles.button} disabled={Boolean(actingId)} onPress={() => respond(order, "reroute")}><Text>Admin reroute</Text></TouchableOpacity>
            </> : null}
            <TouchableOpacity style={styles.button} disabled={Boolean(actingId)}
              onPress={() => Alert.alert("Delete order?", "Cancel through its checkout and reconcile any refund first. Paid orders cannot be silently deleted.", [
                { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => respond(order, "delete") },
              ])}><Text>{rejected ? "Delete rejected order" : "Delete order"}</Text></TouchableOpacity>
            {order.checkoutGroup ? <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("DeliveryCheckouts", { admin: true, groupId: order.checkoutGroup })}><Text>Payment, cancellation & refunds</Text></TouchableOpacity> : null}
          </View> : null}
          {driverManageable ? <View style={styles.actions}>
            <TouchableOpacity style={styles.button} disabled={Boolean(actingId)} onPress={() => Alert.alert(
              "Reroute to another driver?", "The entire batch moves together, only before pickup. Fees and payment stay unchanged.", [
                { text: "Cancel", style: "cancel" }, { text: "Reroute", onPress: () => respond(order, "driver-reroute") },
              ])}><Text>Reroute to another driver</Text></TouchableOpacity>
            {admin ? <>
              <Text>Driver ID (approved, compatible vehicle)</Text>
              <TextInput accessibilityLabel={`Driver ID for ${order._id}`} value={driverIds[order._id] || ""}
                autoCapitalize="none" style={styles.button}
                onChangeText={(value) => setDriverIds((current) => ({ ...current, [order._id]: value }))} />
              <TouchableOpacity style={styles.button} disabled={Boolean(actingId) || !driverIds[order._id]?.trim()} onPress={() => Alert.alert(
                "Admin assign / dispatch?", "Assign the entire delivery to this driver, overriding online status and ownership. Vehicle, capacity and pickup safeguards still apply.", [
                  { text: "Cancel", style: "cancel" }, { text: "Assign", onPress: () => respond(order, "driver-assign") },
                ])}><Text>Admin assign / dispatch to driver</Text></TouchableOpacity>
            </> : null}
          </View> : null}
          {!order.storeRouteVersion && !fallback && order.fulfillmentStatus === "accepted" && active ? <View style={styles.actions}>
            <Text>This order uses the older delivery workflow, which hides preparation controls. Enable store preparation first; saved fees and payments will not change. For an older cart, all active packages must be claimed and free of driver assignments, and upgrade together.</Text>
            {!order.requiredVehicle ? <View><Text>Choose a delivery vehicle for packages without a saved vehicle. Unknown-size packages can only be dispatched singly.</Text>
              {["motorcycle", "car", "van", "truck"].map((vehicle) => <TouchableOpacity key={vehicle} style={styles.button}
                accessibilityRole="radio" accessibilityState={{ checked: preparationVehicles[order._id] === vehicle }}
                disabled={Boolean(actingId)} onPress={() => setPreparationVehicles((current) => ({ ...current, [order._id]: vehicle }))}>
                <Text>{preparationVehicles[order._id] === vehicle ? `Selected vehicle: ${vehicle}` : `Use ${vehicle}`}</Text>
              </TouchableOpacity>)}</View> : null}
            <TouchableOpacity style={styles.button} disabled={Boolean(actingId) || !order.requiredVehicle && !preparationVehicles[order._id]}
              onPress={() => Alert.alert("Enable store preparation?", "This upgrades all active packages in an older cart together. Stores will mark their packages ready and dispatch separately. Saved fees, payment records and stock reservations stay unchanged.", [
                { text: "Cancel", style: "cancel" }, { text: "Enable", onPress: () => respond(order, "enable-preparation") },
              ])}><Text>Enable store preparation</Text></TouchableOpacity>
          </View> : null}
          {order.storeRouteVersion === 1 && !fallback && order.fulfillmentStatus === "accepted" ? <View style={styles.actions}>
            {order.storeDispatchBatch ? <Text selectable>Dispatched batch: {String(order.storeDispatchBatch)} | {order.deliveryStatus}.
              {!order.driver ? " Awaiting a compatible driver; remains queued." : ""}</Text> : order.storeReadyAt ? <>
              <Text>Ready for dispatch</Text>
              <TouchableOpacity accessibilityRole="checkbox" accessibilityState={{ checked: selectedIds.includes(order._id) }}
                accessibilityLabel={`Select package ${order._id}`} style={styles.button} disabled={Boolean(actingId) || Boolean(error)}
                onPress={() => setSelectedIds((current) => current.includes(order._id) ? current.filter((key) => key !== order._id) : [...current, order._id])}>
                <Text>{selectedIds.includes(order._id) ? "Selected" : "Select for dispatch"}</Text>
              </TouchableOpacity>
            </> : <TouchableOpacity style={styles.button} disabled={Boolean(actingId)} onPress={() => respond(order, "ready")}><Text>Mark package ready</Text></TouchableOpacity>}
          </View> : null}
          {!admin && !fallback && order.fulfillmentStatus === "accepted" && active ? <TouchableOpacity style={styles.button}
            disabled={Boolean(actingId)} onPress={() => respond(order, "reroute")}><Text>Reroute</Text></TouchableOpacity> : null}
          {!admin && (fallback || order.fulfillmentStatus === "pending") ? <View style={styles.actions}>
            <TouchableOpacity style={styles.button} disabled={Boolean(actingId) || (!fallback && seconds === 0)} onPress={() => respond(order, "accept")}><Text>{fallback ? "Claim order" : "Accept order"}</Text></TouchableOpacity>
            {fallback ? <TouchableOpacity style={styles.button} disabled={Boolean(actingId)} onPress={() => respond(order, "reroute")}><Text>Reroute</Text></TouchableOpacity> : null}
            <TouchableOpacity style={styles.button} disabled={Boolean(actingId)} onPress={() => Alert.alert("Reject assignment?", fallback ? "This order will wait for Admin to claim, reroute, or cancel and delete it after refund review. This does not cancel payment or issue a refund." : "The entire order will move to another eligible store.", [
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
