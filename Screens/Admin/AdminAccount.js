import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import { financeError, financeRequest, operatorRequest } from "../../assets/common/finance";
import { businessPath, validateBusiness } from "../../assets/common/operatorWorkspace";

const periods = ["daily", "weekly", "monthly", "quarterly", "yearly"];
const label = (key) => key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase());
const display = (value) => value == null || value === "" ? "Not provided" : typeof value === "boolean" ? value ? "Yes" : "No" : String(value);

export default function AdminAccount({ navigation, route }) {
  const { kind, accountId } = route.params || {};
  const [view, setView] = useState("dashboard");
  const [period, setPeriod] = useState("weekly");
  const [profile, setProfile] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const revision = useRef(0);
  const load = useCallback(async () => {
    const current = ++revision.current;
    setLoading(true); setError(""); setData(null);
    try {
      const [account, business] = await Promise.all([
        operatorRequest(businessPath(kind, accountId, "profile")),
        ["notify", "add"].includes(view) ? Promise.resolve(null) : operatorRequest(businessPath(kind, accountId, view)),
      ]);
      if (current !== revision.current) return;
      setProfile(validateBusiness(account, "profile"));
      setData(business === null ? null : validateBusiness(business, view, kind));
    } catch (failure) { if (current === revision.current) { setProfile(null); setError(financeError(failure)); } }
    finally { if (current === revision.current) setLoading(false); }
  }, [kind, accountId, view]);
  useFocusEffect(useCallback(() => { load(); return () => { revision.current += 1; }; }, [load]));
  const views = [["dashboard", "Business overview"], ["profile", "Profile & locations"],
    ...(kind === "store" ? [["assignments", "Store assignments"], ["fulfillment", "Fulfillment products"], ["reviews", "Reviews"], ["add", "Add products"]]
      : [["queue", "Delivery queue"], ["available-deliveries", "Delivery offers"], ["completed-today", "Completed today"], ["rides", "Ride dashboard"], ["wallet", "Commission wallet"]]),
    ["notify", "Send notification"]];
  const orders = view === "dashboard" && data
    ? kind === "store" ? [...data.activeOrders, ...data.recentOrders.filter((order) => !data.activeOrders.some((active) => active._id === order._id))] : data.recentDeliveries
    : view === "assignments" ? data : data?.queue || data?.orders;
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
    <Text style={styles.heading}>{profile?.account.name || "Account business dashboard"}</Text>
    <Text>{profile?.account.isCompanyOwned ? "AdduGenet-owned" : profile ? "Independent" : ""}</Text>
    <Text style={styles.note}>Admin inspection: your own sign-in is retained. Delivery, ride and fulfillment actions remain with the operator.</Text>
    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("IncomeDashboard", { kind, accountId, admin: true })}>
      <Text>Products, inventory, income & settings</Text>
    </TouchableOpacity>
    <Picker selectedValue={view} onValueChange={setView}>{views.map(([key, title]) => <Picker.Item key={key} value={key} label={title} />)}</Picker>
    <TouchableOpacity style={styles.button} disabled={loading} onPress={load}><Text>Refresh dashboard</Text></TouchableOpacity>
    {loading && <ActivityIndicator />}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !error && profile && <>
      {view === "notify" && <NotificationForm key={`${kind}:${accountId}`} kind={kind} accountId={accountId} />}
      {view === "add" && <View>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("ProductForm", { storeId: accountId })}><Text>Create product for {profile.account.name}</Text></TouchableOpacity>
        {profile.inventoryEnabled ? <AddListing key={accountId} storeId={accountId} /> : <Text>Inventory is not migrated. New products are linked directly to this store.</Text>}
      </View>}
      {view === "dashboard" && <>
        <Picker selectedValue={period} onValueChange={setPeriod}>{periods.map((key) => <Picker.Item key={key} value={key} label={key} />)}</Picker>
        <Text>Gross activity; net allocations and separate currencies are in Income & settings.</Text>
        <Details values={data.periods[period]} />
        {kind === "store" && <><Text style={styles.title}>Products & inventory</Text><Details values={data.products} /><Details values={data.inventory} /><Details values={data.orders} /></>}
        <Text style={styles.title}>Active & recent activity</Text>
      </>}
      {view === "profile" && <>
        <Details values={profile.account} /><Text style={styles.title}>Account holder</Text>
        {profile.owner ? <Details values={profile.owner} /> : <Text>No linked user. Notifications are unavailable until an account is linked.</Text>}
        {profile.locations.map((store) => <TouchableOpacity key={store._id} style={styles.button}
          onPress={() => navigation.push("AdminAccount", { kind: "store", accountId: store._id })}><Text>{store.name}: open location dashboard</Text></TouchableOpacity>)}
      </>}
      {["dashboard", "queue", "completed-today", "available-deliveries", "assignments"].includes(view) && <>
        {data?.driverEligibility && <Text>{data.driverEligibility.message}</Text>}
        {orders?.length === 0 && <Text>No orders or deliveries.</Text>}
        {orders?.map((order) => <View style={styles.card} key={order._id || order.orderId}><Text style={styles.title}>#{String(order._id || order.orderId).slice(-6)}</Text><Details values={order} /></View>)}
        {data?.routeStops?.length > 0 && <><Text style={styles.title}>Delivery route stops</Text>{data.routeStops.map((stop, index) => <Details key={index} values={stop} />)}</>}
      </>}
      {view === "reviews" && <>{data.reviews.length === 0 && <Text>No reviews.</Text>}{data.reviews.map((review) => <Details key={review.id} values={review} />)}</>}
      {view === "fulfillment" && <>{data.products.length === 0 && <Text>No legacy product fulfillments. Migrated stores use store assignments.</Text>}
        {data.products.map((product) => <Details key={product._id} values={{ name: product.name, price: product.price, category: product.category?.name, stock: product.countInStock }} />)}</>}
      {view === "wallet" && <><Text style={styles.title}>Commission wallet (not earned income)</Text><Details values={data} /></>}
      {view === "rides" && <>
        <Text style={styles.title}>Ride profile & preferences</Text><Details values={data.driver} />
        <Text style={styles.title}>Active trip</Text>{data.trip ? <Details values={data.trip} /> : <Text>No active trip.</Text>}
        <Text style={styles.title}>Current offer</Text>{data.offer ? <Details values={data.offer} /> : <Text>No current offer.</Text>}
        <Text style={styles.title}>Passengers</Text>{data.riders.map((rider) => <Details key={rider._id} values={rider} />)}
        <Text style={styles.title}>Ride payments</Text>{data.payments.length === 0 && <Text>No recent ride payments.</Text>}
        {data.payments.map((ride) => <Details key={ride._id} values={ride} />)}
      </>}
    </>}
  </ScrollView>;
}

