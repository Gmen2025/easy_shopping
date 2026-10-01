import React, { useCallback, useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { AuthContext } from "../../Context/store/Auth";
import baseUrl from "../../assets/common/baseUrl";
import { useCurrency } from "../../assets/common/currency";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

const DASHBOARD_PERIODS = [
  { key: "daily", label: "Day" },
  { key: "weekly", label: "Week" },
  { key: "monthly", label: "Month" },
  { key: "quarterly", label: "Quarter" },
  { key: "yearly", label: "Year" },
];

const CompanyStoreDashboard = () => {
  const { logout, user } = useContext(AuthContext);
  const { formatPrice } = useCurrency();
  const [products, setProducts] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [actingId, setActingId] = useState("");

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}products/company/my-products`, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setProducts(Array.isArray(response.data?.products) ? response.data.products : []);
    } catch (error) {
      Alert.alert("Unable to load products", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}stores/me/dashboard`, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setDashboard(response.data || null);
    } catch (error) {
      setDashboard(null);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  const refreshDashboard = useCallback(() => {
    loadProducts();
    loadDashboard();
  }, [loadProducts, loadDashboard]);

  useFocusEffect(useCallback(() => { refreshDashboard(); }, [refreshDashboard]));

  const markReady = async (product) => {
    setActingId(product._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      await axios.put(`${baseUrl}products/${product._id}/company-ready`, {}, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setProducts((current) => current.filter((item) => item._id !== product._id));
    } catch (error) {
      Alert.alert("Unable to mark ready", error?.response?.data?.message || "Please try again.");
    } finally {
      setActingId("");
    }
  };

  const rejectProduct = async (product) => {
    setActingId(product._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      await axios.put(`${baseUrl}products/${product._id}/company-reject`, {}, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setProducts((current) => current.filter((item) => item._id !== product._id));
    } catch (error) {
      Alert.alert("Unable to reject", error?.response?.data?.message || "Please try again.");
    } finally {
      setActingId("");
    }
  };

  const renderProduct = ({ item }) => (
    <View style={styles.card}>
      <Text style={styles.name}>{item.name}</Text>
      <Text style={styles.detail}>{item.category?.name || "Uncategorized"}</Text>
      <Text style={styles.detail}>Price: {item.price}</Text>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.readyButton} disabled={actingId === item._id} onPress={() => markReady(item)}>
          <Text style={styles.actionText}>{actingId === item._id ? "..." : "Mark Ready"}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.rejectButton} disabled={actingId === item._id} onPress={() => rejectProduct(item)}>
          <Text style={styles.actionText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const period = dashboard?.periods?.[selectedPeriod] || {
    sales: 0,
    earnings: 0,
    orders: 0,
    completedOrders: 0,
    unitsSold: 0,
    averageOrder: 0,
    reviews: 0,
    averageRating: 0,
  };

  const formatDate = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const renderMetric = (icon, label, value, tone = "#1f2937") => (
    <View style={styles.metricCard}>
      <Icon name={icon} size={15} color={tone} />
      <Text style={[styles.metricValue, { color: tone }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );

  const dashboardHeader = (
    <>
      <View style={styles.analyticsCard}>
        <View style={styles.analyticsHeading}>
          <View>
            <Text style={styles.eyebrow}>STORE PERFORMANCE</Text>
            <Text style={styles.analyticsTitle}>Business overview</Text>
          </View>
          {loadingDashboard && <ActivityIndicator size="small" color="#2563eb" />}
        </View>

        <FlatList
          horizontal
          data={DASHBOARD_PERIODS}
          keyExtractor={(item) => item.key}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodRow}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.periodButton, selectedPeriod === item.key && styles.periodButtonActive]}
              onPress={() => setSelectedPeriod(item.key)}
            >
              <Text style={[styles.periodText, selectedPeriod === item.key && styles.periodTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />

        {dashboard ? (
          <>
            <View style={styles.salesRow}>
              <View style={styles.salesBlock}>
                <Text style={styles.salesLabel}>Gross sales</Text>
                <Text style={styles.salesValue}>{formatPrice(period.sales)}</Text>
              </View>
              <View style={styles.earningsBlock}>
                <Text style={styles.earningsLabel}>Company earnings</Text>
                <Text style={styles.earningsValue}>{formatPrice(period.earnings)}</Text>
              </View>
            </View>

            <View style={styles.metricsGrid}>
              {renderMetric("shopping-bag", "Orders", period.orders)}
              {renderMetric("check-circle", "Completed", period.completedOrders, "#059669")}
              {renderMetric("cubes", "Units sold", period.unitsSold)}
              {renderMetric("line-chart", "Avg. order", formatPrice(period.averageOrder))}
              {renderMetric("comments", "Reviews", period.reviews)}
              {renderMetric("star", "Avg. rating", Number(period.averageRating || 0).toFixed(1), "#d97706")}
            </View>
          </>
        ) : !loadingDashboard ? (
          <TouchableOpacity style={styles.retryButton} onPress={loadDashboard}>
            <Text style={styles.retryText}>Analytics unavailable · Tap to retry</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {dashboard && (
        <>
          <Text style={styles.sectionTitle}>Products & inventory</Text>
          <View style={styles.snapshotCard}>
            <View style={styles.snapshotRow}>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotValue}>{dashboard.products?.total || 0}</Text>
                <Text style={styles.snapshotLabel}>Products</Text>
              </View>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotValue}>{dashboard.products?.approved || 0}</Text>
                <Text style={styles.snapshotLabel}>Approved</Text>
              </View>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotValue}>{dashboard.products?.pending || 0}</Text>
                <Text style={styles.snapshotLabel}>Pending</Text>
              </View>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotRow}>
              <View style={styles.snapshotItem}>
                <Text style={styles.snapshotValue}>{dashboard.inventory?.unitsInStock || 0}</Text>
                <Text style={styles.snapshotLabel}>Units in stock</Text>
              </View>
              <View style={styles.snapshotItem}>
                <Text style={[styles.snapshotValue, (dashboard.inventory?.lowStock || 0) > 0 && styles.warningText]}>
                  {dashboard.inventory?.lowStock || 0}
                </Text>
                <Text style={styles.snapshotLabel}>Low stock</Text>
              </View>
              <View style={styles.snapshotItem}>
                <Text style={[styles.snapshotValue, (dashboard.inventory?.outOfStock || 0) > 0 && styles.dangerText]}>
                  {dashboard.inventory?.outOfStock || 0}
                </Text>
                <Text style={styles.snapshotLabel}>Out of stock</Text>
              </View>
            </View>
            <View style={styles.inventoryValueRow}>
              <Text style={styles.inventoryValueLabel}>Inventory value</Text>
              <Text style={styles.inventoryValue}>{formatPrice(dashboard.inventory?.value || 0)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Earnings & operations</Text>
          <View style={styles.financeCard}>
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Available balance</Text>
              <Text style={styles.financePrimary}>{formatPrice(dashboard.payouts?.available || 0)}</Text>
            </View>
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Paid out</Text>
              <Text style={styles.financeValue}>{formatPrice(dashboard.payouts?.paidOut || 0)}</Text>
            </View>
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Pending payout</Text>
              <Text style={styles.financeValue}>{formatPrice(dashboard.payouts?.pending || 0)}</Text>
            </View>
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Pending orders</Text>
              <Text style={styles.financeValue}>{dashboard.orders?.pending || 0}</Text>
            </View>
            <View style={styles.financeRow}>
              <Text style={styles.financeLabel}>Ready fulfillments</Text>
              <Text style={styles.financeValue}>{dashboard.products?.readyFulfillments || 0}</Text>
            </View>
          </View>

          {dashboard.recentOrders?.length > 0 && (
            <>
              <Text style={styles.sectionTitle}>Recent completed orders</Text>
              <View style={styles.recentCard}>
                {dashboard.recentOrders.map((order) => (
                  <View key={order._id} style={styles.recentRow}>
                    <View>
                      <Text style={styles.recentOrder}>Order #{String(order._id).slice(-6).toUpperCase()}</Text>
                      <Text style={styles.recentMeta}>{order.units} item(s) · {formatDate(order.completedAt)}</Text>
                    </View>
                    <Text style={styles.recentAmount}>{formatPrice(order.sales)}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      )}

      <Text style={styles.sectionTitle}>Products needing fulfillment</Text>
    </>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Company Fulfillment</Text>
          <Text style={styles.headerSubtitle}>{user?.name || "Company store"}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Icon name="sign-out" size={22} color="#2563eb" />
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={products}
          keyExtractor={(item) => item._id}
          renderItem={renderProduct}
          onRefresh={refreshDashboard}
          refreshing={loading || loadingDashboard}
          contentContainerStyle={styles.list}
          ListHeaderComponent={dashboardHeader}
          ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.empty}>No products need fulfillment near you right now.</Text></View>}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f8fafc" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    paddingTop: 48,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#1a1a1a" },
  headerSubtitle: { fontSize: 12, color: "#5a6c7d", marginTop: 2 },
  list: { padding: 16, paddingBottom: 40 },
  empty: { color: "#6b7280", textAlign: "center", padding: 24 },
  emptyCard: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb" },
  analyticsCard: { backgroundColor: "#fff", borderRadius: 8, padding: 16, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 20 },
  analyticsHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "#2563eb", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  analyticsTitle: { color: "#111827", fontSize: 18, fontWeight: "800", marginTop: 2 },
  periodRow: { gap: 6, paddingVertical: 16 },
  periodButton: { minWidth: 62, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: "#f3f4f6", alignItems: "center" },
  periodButtonActive: { backgroundColor: "#2563eb" },
  periodText: { color: "#4b5563", fontSize: 12, fontWeight: "700" },
  periodTextActive: { color: "#fff" },
  salesRow: { flexDirection: "row", gap: 10 },
  salesBlock: { flex: 1, backgroundColor: "#eff6ff", borderRadius: 8, padding: 12 },
  earningsBlock: { flex: 1, backgroundColor: "#ecfdf5", borderRadius: 8, padding: 12 },
  salesLabel: { color: "#1d4ed8", fontSize: 11, fontWeight: "700" },
  earningsLabel: { color: "#047857", fontSize: 11, fontWeight: "700" },
  salesValue: { color: "#1e3a8a", fontSize: 19, fontWeight: "800", marginTop: 4 },
  earningsValue: { color: "#065f46", fontSize: 19, fontWeight: "800", marginTop: 4 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  metricCard: { width: "31%", minHeight: 84, borderRadius: 8, backgroundColor: "#f9fafb", padding: 10, justifyContent: "space-between" },
  metricValue: { fontSize: 14, fontWeight: "800", marginTop: 6 },
  metricLabel: { color: "#6b7280", fontSize: 10, marginTop: 2 },
  retryButton: { backgroundColor: "#fef3c7", borderRadius: 8, padding: 12, marginTop: 4 },
  retryText: { color: "#92400e", fontSize: 12, fontWeight: "700", textAlign: "center" },
  sectionTitle: { color: "#111827", fontSize: 15, fontWeight: "800", marginBottom: 10 },
  snapshotCard: { backgroundColor: "#fff", borderRadius: 8, padding: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 20 },
  snapshotRow: { flexDirection: "row" },
  snapshotItem: { flex: 1, alignItems: "center", minHeight: 52, justifyContent: "center" },
  snapshotValue: { color: "#1f2937", fontSize: 18, fontWeight: "800" },
  snapshotLabel: { color: "#6b7280", fontSize: 10, marginTop: 3, textAlign: "center" },
  snapshotDivider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 10 },
  warningText: { color: "#d97706" },
  dangerText: { color: "#dc2626" },
  inventoryValueRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, marginTop: 10 },
  inventoryValueLabel: { color: "#6b7280", fontSize: 12 },
  inventoryValue: { color: "#111827", fontSize: 14, fontWeight: "800" },
  financeCard: { backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 20 },
  financeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 44, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  financeLabel: { color: "#6b7280", fontSize: 12 },
  financePrimary: { color: "#059669", fontSize: 15, fontWeight: "800" },
  financeValue: { color: "#1f2937", fontSize: 13, fontWeight: "700" },
  recentCard: { backgroundColor: "#fff", borderRadius: 8, paddingHorizontal: 14, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 20 },
  recentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", minHeight: 58, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  recentOrder: { color: "#1f2937", fontSize: 12, fontWeight: "700" },
  recentMeta: { color: "#9ca3af", fontSize: 10, marginTop: 3 },
  recentAmount: { color: "#059669", fontSize: 13, fontWeight: "800" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eef2f7",
  },
  name: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  detail: { fontSize: 12, color: "#5a6c7d", marginTop: 2 },
  actions: { flexDirection: "row", gap: 10, marginTop: 12 },
  readyButton: {
    flex: 1,
    backgroundColor: "#059669",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  rejectButton: {
    flex: 1,
    backgroundColor: "#b91c1c",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontWeight: "700" },
});

export default CompanyStoreDashboard;
