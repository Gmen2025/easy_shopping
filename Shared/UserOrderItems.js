import React, { useState, useEffect } from "react";
import { View, Text, Image, StyleSheet } from "react-native";

import axios from "axios";
import baseUrl from "../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";

const UserOrderItems = (props) => {
  const [orderItems, setOrderItems] = useState([]);
  const [token, setToken] = useState();

  const orderId = props.orderId || props._id;

  useEffect(() => {
    if (!orderId) {
      console.log("No order ID provided to fetch order items.");
      return;
    }

   const fetchOrderItems = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const config = token
        ? { headers: { Authorization: `Bearer ${token}` } }
        : {};
      const response = await axios.get(`${baseUrl}orders/${orderId}`, config);
      console.log("Fetched order items:", response.data);
      setOrderItems(response.data.orderItems || []);
    } catch (error) {
      console.error("Error fetching order items:", error);
    }
  };


    fetchOrderItems();
  }, [orderId]);

  return (
    <View style={styles.container}>
      {orderItems.length > 0 ? (
        orderItems.map((item, idx) => (
          <View key={item._id || idx} style={styles.itemRow}>
            <Image
              source={{
                uri:
                  item.product?.image ||
                  "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
              }}
              style={styles.thumbnail}
            />
            <View style={styles.itemDetails}>
              <Text style={styles.itemName}>{item.product?.name}</Text>
              <Text>Qty: {item.quantity || 1}</Text>
              <Text>
                Price: $
                {item.product?.price?.toFixed(2)}
              </Text>
              <Text>Subtotal: $ {(item.product?.price * item.quantity).toFixed(2)}</Text>
            </View>
          </View>
        ))
      ) : (
        <Text style={styles.emptyMessage}>No items in this order.</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  thumbnail: {
    width: 50,
    height: 50,
    borderRadius: 5,
    marginRight: 12,
  },
  itemDetails: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: "500",
  },
  emptyMessage: {
    textAlign: "center",
    color: "#888",
  },
});

export default UserOrderItems;
