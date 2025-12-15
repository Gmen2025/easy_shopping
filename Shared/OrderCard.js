import React, { useEffect, useState, useContext } from "react";
import { View, Text, StyleSheet, Alert } from "react-native";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/FontAwesome";
import TrafficLight from "./StyledComponenets/TrafficLight";
import EasyButton from "./StyledComponenets/EasyButton";
import Toast from "react-native-toast-message";
import { Avatar } from "react-native-paper";
import UserOrderDisplay from "./UserOrderDisplay";

import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import baseUrl from "../assets/common/baseUrl";
import { AuthContext } from "../Context/store/Auth";
import UserOrderItems from "./UserOrderItems";

const OrderCard = (props) => {
  const context = useContext(AuthContext);

  //console.log("context value in order card", context);
  //console.log("props value in order card", props);

  const [orderStatus, setOrderStatus] = useState();
  const [statusText, setStatusText] = useState();
  const [statusChange, setStatusChange] = useState();
  const [token, setToken] = useState();
  const [cardColor, setCardColor] = useState();
  const [orderItemValues, setOrderItemValues] = useState([]);

  const order = props.order || {};

  //const order = props.route.params?.order || {};

  useEffect(() => {
    if (props.editMode) {
      AsyncStorage.getItem("token")
        .then((res) => {
          setToken(res);
        })
        .catch((error) => console.log(error));
    }

    //fetchOrderItems();

    if (props.status == "3") {
      setOrderStatus(<TrafficLight unavailable></TrafficLight>);
      setStatusText("pending");
      setCardColor("#E74C3C");
    } else if (props.status == "2") {
      setOrderStatus(<TrafficLight limited></TrafficLight>);
      setStatusText("shipped");
      setCardColor("#F1C40F");
    } else {
      setOrderStatus(<TrafficLight available></TrafficLight>);
      setStatusText("delivered");
      setCardColor("#2ECC71");
    }

    return () => {
      setOrderStatus();
      setStatusText();
      setCardColor();
      //fetchOrderItems();
    };
  }, []);

  const updateOrder = () => {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const order = {
      city: props.city,
      country: props.country,
      dateOrdered: props.dateOrdered,
      id: props._id,
      orderItems: props.orderItems,
      phone: props.phone,
      shippingAddress1: props.shippingAddress1,
      shippingAddress2: props.shippingAddress2,
      status: statusChange,
      totalPrice: props.totalPrice,
      user: props.user,
      zip: props.zip,
    };

    axios
      .put(`${baseUrl}orders/${props._id}`, order, config)
      .then((res) => {
        if (res.status == 200 || res.status == 201) {
          Toast.show({
            topOffset: 60,
            type: "success",
            text1: "order edited",
            text2: "Thank you for your purchase",
          });
          setTimeout(() => {
            props.navigation.navigate("Products");
          }, 500); // Simulate a delay for placing the order
        }
      })
      .catch((error) => {
        console.log(
          "Order submit error:",
          error.response?.data || error.message
        );
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Something went wrong",
          text2: "Please try again",
        });
      });
  };

  const confirmDeleteOrder = () => {
    Alert.alert(
      "Delete Order",
      "Are you sure you want to delete this order? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => deleteOrder(),
        },
      ],
      { cancelable: true }
    );
  };

  const deleteOrder = async () => {
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    try {
      const response = await axios.delete(
        `${baseUrl}orders/${props._id}`,
        config
      );

      if (response.status === 200) {
        Toast.show({
          topOffset: 60,
          type: "success",
          text1: "Order deleted",
          text2: "Order has been successfully deleted",
        });

        // Refresh the orders list if callback provided
        if (props.onDelete) {
          props.onDelete(props._id);
        }

        setTimeout(() => {
          props.navigation.navigate("Products");
        }, 500);
      }
    } catch (error) {
      console.log("Order delete error:", error.response?.data || error.message);
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Delete failed",
        text2: error.response?.data?.message || "Could not delete order",
      });
    }
  };

  // Check if order should be auto-deleted (delivered + 2 months old)
  const shouldAutoDelete = () => {
    if (props.status === "1" && props.dateOrdered) {
      // status 1 = delivered
      const orderDate = new Date(props.dateOrdered);
      const twoMonthsAgo = new Date();
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      return orderDate < twoMonthsAgo;
    }
    return false;
  };

  useEffect(() => {
    // Check for auto-deletion on mount
    if (props.editMode && shouldAutoDelete()) {
      console.log(`Order ${props._id} is eligible for auto-deletion`);
      // You can uncomment this to enable automatic deletion
      autoDeleteOrder();
    }
  }, [props.status, props.dateOrdered]);

  const autoDeleteOrder = async () => {
    if (!token) return;

    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    try {
      await axios.delete(`${baseUrl}orders/${props._id}`, config);
      console.log(`Auto-deleted order ${props._id}`);

      if (props.onDelete) {
        props.onDelete(props._id);
      }
    } catch (error) {
      console.log("Auto-delete error:", error.response?.data || error.message);
    }
  };

  return (
    <View style={[styles.container]}>
      <View style={styles.container}>
        <Text>Order Number: #{props._id}</Text>
      </View>
      <View style={{ marginTop: 10 }}>
        <Text style={styles.label}>
          Status: {statusText} {orderStatus}
        </Text>
        <Text style={styles.label}>
          Date Ordered: {props.dateOrdered.split("T")[0]}
        </Text>
        {props.editMode && (
          <>
            <Text>User: {props.user?.name || "N/A"}</Text>
            <Text>Email: {props.user?.email || "N/A"}</Text>
            <Text>Phone: {props.phone || "N/A"}</Text>
          </>
        )}
        <Text>Address1: {props.shippingAddress1 || "N/A"} </Text>
        <Text>Address2: {props.shippingAddress2 || "N/A"}</Text>
        <Text>Zip: {props.zip || "N/A"}</Text>
        <Text>City: {props.city || "N/A"}</Text>
        <Text>Country: {props.country || "N/A"}</Text>
        <Text variant="bodyLarge" style={styles.label}>
          Order Items: {props.orderItems}
        </Text>
        <UserOrderItems orderId={props._id} />
        <View style={styles.priceContainer}>
          <Text>Total Price: </Text>
          <Text style={styles.price}>ETB {props.totalPrice}</Text>
        </View>
        {props.editMode ? (
          <View>
            <Picker
              selectedValue={statusChange}
              style={{
                height: 200,
                width: "100%",
                backgroundColor: "#fff",
                color: "#000",
                marginTop: 10,
                borderWidth: 1,
                borderColor: "#333",
              }}
              onValueChange={(itemValue) => setStatusChange(itemValue)}
            >
              <Picker.Item label="Select Status" value="" />
              <Picker.Item label="Pending" value="3" />
              <Picker.Item label="Shipped" value="2" />
              <Picker.Item label="Delivered" value="1" />
            </Picker>
            <View style={styles.buttonContainer}>
              <EasyButton tertiary large onPress={() => updateOrder()}>
                <Text style={{ color: "white" }}>Update</Text>
              </EasyButton>

              <EasyButton
                danger
                large
                onPress={() => confirmDeleteOrder()}
                style={{ marginTop: 10 }}
              >
                <Text style={{ color: "white" }}>Delete Order</Text>
              </EasyButton>
            </View>
            {shouldAutoDelete() && (
              <View style={styles.autoDeleteWarning}>
                <Icon name="exclamation-triangle" size={16} color="#E74C3C" />
                <Text style={styles.autoDeleteText}>
                  This delivered order is over 2 months old and eligible for
                  auto-deletion
                </Text>
              </View>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    margin: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#d1d1d1",
    backgroundColor: "#fff",
  },
  title: {
    backgroundColor: "#B1F6",
    padding: 5,
  },
  priceContainer: {
    marginTop: 10,
    alignSelf: "flex-end",
    flexDirection: "row",
  },
  price: {
    color: "#000",
    fontWeight: "bold",
  },
  label: {
    fontWeight: "bold",
    marginTop: 10,
  },
  autoDeleteWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF3CD",
    padding: 10,
    marginTop: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: "#FFC107",
  },
  autoDeleteText: {
    marginLeft: 10,
    color: "#856404",
    fontSize: 12,
    flex: 1,
  },
  buttonContainer: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10, 
  },
});

export default OrderCard;
