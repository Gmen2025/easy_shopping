import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
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
  const [updatedAt, setUpdatedAt] = useState(null);
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
      setUpdatedAt(new Date());
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
    <View style={styles.pageHeading}>
      {kind === "store" && <TouchableOpacity style={styles.backButton} accessibilityLabel="Go back" onPress={() => navigation.goBack()}>
        <Icon name="arrow-left" size={22} color="#131e3a" />
      </TouchableOpacity>}
      <Text style={styles.heading}>{kind === "store" ? "Account Business Dashboard" : profile?.account.name || "Account business dashboard"}</Text>
    </View>
    {kind === "store" && <Text style={styles.accountName}>{profile?.account.name || "Loading account..."}</Text>}
    <Text>{profile?.account.isCompanyOwned ? "AdduGenet-owned" : profile ? "Independent" : ""}</Text>
    <Text style={styles.note}>Admin inspection: your own sign-in is retained. Delivery, ride and fulfillment actions remain with the operator.</Text>
    {kind === "store" ? <View style={styles.toolbar}>
      <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.navigate("IncomeDashboard", { kind, accountId, admin: true })}>
        <Icon name="shopping-bag" size={20} color="#131e3a" />
        <Text style={styles.buttonText}>Products, inventory & income</Text>
      </TouchableOpacity>
      <View style={styles.selector}>
        <Picker accessibilityLabel="Account dashboard section" selectedValue={view} onValueChange={setView}>{views.map(([key, title]) => <Picker.Item key={key} value={key} label={title} />)}</Picker>
      </View>
      {view === "dashboard" && <View style={styles.selector}>
        <Picker accessibilityLabel="Analytics period" selectedValue={period} onValueChange={setPeriod}>{periods.map((key) => <Picker.Item key={key} value={key} label={label(key)} />)}</Picker>
      </View>}
    </View> : <>
      <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("IncomeDashboard", { kind, accountId, admin: true })}>
        <Text>Products, inventory, income & settings</Text>
      </TouchableOpacity>
      <Picker selectedValue={view} onValueChange={setView}>{views.map(([key, title]) => <Picker.Item key={key} value={key} label={title} />)}</Picker>
    </>}
    {kind === "store" ? <View style={styles.refreshCard}>
      <Icon name="refresh" size={26} color="#059669" />
      <View style={styles.refreshInfo}><Text style={styles.title}>Last updated</Text><Text style={styles.note}>{updatedAt ? updatedAt.toLocaleString() : "Not refreshed yet"}</Text></View>
      <TouchableOpacity style={[styles.primaryButton, loading && styles.disabled]} accessibilityLabel="Refresh dashboard" disabled={loading} onPress={load}>
        <Text style={styles.buttonText}>{loading ? "Refreshing..." : "Refresh"}</Text>
      </TouchableOpacity>
    </View> : <TouchableOpacity style={styles.button} disabled={loading} onPress={load}><Text>Refresh dashboard</Text></TouchableOpacity>}
    {loading && <ActivityIndicator />}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !error && profile && <>
      {view === "notify" && <NotificationForm key={`${kind}:${accountId}`} kind={kind} accountId={accountId} />}
      {view === "add" && <View>
        <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("ProductForm", { storeId: accountId })}><Text>Create product for {profile.account.name}</Text></TouchableOpacity>
        {profile.inventoryEnabled ? <AddListing key={accountId} storeId={accountId} /> : <Text>Inventory is not migrated. New products are linked directly to this store.</Text>}
      </View>}
      {view === "dashboard" && <>
        {kind === "store" ? <StorePerformance data={data} period={period} /> : <>
          <Picker selectedValue={period} onValueChange={setPeriod}>{periods.map((key) => <Picker.Item key={key} value={key} label={key} />)}</Picker>
          <Text>Gross activity; net allocations and separate currencies are in Income & settings.</Text>
          <Details values={data.periods[period]} />
        </>}
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

const storeMetrics = [
  ["sales", "Sales", "tag", "#059669"], ["earnings", "Earnings", "money", "#9333ea"],
  ["orders", "Orders", "clipboard", "#d97706"], ["completedOrders", "Completed orders", "check-circle", "#2563eb"],
  ["unitsSold", "Units sold", "cube", "#9333ea"], ["averageOrder", "Average order", "line-chart", "#15803d"],
  ["reviews", "Reviews", "star", "#d97706"], ["averageRating", "Average rating", "star", "#2563eb"],
];
const numberText = (value) => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 20 }) : "Unavailable";
const dateText = (value) => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).toLocaleString() : "Unavailable";

