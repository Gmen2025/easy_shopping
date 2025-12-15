import React, { useContext, useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Button,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Linking,
} from "react-native";
import OrderCard from "../../Shared/OrderCard";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import { useDispatch } from 'react-redux';
import { clearCart } from '../../store/cartSlice';

import { useFocusEffect } from "@react-navigation/native";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage"; //Store data in the device

import { AuthContext } from "../../Context/store/Auth";
import UserOrderDisplay from "../../Shared/UserOrderDisplay";

const UserProfile = (props) => {
  const context = useContext(AuthContext);
  const dispatch = useDispatch();

  const [orders, setOrders] = useState();
  const [token, setToken] = useState();

  useFocusEffect(
    useCallback(() => {
      //console.log("UserProfile mounted, isAuthenticated:", context.isAuthenticated);
      //console.log("Fetching user profile for:", context);
      //console.log("Context.user value: ", context.user);

      if (!context.isAuthenticated) {
        //  the Login screen replaces the current screen
        // and the user cannot go back to the previous screen
        // with the back button.
        props.navigation.navigate("Login");
        return;
      }

      AsyncStorage.getItem("token").then((res) => {
        //console.log("response value: ", res)
        setToken(res);
      });

      //Fetch orders
      axios
        .get(`${baseUrl}orders`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((res) => {
          const data = res.data;
          //console.log("response data: ", data);
          //const values = data.map((x) => x._id === context.user._id)
          //console.log("values; ", values)
          //console.log("data array values: ", data.user._id)
          const userOrders = data.filter(
            (order) => order.user && order.user._id === context.user._id
          );
          console.log("UserOrders value: ", userOrders);
          setOrders(userOrders);
        })
        .catch((error) => console.log("Orders data error: ", error));

      return () => {
        //setUserProfile();
        setOrders();
      };
    }, [context.isAuthenticated, token])
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.subContainer}>
        <Text style={{ fontSize: 20 }}>
          Name: {context.user ? context.user.name : ""}
        </Text>
        <View style={{ marginTop: 20 }}>
          <Text style={{ margin: 10 }}>
            Email: {context.user ? context.user.user : ""}
          </Text>
          <Text style={{ margin: 10 }}>
            Phone: {context.user ? context.user.phone : ""}
          </Text>
        </View>
         {/* Help & Support Section */}
        <View style={styles.supportSection}>
          <Text style={styles.supportTitle}>Help & Support</Text>
          <Text style={styles.supportSubtitle}>Need assistance? Contact us:</Text>
          
          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL('mailto:girma.m.halie19@gmail.com')}
          >
            <Text style={styles.contactLabel}>Email:</Text>
            <Text style={styles.contactValue}>girma.m.halie19@gmail.com</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.contactItem}
            onPress={() => Linking.openURL('tel:+251910588929')}
          >
            <Text style={styles.contactLabel}>Phone:</Text>
            <Text style={styles.contactValue}>+251 910 588 929</Text>
          </TouchableOpacity>

          <Text style={styles.supportHours}>Support Hours: Mon-Sat, 9 AM - 6 PM</Text>
        </View>
        <View style={{ marginTop: 20 }}>
          <View>
            <EasyButton
              tertiary
              large
               onPress={() => {
              dispatch(clearCart()); // Clear cart when logging out
              context.logout();
              props.navigation.navigate("Home");
            }}
            >
              <Text style={{ color: "white" }}>Sign Out</Text>
            </EasyButton>
          </View>
        </View>
        <View style={styles.order}>
          <Text style={{ fontSize: 20, textAlign: "center" }}>My Orders</Text>
          <View style={styles.order}>
            {orders && orders.length > 0 ? (
              orders.map((order) => <OrderCard key={order._id} {...order} />)
            ) : (
              <View>
                <Text>You have no orders</Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
  },
  subContainer: {
    alignItems: "center",
    marginTop: 60,
  },
  orderDetails: {
    marginTop: 20,
    borderStyle: "solid",
    borderRadius: 20,
    borderColor: "grey",
    borderWidth: 5,
  },
  order: {
    marginTop: 10,
    alignItem: "center",
    marginBottom: 10,
  },
  supportSection: {
    marginTop: 30,
    marginBottom: 20,
    padding: 20,
    backgroundColor: "#f9f9f9",
    borderRadius: 10,
    width: "90%",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  supportTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 5,
    textAlign: "center",
  },
  supportSubtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 15,
    textAlign: "center",
  },
  contactItem: {
    marginVertical: 10,
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#8a6c09",
  },
  contactLabel: {
    fontSize: 12,
    color: "#888",
    marginBottom: 3,
  },
  contactValue: {
    fontSize: 16,
    color: "#8a6c09",
    fontWeight: "600",
  },
  supportHours: {
    fontSize: 12,
    color: "#888",
    marginTop: 15,
    textAlign: "center",
    fontStyle: "italic",
  },
});

export default UserProfile;