function Details({ values }) {
  return <View style={styles.details}>{Object.entries(values || {}).filter(([key]) => !["__v", "success"].includes(key)).map(([key, value]) => <View key={key}>
    {value && typeof value === "object" ? <>
      <Text style={styles.title}>{label(key)}</Text>
      {Array.isArray(value) ? value.length ? value.map((entry, index) => entry && typeof entry === "object"
        ? <Details key={index} values={entry} /> : <Text key={index}>{display(entry)}</Text>) : <Text>None</Text> : <Details values={value} />}
    </> : <Text selectable style={styles.row}>{label(key)}: {display(value)}</Text>}
  </View>)}</View>;
}

function NotificationForm({ kind, accountId }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  return <View style={styles.card}><Text style={styles.title}>Notify this {kind === "store" ? "owner" : "driver"}</Text>
    <Text>Saved to the website/app inbox. Push is attempted for registered devices.</Text>
    <TextInput style={styles.input} placeholder="Title" maxLength={120} value={title} onChangeText={setTitle} editable={!busy} />
    <TextInput style={styles.input} placeholder="Message" multiline maxLength={2000} value={body} onChangeText={setBody} editable={!busy} />
    <TouchableOpacity style={styles.button} disabled={busy || !title.trim() || !body.trim()} onPress={async () => {
      if (guard.current) return;
      guard.current = true; setBusy(true);
      try {
        const result = await financeRequest(`accounts/${kind}/${accountId}/notifications`, { method: "post", data: { title, body } });
        setTitle(""); setBody(""); Alert.alert("Notification saved", result.message);
      } catch (failure) { Alert.alert("Notification failed", financeError(failure)); }
      finally { guard.current = false; setBusy(false); }
    }}><Text>{busy ? "Sending..." : "Send notification"}</Text></TouchableOpacity>
  </View>;
}

