import React, { useState, useCallback, useContext } from "react";
import {
  View,
  FlatList,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import OrderCard from "../../Shared/OrderCard";
import { AuthContext } from "../../Context/store/Auth";

const Orders = (props) => {
  const [orderList, setOrderList] = useState();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const context = useContext(AuthContext);

  useFocusEffect(
    useCallback(() => {
      getOrders();
      return () => setOrderList();
    }, [])
  );

  const getOrders = async () => {
    setIsRefreshing(true);
    const tokenValue = await AsyncStorage.getItem("token");
    try {
      const res = await axios.get(`${baseUrl}orders`, {
        headers: { Authorization: `Bearer ${tokenValue}` },
      });
      const orders = res.data;
      setOrderList(orders);
      await cleanupOldDeliveredOrders(orders, tokenValue);
    } catch (error) {
      console.log(error);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const cleanupOldDeliveredOrders = async (orders, token) => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const ordersToDelete = orders.filter(
      //Reminder-check the new status value and update
      (order) => order.status === "3" && new Date(order.dateOrdered) < twoMonthsAgo
    );
    for (const order of ordersToDelete) {
      try {
        await axios.delete(`${baseUrl}orders/${order._id}?notifyCustomer=true`, {
          headers: { Authorization: `Bearer ${token}` },
          data: {
            notifyCustomer: true,
            customerEmail: order?.user?.email || order?.customerEmail || null,
            customerName: order?.user?.name || null,
          },
        });
      } catch (error) {
        console.log(`Failed to auto-delete order ${order._id}:`, error.message);
      }
    }
  };

  const handleDeleteOrder = (orderId) => {
    setOrderList((prev) => prev.filter((o) => o._id !== orderId));
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Order Management</Text>
          <Text style={styles.headerSubtitle}>
            {orderList ? `${orderList.length} orders` : "Loading…"}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.broadcastBtn}
            onPress={() => props.navigation.navigate("BroadcastNotifications")}
          >
            <Icon name="bullhorn" size={14} color="#fff" />
            <Text style={styles.broadcastBtnText}>Broadcast</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.serviceBtn}
            onPress={() => props.navigation.navigate("ServiceRequestsAdmin")}
          >
            <Icon name="wrench" size={14} color="#fff" />
            <Text style={styles.serviceBtnText}>Services</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.refreshBtn} onPress={getOrders}>
            <Icon name="refresh" size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {loading ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="large" color="#8a6c09" />
          <Text style={styles.loadingText}>Loading orders…</Text>
        </View>
      ) : (
        <FlatList
          data={orderList}
          renderItem={({ item }) => (
            <View style={styles.cardWrapper}>
              <OrderCard
                navigation={props.navigation}
                {...item}
                editMode={true}
                onDelete={handleDeleteOrder}
              />
            </View>
          )}
          keyExtractor={(item) => item._id}
          refreshing={isRefreshing}
          onRefresh={getOrders}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Icon name="inbox" size={48} color="#c5cae9" />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          }
          ListFooterComponent={<View style={{ marginBottom: 80 }} />}
          contentContainerStyle={!orderList?.length ? { flex: 1 } : null}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6fa",
  },
  header: {
    backgroundColor: "#8a6c09",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    padding: 10,
    marginLeft: 10,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  broadcastBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  broadcastBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  serviceBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginLeft: 8,
  },
  serviceBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 6,
  },
  spinner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    marginTop: 10,
    color: "#9e9e9e",
    fontSize: 14,
  },
  cardWrapper: {
    marginHorizontal: 14,
    marginTop: 14,
    borderRadius: 14,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
  },
  emptyText: {
    color: "#9e9e9e",
    fontSize: 16,
    marginTop: 14,
  },
});

export default Orders;
