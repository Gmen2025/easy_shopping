import React, { useState, useCallback, useContext } from "react";
import { View, FlatList, Text } from "react-native";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import UserOrderDisplay from "../../Shared/UserOrderDisplay";

import OrderCard from "../../Shared/OrderCard";
import { AuthContext } from "../../Context/store/Auth";

const Orders = (props) => {
  const [orderList, setOrderList] = useState();
  const [isRefreshing, setIsRefreshing] = useState(false);
  //const [userOrderData, setUserOrderData] = useState([]);
  //const [token, setToken] = useState();

  const context = useContext(AuthContext);

  useFocusEffect(
    useCallback(() => {
      getOrders();
      //fetchOrderItems();
      return () => {
        setOrderList();
      };
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
      
      // Check and auto-delete old delivered orders (optional)
      await cleanupOldDeliveredOrders(orders, tokenValue);
    } catch (error) {
      console.log(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const cleanupOldDeliveredOrders = async (orders, token) => {
    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    
    const ordersToDelete = orders.filter((order) => {
      if (order.status === "1") { // Delivered status
        const orderDate = new Date(order.dateOrdered);
        return orderDate < twoMonthsAgo;
      }
      return false;
    });

    // Uncomment to enable automatic deletion
    for (const order of ordersToDelete) {
      try {
        await axios.delete(`${baseUrl}orders/${order._id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        console.log(`Auto-deleted order ${order._id}`);
      } catch (error) {
        console.log(`Failed to auto-delete order ${order._id}:`, error.message);
      }
    }

    if (ordersToDelete.length > 0) {
      console.log(`Found ${ordersToDelete.length} orders eligible for auto-deletion`);
    }
  };

  const handleDeleteOrder = (orderId) => {
    setOrderList((prevOrders) => prevOrders.filter((order) => order._id !== orderId));
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={orderList}
        renderItem={({ item }) => (
          <View style={styles.orderDetails}>
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
      />
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
  },
  orderDetails: {
    marginTop: 20,
    borderStyle: "solid",
    borderRadius: 20,
    borderColor: "grey",
    borderWidth: 5,
  },
};

export default Orders;
