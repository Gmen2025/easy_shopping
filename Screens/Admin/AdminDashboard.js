import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";

import baseUrl from "../../assets/common/baseUrl";
import { useCurrency } from "../../assets/common/currency";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

const PERIODS = [
  { key: "daily", label: "Day" },
  { key: "weekly", label: "Week" },
  { key: "monthly", label: "Month" },
  { key: "quarterly", label: "Quarter" },
  { key: "yearly", label: "Year" },
];

const QUICK_ACTIONS = [
  { label: "Products", icon: "cube", route: "Products" },
  { label: "Orders", icon: "shopping-bag", route: "Orders" },
  { label: "Inventory", icon: "cubes", route: "LowStock" },
  { label: "Delivery", icon: "truck", route: "DeliverySettings" },
  { label: "Payouts", icon: "money", route: "Payouts" },
];

const AdminDashboard = ({ navigation }) => {
  const { formatPrice } = useCurrency();
  const [dashboard, setDashboard] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}orders/admin/dashboard`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-database-name": currentDb,
        },
      });
      setDashboard(response.data || null);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || "Unable to load sales analytics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const period = dashboard?.periods?.[selectedPeriod] || {
    totalSales: 0,
    productSales: 0,
    deliveryIncome: 0,
    orders: 0,
    completedOrders: 0,
    cancelledOrders: 0,
    paidOrders: 0,
    pendingPaymentOrders: 0,
    unitsSold: 0,
    deliveryDistanceKm: 0,
    averageOrder: 0,
    averageDeliveryFee: 0,
    paymentMethods: {},
  };

  const formatDate = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const renderSmallMetric = (label, value, color = "#1f2937") => (
    <View style={styles.smallMetric}>
      <Text style={[styles.smallMetricValue, { color }]} numberOfLines={1}>{value}</Text>
      <Text style={styles.smallMetricLabel}>{label}</Text>
    </View>
  );

  if (loading && !dashboard) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8a6c09" />
        <Text style={styles.loadingText}>Loading business analytics...</Text>
      </View>
    );
  }

  const paymentMethods = Object.entries(period.paymentMethods || {}).sort((left, right) => right[1] - left[1]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} tintColor="#8a6c09" />
      }
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>ADMIN CONTROL CENTER</Text>
          <Text style={styles.title}>Sales dashboard</Text>
          <Text style={styles.subtitle}>Completed order revenue and operations</Text>
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={() => loadDashboard(true)}>
          <Icon name="refresh" size={16} color="#8a6c09" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
        {PERIODS.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.periodButton, selectedPeriod === item.key && styles.periodButtonActive]}
            onPress={() => setSelectedPeriod(item.key)}
          >
            <Text style={[styles.periodText, selectedPeriod === item.key && styles.periodTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {error ? (
        <TouchableOpacity style={styles.errorBox} onPress={() => loadDashboard()}>
          <Icon name="exclamation-circle" size={16} color="#b91c1c" />
          <Text style={styles.errorText}>{error} Tap to retry.</Text>
        </TouchableOpacity>
      ) : null}

      {dashboard ? (
        <>
          <View style={styles.totalBand}>
            <Text style={styles.totalLabel}>Products + delivery</Text>
            <Text style={styles.totalValue}>{formatPrice(period.totalSales)}</Text>
            <Text style={styles.totalCaption}>{period.completedOrders} completed order(s)</Text>
          </View>

          <View style={styles.salesSplit}>
            <View style={styles.productSalesBox}>
              <Icon name="shopping-basket" size={18} color="#1d4ed8" />
              <Text style={styles.splitLabel}>Product sales</Text>
              <Text style={styles.productSalesValue}>{formatPrice(period.productSales)}</Text>
            </View>
            <View style={styles.deliverySalesBox}>
              <Icon name="truck" size={18} color="#047857" />
              <Text style={styles.splitLabel}>Delivery income</Text>
              <Text style={styles.deliverySalesValue}>{formatPrice(period.deliveryIncome)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Period performance</Text>
          <View style={styles.metricGrid}>
            {renderSmallMetric("Orders placed", period.orders)}
            {renderSmallMetric("Completed", period.completedOrders, "#047857")}
            {renderSmallMetric("Units sold", period.unitsSold)}
            {renderSmallMetric("Avg. order", formatPrice(period.averageOrder))}
            {renderSmallMetric("Avg. delivery", formatPrice(period.averageDeliveryFee))}
            {renderSmallMetric("Cancelled", period.cancelledOrders, period.cancelledOrders ? "#b91c1c" : "#1f2937")}
          </View>

          <Text style={styles.sectionTitle}>Payments</Text>
          <View style={styles.rowSection}>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Recorded paid orders</Text>
              <Text style={styles.dataValue}>{period.paidOrders}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Pending payment records</Text>
              <Text style={styles.dataValue}>{period.pendingPaymentOrders}</Text>
            </View>
            {paymentMethods.map(([method, amount]) => (
              <View key={method} style={styles.dataRow}>
                <Text style={styles.dataLabel}>{method}</Text>
                <Text style={styles.dataValue}>{formatPrice(amount)}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.sectionTitle}>Operations</Text>
          <View style={styles.metricGrid}>
            {renderSmallMetric("Outstanding orders", dashboard.operations?.outstandingOrders || 0)}
            {renderSmallMetric("Active deliveries", dashboard.operations?.activeDeliveries || 0, "#047857")}
            {renderSmallMetric("Products", dashboard.inventory?.products || 0)}
            {renderSmallMetric("Units in stock", dashboard.inventory?.unitsInStock || 0)}
            {renderSmallMetric("Low stock", dashboard.inventory?.lowStock || 0, "#d97706")}
            {renderSmallMetric("Out of stock", dashboard.inventory?.outOfStock || 0, "#b91c1c")}
          </View>

          <View style={styles.rowSection}>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Inventory value</Text>
              <Text style={styles.dataValue}>{formatPrice(dashboard.inventory?.value || 0)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Store payouts paid</Text>
              <Text style={styles.dataValue}>{formatPrice(dashboard.payouts?.paid || 0)}</Text>
            </View>
            <View style={styles.dataRow}>
              <Text style={styles.dataLabel}>Store payouts pending</Text>
              <Text style={styles.dataValue}>{formatPrice(dashboard.payouts?.pending || 0)}</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Lifetime recorded sales</Text>
          <View style={styles.lifetimeBand}>
            <View>
              <Text style={styles.lifetimeLabel}>Combined revenue</Text>
              <Text style={styles.lifetimeValue}>{formatPrice(dashboard.lifetime?.totalSales || 0)}</Text>
            </View>
            <Text style={styles.lifetimeOrders}>{dashboard.lifetime?.completedOrders || 0} orders</Text>
          </View>

          {dashboard.recentSales?.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Recent completed sales</Text>
              <View style={styles.rowSection}>
                {dashboard.recentSales.map((sale) => (
                  <View key={sale._id} style={styles.recentRow}>
                    <View style={styles.recentDetails}>
                      <Text style={styles.recentTitle}>Order #{String(sale._id).slice(-6).toUpperCase()}</Text>
                      <Text style={styles.recentMeta}>
                        Products {formatPrice(sale.productSales)} · Delivery {formatPrice(sale.deliveryIncome)} · {formatDate(sale.completedAt)}
                      </Text>
                    </View>
                    <Text style={styles.recentValue}>{formatPrice(sale.totalSales)}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </>
      ) : null}

      <Text style={styles.sectionTitle}>Manage</Text>
      <View style={styles.actionsRow}>
        {QUICK_ACTIONS.map((action) => (
          <TouchableOpacity
            key={action.route}
            style={styles.actionButton}
            onPress={() => navigation.navigate(action.route)}
          >
            <Icon name={action.icon} size={18} color="#8a6c09" />
            <Text style={styles.actionText}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f4f5f7" },
  content: { padding: 16, paddingBottom: 48 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f4f5f7" },
  loadingText: { color: "#6b7280", fontSize: 13, marginTop: 10 },
  header: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 },
  eyebrow: { color: "#8a6c09", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  title: { color: "#111827", fontSize: 24, fontWeight: "800", marginTop: 2 },
  subtitle: { color: "#6b7280", fontSize: 12, marginTop: 3 },
  refreshButton: { width: 38, height: 38, borderRadius: 8, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#e5e7eb" },
  periodRow: { gap: 6, paddingVertical: 16 },
  periodButton: { minWidth: 62, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: "#e5e7eb", alignItems: "center" },
  periodButtonActive: { backgroundColor: "#8a6c09" },
  periodText: { color: "#4b5563", fontSize: 12, fontWeight: "700" },
  periodTextActive: { color: "#fff" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fef2f2", borderWidth: 1, borderColor: "#fecaca", borderRadius: 8, padding: 12, marginBottom: 14 },
  errorText: { flex: 1, color: "#991b1b", fontSize: 12, fontWeight: "600" },
  totalBand: { backgroundColor: "#20242a", borderRadius: 8, padding: 18, marginBottom: 10 },
  totalLabel: { color: "#d1d5db", fontSize: 12, fontWeight: "700" },
  totalValue: { color: "#fff", fontSize: 30, fontWeight: "800", marginTop: 4 },
  totalCaption: { color: "#9ca3af", fontSize: 11, marginTop: 4 },
  salesSplit: { flexDirection: "row", gap: 10, marginBottom: 20 },
  productSalesBox: { flex: 1, minHeight: 104, backgroundColor: "#eff6ff", borderRadius: 8, padding: 13, justifyContent: "space-between" },
  deliverySalesBox: { flex: 1, minHeight: 104, backgroundColor: "#ecfdf5", borderRadius: 8, padding: 13, justifyContent: "space-between" },
  splitLabel: { color: "#4b5563", fontSize: 11, fontWeight: "700", marginTop: 7 },
  productSalesValue: { color: "#1e3a8a", fontSize: 18, fontWeight: "800" },
  deliverySalesValue: { color: "#065f46", fontSize: 18, fontWeight: "800" },
  sectionTitle: { color: "#111827", fontSize: 15, fontWeight: "800", marginBottom: 9, marginTop: 4 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  smallMetric: { width: "31%", minHeight: 72, backgroundColor: "#fff", borderRadius: 8, padding: 10, borderWidth: 1, borderColor: "#e5e7eb", justifyContent: "center" },
  smallMetricValue: { fontSize: 14, fontWeight: "800" },
  smallMetricLabel: { color: "#6b7280", fontSize: 10, marginTop: 4 },
  rowSection: { backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", paddingHorizontal: 14, marginBottom: 18 },
  dataRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  dataLabel: { flex: 1, color: "#6b7280", fontSize: 12 },
  dataValue: { color: "#1f2937", fontSize: 13, fontWeight: "700" },
  lifetimeBand: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#fff7ed", borderRadius: 8, padding: 14, marginBottom: 18, borderWidth: 1, borderColor: "#fed7aa" },
  lifetimeLabel: { color: "#9a3412", fontSize: 11, fontWeight: "700" },
  lifetimeValue: { color: "#7c2d12", fontSize: 20, fontWeight: "800", marginTop: 3 },
  lifetimeOrders: { color: "#9a3412", fontSize: 12, fontWeight: "700" },
  recentRow: { minHeight: 62, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  recentDetails: { flex: 1, paddingRight: 10 },
  recentTitle: { color: "#1f2937", fontSize: 12, fontWeight: "700" },
  recentMeta: { color: "#9ca3af", fontSize: 10, marginTop: 3 },
  recentValue: { color: "#047857", fontSize: 13, fontWeight: "800" },
  actionsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  actionButton: { width: "31%", minHeight: 70, backgroundColor: "#fff", borderRadius: 8, borderWidth: 1, borderColor: "#e5e7eb", alignItems: "center", justifyContent: "center" },
  actionText: { color: "#374151", fontSize: 11, fontWeight: "700", marginTop: 6 },
});

export default AdminDashboard;