function StorePerformance({ data, period }) {
  const summary = data.periods[period];
  return <>
    <View style={styles.card}>
      <View style={styles.performanceHeading}><Icon name="shopping-bag" size={38} color="#d97706" /><Text style={styles.title}>Business Performance</Text></View>
      <View style={styles.summaryGrid}>
        {[["sales", "Total sales", "line-chart", "#059669"], ["orders", "Total orders", "shopping-cart", "#2563eb"],
          ["earnings", "Total earnings", "money", "#059669"]].map(([key, title, icon, color]) => <View style={styles.summaryItem} key={key}>
          <Icon name={icon} size={20} color={color} /><Text style={styles.metricLabel}>{title}</Text><Text style={styles.metricValue}>{numberText(summary[key])}</Text>
        </View>)}
      </View>
    </View>
    <View style={styles.activityCard}>
      <View style={styles.activityHeading}><Icon name="bar-chart" size={22} color="#ffd400" /><Text style={styles.activityTitle}>Gross Activity</Text></View>
      <View style={styles.activityBody}>
        <Text style={styles.note}>Net allocations and separate currencies are in Income & settings.</Text>
        {storeMetrics.map(([key, title, icon, color]) => <View style={styles.metricRow} key={key}>
          <Icon name={icon} size={22} color={color} style={styles.metricIcon} /><Text style={styles.metricLabel}>{title}</Text>
          <Text style={styles.rowValue}>{numberText(summary[key])}</Text>
        </View>)}
        {["start", "end"].map((key) => <View style={styles.dateRow} key={key}>
          <Icon name="calendar" size={18} color={key === "start" ? "#15803d" : "#dc2626"} />
          <Text style={styles.dateLabel}>{label(key)}</Text><Text style={styles.dateValue}>{dateText(summary[key])}</Text>
        </View>)}
      </View>
    </View>
    <View style={styles.card}>
      <View style={styles.performanceHeading}><Icon name="cube" size={24} color="#d97706" /><Text style={styles.title}>Products & Inventory</Text></View>
      <View style={styles.summaryGrid}>
        {[["total", "Total", "cube", "#059669"], ["approved", "Approved", "check-circle", "#2563eb"],
          ["pending", "Pending", "clock-o", "#d97706"], ["readyFulfillments", "Ready fulfillments", "star", "#15803d"]].map(([key, title, icon, color]) =>
          <View style={styles.inventoryItem} key={key}><Icon name={icon} size={22} color={color} /><Text style={styles.metricLabel}>{title}</Text><Text style={styles.metricValue}>{numberText(data.products[key])}</Text></View>)}
      </View>
      <Text style={styles.title}>Stock & operations</Text><Details values={data.inventory} /><Details values={data.orders} />
    </View>
  </>;
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
  screen: { flex: 1, backgroundColor: "#f5f7fb" }, content: { padding: 16, paddingBottom: 40 },
  heading: { flex: 1, fontSize: 22, fontWeight: "800", color: "#131e3a" }, title: { fontSize: 16, fontWeight: "700", color: "#131e3a", marginTop: 8 },
  note: { color: "#475569", marginVertical: 10 }, error: { color: "#b91c1c", margin: 10 },
  button: { padding: 12, marginVertical: 6, backgroundColor: "#ccfbf1", borderRadius: 8 },
  card: { backgroundColor: "#fff", padding: 16, marginVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: "#dfe5ef" },
  pageHeading: { flexDirection: "row", alignItems: "center", gap: 12 },
  backButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
  accountName: { color: "#131e3a", fontSize: 18, fontWeight: "700", marginVertical: 8 },
  toolbar: { gap: 8, marginVertical: 8 },
  primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#ffd400", borderRadius: 16, padding: 12, minHeight: 48 },
  buttonText: { color: "#131e3a", fontWeight: "700", flexShrink: 1 },
  selector: { backgroundColor: "#eef1f6", borderRadius: 16, overflow: "hidden" },
  refreshCard: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 14, borderRadius: 20, borderWidth: 1, borderColor: "#dfe5ef", marginVertical: 8 },
  refreshInfo: { flexGrow: 1, flexBasis: 140 },
  disabled: { opacity: 0.6 },
  performanceHeading: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryItem: { flexGrow: 1, flexBasis: 90, borderLeftWidth: 1, borderLeftColor: "#dfe5ef", paddingLeft: 12, gap: 6 },
  inventoryItem: { flexGrow: 1, flexBasis: 120, alignItems: "center", padding: 8, gap: 6 },
  metricLabel: { color: "#26344f", fontSize: 14, flexShrink: 1 },
  metricValue: { color: "#131e3a", fontSize: 22, fontWeight: "800" },
  activityCard: { backgroundColor: "#fff", borderRadius: 20, borderWidth: 1, borderColor: "#dfe5ef", overflow: "hidden", marginVertical: 8 },
  activityHeading: { backgroundColor: "#182033", padding: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  activityTitle: { color: "#fff", fontWeight: "800", fontSize: 20 },
  activityBody: { padding: 16 },
  metricRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44, paddingVertical: 8 },
  metricIcon: { width: 26 },
  rowValue: { color: "#173c90", fontSize: 18, fontWeight: "800", marginLeft: "auto", flexShrink: 1, textAlign: "right" },
  dateRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, borderTopWidth: 1, borderTopColor: "#eef1f6", paddingVertical: 10 },
  dateLabel: { color: "#52617b", fontSize: 13 },
  dateValue: { color: "#52617b", fontSize: 13, flexGrow: 1, flexShrink: 1, textAlign: "right" },
  details: { marginVertical: 6, paddingLeft: 8, borderLeftWidth: 1, borderLeftColor: "#cbd5e1" },
  row: { paddingVertical: 3 }, input: { padding: 10, borderWidth: 1, borderColor: "#cbd5e1", marginVertical: 8, borderRadius: 6 },
});