function AddListing({ storeId }) {
  const [catalog, setCatalog] = useState([]);
  const [productId, setProductId] = useState("");
  const [stock, setStock] = useState({ price: "", countInStock: "", minStock: "5" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    financeRequest("admin/catalog").then((result) => {
      if (!Array.isArray(result)) throw new Error("Invalid catalog response.");
      if (active) { setCatalog(result); setError(""); }
    }).catch((failure) => { if (active) setError(financeError(failure)); });
    return () => { active = false; };
  }, []));
  return <View style={styles.card}><Text style={styles.title}>Add an existing catalog product</Text>
    {error ? <Text style={styles.error}>{error} Reopen this section to retry.</Text> : null}
    <Picker selectedValue={productId} enabled={!busy} onValueChange={(id) => {
      setProductId(id); setStock({ price: String(catalog.find((product) => product._id === id)?.price ?? ""), countInStock: "0", minStock: "5" });
    }}><Picker.Item label="Select product" value="" />{catalog.map((product) => <Picker.Item key={product._id} value={product._id} label={product.name} />)}</Picker>
    {Object.entries(stock).map(([field, value]) => <View key={field}><Text>{label(field)}</Text><TextInput style={styles.input} keyboardType="decimal-pad"
      editable={!busy} value={value} onChangeText={(text) => setStock((current) => ({ ...current, [field]: text }))} /></View>)}
    <TouchableOpacity style={styles.button} disabled={busy || !productId || Boolean(error)} onPress={async () => {
      if (guard.current) return;
      if (Object.values(stock).some((value) => !value.trim() || !Number.isFinite(Number(value)))) { Alert.alert("Invalid stock", "Enter every stock value."); return; }
      guard.current = true; setBusy(true);
      try {
        const result = await financeRequest(`accounts/store/${storeId}/inventory/${productId}`, { method: "post", data: Object.fromEntries(Object.entries(stock).map(([key, value]) => [key, Number(value)])) });
        setProductId("");
        Alert.alert(result.notification?.error ? "Saved; notification failed" : "Listing added", result.notification?.error || "The product is now in this store inventory. Owner notified.");
      } catch (failure) { Alert.alert("Unable to add listing", financeError(failure)); }
      finally { guard.current = false; setBusy(false); }
    }}><Text>Add listing & notify owner</Text></TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" }, content: { padding: 16, paddingBottom: 40 },
  heading: { fontSize: 22, fontWeight: "700" }, title: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  note: { color: "#475569", marginVertical: 10 }, error: { color: "#b91c1c", margin: 10 },
  button: { padding: 12, marginVertical: 6, backgroundColor: "#ccfbf1", borderRadius: 8 },
  card: { backgroundColor: "#fff", padding: 12, marginVertical: 8, borderRadius: 8 },
  details: { marginVertical: 6, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: "#cbd5e1" },
  row: { paddingVertical: 3 }, input: { padding: 10, borderWidth: 1, borderColor: "#cbd5e1", marginVertical: 8, borderRadius: 6 },
});
