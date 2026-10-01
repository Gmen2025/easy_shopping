import React, { useCallback, useContext, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { AuthContext } from "../../Context/store/Auth";
import baseUrl from "../../assets/common/baseUrl";
import { useCurrency } from "../../assets/common/currency";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";

const INCOME_PERIODS = [
  { key: "daily", label: "24 Hours" },
  { key: "weekly", label: "7 Days" },
  { key: "monthly", label: "30 Days" },
  { key: "quarterly", label: "90 Days" },
  { key: "yearly", label: "365 Days" },
];

// Converts a driver-queue entry from GET /drivers/me/queue into expected navigation shape
const normalizeQueueEntry = (entry = {}) => {
  const dropZone = entry.dropZone || {};
  const approxCoordinates = dropZone.approxCoordinates;
  const storeCoordinates = entry.store?.location?.coordinates;
  const exactCoordinates = entry.address?.coordinates;

  return {
    id: entry.orderId,
    pickupStoreName: entry.store?.name || "Store",
    storeAddress: entry.store?.address || "",
    storeLocation: Array.isArray(storeCoordinates)
      ? { latitude: storeCoordinates[1], longitude: storeCoordinates[0] }
      : null,
    payout: entry.deliveryFee ? `${entry.deliveryFee}` : "",
    customerName: entry.customer?.name || "Customer",
    customerPhone: entry.customer?.phone || "",
    dropZoneLabel: [dropZone.city, dropZone.zip].filter(Boolean).join(", ") || "Nearby area",
    approxDropLocation: Array.isArray(approxCoordinates)
      ? { latitude: approxCoordinates[1], longitude: approxCoordinates[0] }
      : null,
    customerLocation: Array.isArray(exactCoordinates)
      ? { latitude: exactCoordinates[1], longitude: exactCoordinates[0] }
      : null,
    fullAddress: entry.dropoffRevealed
      ? [entry.address?.address1, entry.address?.address2, entry.address?.city].filter(Boolean).join(", ")
      : "",
    revealed: Boolean(entry.dropoffRevealed),
    deliveryStatus: entry.deliveryStatus,
    itemCount: entry.itemCount || 0,
    items: entry.items || [],
    rawPayload: entry,
  };
};

const CompanyDriverDashboard = ({ navigation }) => {
  const { logout, user } = useContext(AuthContext);
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState([]);
  const [queue, setQueue] = useState([]);
  const [completedToday, setCompletedToday] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState("daily");
  const [loading, setLoading] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [actingId, setActingId] = useState("");

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}orders/company/my-deliveries`, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setOrders(Array.isArray(response.data?.orders) ? response.data.orders : []);
    } catch (error) {
      Alert.alert("Unable to load deliveries", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}drivers/me/queue`, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setQueue(Array.isArray(response.data?.queue) ? response.data.queue : []);
    } catch (error) {
      Alert.alert("Unable to load active deliveries", error?.response?.data?.message || "Please try again.");
    } finally {
      setLoadingQueue(false);
    }
  }, []);

  const loadCompletedToday = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}drivers/me/completed-today`, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setCompletedToday(Array.isArray(response.data?.orders) ? response.data.orders : []);
    } catch (error) {
      // Non-critical background fetch
    }
  }, []);

  const loadDashboard = useCallback(async () => {
    setLoadingDashboard(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      const response = await axios.get(`${baseUrl}drivers/me/dashboard`, {
        headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb },
      });
      setDashboard(response.data || null);
    } catch (error) {
      setDashboard(null);
    } finally {
      setLoadingDashboard(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadOrders();
      loadQueue();
      loadCompletedToday();
      loadDashboard();
    }, [loadOrders, loadQueue, loadCompletedToday, loadDashboard])
  );

  const claimOrder = async (order) => {
    setActingId(order._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      await axios.put(
        `${baseUrl}orders/${order._id}/company-claim`,
        {},
        { headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb } }
      );
      Alert.alert("Delivery claimed", "This delivery is now assigned to you.");
      setOrders((current) => current.filter((item) => item._id !== order._id));
      loadQueue();
    } catch (error) {
      Alert.alert("Unable to claim", error?.response?.data?.message || "Please try again.");
    } finally {
      setActingId("");
    }
  };

  const rejectOrder = async (order) => {
    setActingId(order._id);
    try {
      const token = await AsyncStorage.getItem("token");
      const currentDb = await getDatabaseNameFromStorage();
      await axios.put(
        `${baseUrl}orders/${order._id}/company-reject`,
        {},
        { headers: { Authorization: `Bearer ${token}`, "x-database-name": currentDb } }
      );
      setOrders((current) => current.filter((item) => item._id !== order._id));
    } catch (error) {
      Alert.alert("Unable to reject", error?.response?.data?.message || "Please try again.");
    } finally {
      setActingId("");
    }
  };

  const formatItemsSummary = (items = []) =>
    items.map((entry) => `${entry.quantity || 1}x ${entry.name}`).join(", ");

  const formatDropoffAddress = (dropoffAddress) => {
    if (!dropoffAddress) return "";
    return [dropoffAddress.address1, dropoffAddress.address2, dropoffAddress.city, dropoffAddress.zip]
      .filter(Boolean)
      .join(", ");
  };

  const startRoute = (queueEntry) => {
    const request = normalizeQueueEntry(queueEntry);
    navigation.navigate("DeliveryRoute", {
      request,
      orderStatus: queueEntry.deliveryStatus,
      exitRouteName: "CompanyDriverHome",
    });
  };

  const selectedSummary = dashboard?.periods?.[selectedPeriod] || {
    income: 0,
    deliveries: 0,
    averageFee: 0,
    distanceKm: 0,
  };

  const formatCompletedDate = (value) => {
    if (!value) return "";
    return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  const renderOrder = (item) => {
    const dropoffStr =
      formatDropoffAddress(item.dropoffAddress) ||
      [item.dropZone?.city, item.dropZone?.zip].filter(Boolean).join(", ") ||
      "Address on dispatch";
      
    const phone = item.customerPhone || item.customer?.phone || item.dropoffAddress?.phone;

    return (
      <View key={item._id} style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.orderBadge}>Order #{String(item._id).slice(-6).toUpperCase()}</Text>
          <Text style={styles.payoutText}>Fee: {formatPrice(item.deliveryFee || 0)}</Text>
        </View>

        {/* Pickup Info */}
        <View style={styles.addressSection}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>📍</Text>
          </View>
          <View style={styles.addressContent}>
            <Text style={styles.sectionLabel}>PICKUP LOCATION</Text>
            <Text style={styles.locationTitle}>{item.store?.name || "Store"}</Text>
            {Boolean(item.store?.address) && (
              <Text style={styles.addressSubtext}>{item.store.address}</Text>
            )}
          </View>
        </View>

        <View style={styles.divider} />

        {/* Dropoff Info */}
        <View style={styles.addressSection}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>🏁</Text>
          </View>
          <View style={styles.addressContent}>
            <Text style={styles.sectionLabel}>DROP-OFF LOCATION</Text>
            <Text style={styles.locationTitle}>{dropoffStr}</Text>
            {Boolean(phone) && (
              <View style={styles.phoneRow}>
                <Text style={styles.phoneIcon}>📞</Text>
                <Text style={styles.phoneText}>{phone}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Item Summary */}
        <View style={styles.itemSummaryContainer}>
          <Text style={styles.itemCountText}>
            📦 {item.itemCount || item.items?.length || 0} Item(s)
          </Text>
          {Boolean(item.items?.length) && (
            <Text style={styles.itemListText} numberOfLines={2}>
              {formatItemsSummary(item.items)}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.cardActionsRow}>
          <TouchableOpacity
            style={styles.rejectBtn}
            disabled={actingId === item._id}
            onPress={() => rejectOrder(item)}
          >
            <Text style={styles.rejectBtnText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.claimBtn}
            disabled={actingId === item._id}
            onPress={() => claimOrder(item)}
          >
            {actingId === item._id ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.claimBtnText}>Claim Delivery</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderQueueItem = (item, index) => {
    const dropoffStr =
      item.dropoffRevealed && item.address
        ? [item.address.address1, item.address.address2, item.address.city, item.address.zip].filter(Boolean).join(", ")
        : [item.dropZone?.city, item.dropZone?.zip].filter(Boolean).join(", ") || "Nearby area";

    const phone = item.customerPhone || item.customer?.phone || item.address?.phone;

    return (
      <View key={item.orderId} style={styles.activeCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.activeOrderBadge}>STOP #{index + 1} · ORDER #{String(item.orderId).slice(-6).toUpperCase()}</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusPillText}>{item.deliveryStatus || "In Progress"}</Text>
          </View>
        </View>

        <View style={styles.addressSection}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>📍</Text>
          </View>
          <View style={styles.addressContent}>
            <Text style={styles.sectionLabel}>PICKUP</Text>
            <Text style={styles.locationTitle}>{item.store?.name || "Store"}</Text>
            {Boolean(item.store?.address) && (
              <Text style={styles.addressSubtext}>{item.store.address}</Text>
            )}
          </View>
        </View>

        <View style={styles.dividerLight} />

        <View style={styles.addressSection}>
          <View style={styles.iconContainer}>
            <Text style={styles.iconText}>🏁</Text>
          </View>
          <View style={styles.addressContent}>
            <Text style={styles.sectionLabel}>DROP-OFF</Text>
            <Text style={styles.locationTitle}>{dropoffStr}</Text>
            {Boolean(phone) && (
              <View style={styles.phoneRow}>
                <Text style={styles.phoneIcon}>📞</Text>
                <Text style={styles.phoneText}>{phone}</Text>
              </View>
            )}
          </View>
        </View>

        <TouchableOpacity style={styles.routeBtn} onPress={() => startRoute(item)}>
          <Text style={styles.routeBtnText}>
            {item.deliveryStatus === "Picked Up" ? "Route to Delivery ➔" : "Route to Pickup ➔"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header Block */}
        <View style={styles.headerCard}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.headerTitle}>Delivery Dispatch</Text>
              <Text style={styles.headerDriverName}>{user?.name || "Company Driver"}</Text>
            </View>
            <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
              <Text style={styles.logoutText}>Sign out</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.badgeRow}>
            <View style={[styles.badge, queue.length > 0 && styles.badgeActive]}>
              <Text style={styles.badgeText}>{queue.length} Active Route(s)</Text>
            </View>
            <View style={[styles.badge, orders.length > 0 && styles.badgePending]}>
              <Text style={styles.badgeText}>{orders.length} Unassigned</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.refreshLink}
            onPress={() => {
              loadOrders();
              loadQueue();
              loadCompletedToday();
              loadDashboard();
            }}
          >
            <Text style={styles.refreshLinkText}>
              {loading || loadingQueue ? "Refreshing..." : "🔄 Refresh Data"}
            </Text>
          </TouchableOpacity>
        </View>

        {loading || loadingQueue ? (
          <ActivityIndicator color="#8a6c09" size="large" style={{ marginTop: 32 }} />
        ) : (
          <>
            <View style={styles.incomeCard}>
              <View style={styles.incomeHeadingRow}>
                <View>
                  <Text style={styles.incomeEyebrow}>DELIVERY INCOME</Text>
                  <Text style={styles.incomeTitle}>Earnings overview</Text>
                </View>
                {loadingDashboard && <ActivityIndicator color="#8A6C09" size="small" />}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.periodRow}
              >
                {INCOME_PERIODS.map((period) => (
                  <TouchableOpacity
                    key={period.key}
                    style={[
                      styles.periodButton,
                      selectedPeriod === period.key && styles.periodButtonActive,
                    ]}
                    onPress={() => setSelectedPeriod(period.key)}
                  >
                    <Text
                      style={[
                        styles.periodButtonText,
                        selectedPeriod === period.key && styles.periodButtonTextActive,
                      ]}
                    >
                      {period.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {dashboard ? (
                <>
                  <Text style={styles.incomeAmount}>{formatPrice(selectedSummary.income)}</Text>
                  <Text style={styles.incomeCaption}>
                    {selectedSummary.deliveries} completed deliver{selectedSummary.deliveries === 1 ? "y" : "ies"}
                  </Text>

                  <View style={styles.metricsGrid}>
                    <View style={styles.incomeMetric}>
                      <Text style={styles.incomeMetricValue}>{selectedSummary.deliveries}</Text>
                      <Text style={styles.incomeMetricLabel}>Deliveries</Text>
                    </View>
                    <View style={styles.incomeMetric}>
                      <Text style={styles.incomeMetricValue}>{formatPrice(selectedSummary.averageFee)}</Text>
                      <Text style={styles.incomeMetricLabel}>Average fee</Text>
                    </View>
                    <View style={styles.incomeMetric}>
                      <Text style={styles.incomeMetricValue}>{Number(selectedSummary.distanceKm || 0).toFixed(1)} km</Text>
                      <Text style={styles.incomeMetricLabel}>Distance</Text>
                    </View>
                    <View style={styles.incomeMetric}>
                      <Text style={styles.incomeMetricValue}>{queue.length}</Text>
                      <Text style={styles.incomeMetricLabel}>Active now</Text>
                    </View>
                  </View>

                  {dashboard.recentDeliveries?.length > 0 && (
                    <View style={styles.recentSection}>
                      <Text style={styles.recentTitle}>Recent completions</Text>
                      {dashboard.recentDeliveries.map((item) => (
                        <View key={item._id} style={styles.recentRow}>
                          <View style={styles.recentDetails}>
                            <Text style={styles.recentStore} numberOfLines={1}>{item.storeName}</Text>
                            <Text style={styles.recentMeta}>
                              #{String(item._id).slice(-6).toUpperCase()} · {formatCompletedDate(item.deliveredAt)}
                            </Text>
                          </View>
                          <Text style={styles.recentAmount}>{formatPrice(item.deliveryFee)}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                </>
              ) : !loadingDashboard ? (
                <TouchableOpacity style={styles.analyticsRetry} onPress={loadDashboard}>
                  <Text style={styles.analyticsRetryText}>Income data unavailable · Tap to retry</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Completed Today Banner */}
            {completedToday.length > 0 && (
              <View style={styles.completedCard}>
                <Text style={styles.completedTitle}>Completed Today ({completedToday.length})</Text>
                {completedToday.map((item) => (
                  <Text key={item._id} style={styles.completedText}>
                    ✓ Order #{String(item._id).slice(-6).toUpperCase()} · {item.storeName || "Store"}
                  </Text>
                ))}
              </View>
            )}

            {/* Active Queue Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeaderTitle}>Your Route ({queue.length})</Text>
              {queue.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.helperText}>No active deliveries assigned to your queue.</Text>
                </View>
              ) : (
                queue.map((item, index) => renderQueueItem(item, index))
              )}
            </View>

            {/* Unassigned Deliveries Section */}
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionHeaderTitle}>Unassigned Deliveries Nearby</Text>
              {orders.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.helperText}>No unassigned deliveries nearby right now.</Text>
                </View>
              ) : (
                orders.map((item) => renderOrder(item))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F4F5F7",
  },
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  headerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  headerDriverName: {
    fontSize: 20,
    fontWeight: "800",
    color: "#111827",
    marginTop: 2,
  },
  logoutBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
  },
  logoutText: {
    color: "#EF4444",
    fontWeight: "700",
    fontSize: 13,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 16,
    gap: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  badgeActive: {
    backgroundColor: "#E0F2FE",
  },
  badgePending: {
    backgroundColor: "#FEF3C7",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1F2937",
  },
  refreshLink: {
    marginTop: 16,
    alignSelf: "flex-start",
  },
  refreshLinkText: {
    color: "#8A6C09",
    fontWeight: "700",
    fontSize: 13,
  },
  completedCard: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  completedTitle: {
    fontWeight: "700",
    color: "#065F46",
    fontSize: 14,
    marginBottom: 4,
  },
  completedText: {
    color: "#047857",
    fontSize: 13,
    marginTop: 2,
  },
  incomeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  incomeHeadingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  incomeEyebrow: {
    color: "#8A6C09",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
  incomeTitle: {
    color: "#111827",
    fontSize: 18,
    fontWeight: "800",
    marginTop: 2,
  },
  periodRow: {
    gap: 6,
    paddingVertical: 16,
  },
  periodButton: {
    minWidth: 62,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  periodButtonActive: {
    backgroundColor: "#8A6C09",
  },
  periodButtonText: {
    color: "#4B5563",
    fontSize: 12,
    fontWeight: "700",
  },
  periodButtonTextActive: {
    color: "#FFFFFF",
  },
  incomeAmount: {
    color: "#111827",
    fontSize: 30,
    fontWeight: "800",
  },
  incomeCaption: {
    color: "#6B7280",
    fontSize: 13,
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 18,
  },
  incomeMetric: {
    width: "48%",
    minHeight: 68,
    backgroundColor: "#F9FAFB",
    borderRadius: 8,
    padding: 10,
    justifyContent: "center",
  },
  incomeMetricValue: {
    color: "#1F2937",
    fontSize: 15,
    fontWeight: "800",
  },
  incomeMetricLabel: {
    color: "#6B7280",
    fontSize: 11,
    marginTop: 3,
  },
  recentSection: {
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    marginTop: 18,
    paddingTop: 14,
  },
  recentTitle: {
    color: "#374151",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 4,
  },
  recentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  recentDetails: {
    flex: 1,
    paddingRight: 12,
  },
  recentStore: {
    color: "#1F2937",
    fontSize: 13,
    fontWeight: "700",
  },
  recentMeta: {
    color: "#9CA3AF",
    fontSize: 11,
    marginTop: 2,
  },
  recentAmount: {
    color: "#047857",
    fontSize: 13,
    fontWeight: "800",
  },
  analyticsRetry: {
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    padding: 12,
    marginTop: 16,
  },
  analyticsRetryText: {
    color: "#92400E",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  sectionContainer: {
    marginBottom: 20,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  activeCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  orderBadge: {
    fontSize: 12,
    fontWeight: "800",
    color: "#8A6C09",
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    letterSpacing: 0.5,
  },
  activeOrderBadge: {
    fontSize: 12,
    fontWeight: "800",
    color: "#92400E",
    letterSpacing: 0.5,
  },
  payoutText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#059669",
  },
  statusPill: {
    backgroundColor: "#FDE68A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#92400E",
  },
  addressSection: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 4,
  },
  iconContainer: {
    marginRight: 10,
    marginTop: 2,
  },
  iconText: {
    fontSize: 16,
  },
  addressContent: {
    flex: 1,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  locationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    lineHeight: 18,
  },
  addressSubtext: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  phoneIcon: {
    fontSize: 12,
    marginRight: 4,
  },
  phoneText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#2563EB",
  },
  divider: {
    height: 1,
    backgroundColor: "#F3F4F6",
    marginVertical: 10,
  },
  dividerLight: {
    height: 1,
    backgroundColor: "#FEF3C7",
    marginVertical: 10,
  },
  itemSummaryContainer: {
    backgroundColor: "#F9FAFB",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
  },
  itemCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  itemListText: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rejectBtnText: {
    color: "#4B5563",
    fontWeight: "700",
    fontSize: 14,
  },
  claimBtn: {
    flex: 2,
    backgroundColor: "#8A6C09",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  claimBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  routeBtn: {
    backgroundColor: "#D97706",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 14,
  },
  routeBtnText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  helperText: {
    color: "#9CA3AF",
    fontSize: 13,
    textAlign: "center",
  },
});

export default CompanyDriverDashboard;
