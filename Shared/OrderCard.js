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
import { useCurrency } from "../assets/common/currency";

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
  const { formatPrice } = useCurrency();
  const orderItemsCount = Array.isArray(props.orderItems)
    ? props.orderItems.length
    : 0;

  const formatOrderDateTime = (value) => {
    if (!value) {
      return "N/A";
    }

    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      return "N/A";
    }

    const months = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    const day = String(parsedDate.getDate()).padStart(2, "0");
    const month = months[parsedDate.getMonth()];
    const year = parsedDate.getFullYear();
    const hours = String(parsedDate.getHours()).padStart(2, "0");
    const minutes = String(parsedDate.getMinutes()).padStart(2, "0");

    return `${day} ${month} ${year}, ${hours}:${minutes}`;
  };

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
      setStatusText("delivered");
      setCardColor("#E74C3C");
      
    } else if (props.status == "2") {
      setOrderStatus(<TrafficLight limited></TrafficLight>);
      setStatusText("shipped");
      setCardColor("#F1C40F");
    } else {
      setOrderStatus(<TrafficLight available></TrafficLight>);
      setStatusText("processing");
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

  const getStatusLabel = (statusValue) => {
    if (statusValue === "1") return "Processing";
    if (statusValue === "2") return "Shipped";
    if (statusValue === "3") return "Delivered";
    return "Updated";
  };

  const sendManualNotification = async () => {
    if (!token) {
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Missing auth token",
        text2: "Please sign in again as admin",
      });
      return;
    }

    const userId = props.user?._id || props.user;
    if (!userId) {
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Customer not found",
        text2: "Order user is missing",
      });
      return;
    }

    const statusLabel = getStatusLabel(statusChange || props.status);
    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    const candidateRoutes = [
      "notifications/admin/send-user",
      "admin/notifications/send-user",
      "notifications/send",
    ];

    try {
      let response;
      let lastError;

      for (const route of candidateRoutes) {
        try {
          response = await axios.post(
            `${baseUrl}${route}`,
            {
              userId,
              title: "Order update",
              body: `Your order #${props._id} status is ${statusLabel}.`,
              data: {
                type: "admin_manual_order_update",
                orderId: String(props._id),
                status: statusLabel,
              },
            },
            config
          );
          break;
        } catch (error) {
          lastError = error;
          if (error?.response?.status !== 404) {
            throw error;
          }
        }
      }

      if (!response) {
        throw lastError || new Error("No notification route matched on backend");
      }

      const sentCount = response?.data?.sent || 0;
      const acceptedCount = response?.data?.accepted ?? sentCount;
      const failedCount = response?.data?.failed || 0;
      const firstTicketError = response?.data?.tickets?.find((ticket) => ticket?.status === "error");
      const ticketErrorMessage =
        firstTicketError?.details?.error ||
        firstTicketError?.message ||
        null;

      if (acceptedCount > 0) {
        Toast.show({
          topOffset: 60,
          type: "success",
          text1: "Notification sent",
          text2: `Accepted ${acceptedCount}/${sentCount} device(s)`,
        });
      } else if (failedCount > 0) {
        Toast.show({
          topOffset: 60,
          type: "error",
          text1: "Notification provider rejected request",
          text2: ticketErrorMessage || `Failed for ${failedCount} device(s)`,
        });
      } else {
        Toast.show({
          topOffset: 60,
          type: "info",
          text1: "No active push tokens",
          text2: "Customer must open app on a supported build first",
        });
      }
    } catch (error) {
      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Unable to send notification";

      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Notification failed",
        text2: message,
      });
    }
  };

  const sendOrderDeletionNotification = async (config) => {
    const userId = props.user?._id || props.user;
    if (!userId) {
      return { sent: false, reason: "missing_user_id" };
    }

    const candidateRoutes = [
      "notifications/admin/send-user",
      "admin/notifications/send-user",
      "notifications/send",
    ];

    let lastError;
    for (const route of candidateRoutes) {
      try {
        await axios.post(
          `${baseUrl}${route}`,
          {
            userId,
            title: "Order deleted",
            body: `Your order #${props._id} was deleted. Contact support if this was unexpected.`,
            data: {
              type: "order_deleted",
              orderId: String(props._id),
            },
          },
          config
        );
        return { sent: true };
      } catch (error) {
        lastError = error;
        if (error?.response?.status !== 404) {
          break;
        }
      }
    }

    console.log(
      "Order deletion notification failed:",
      lastError?.response?.data || lastError?.message || "Unknown error"
    );
    return { sent: false, reason: "request_failed" };
  };

  const resolveOrderUserEmail = async (config) => {
    const directEmail =
      props.user?.email ||
      props.email ||
      (typeof props.user === "object" ? props.user?.user : null);

    if (directEmail) {
      return directEmail;
    }

    const userId = props.user?._id || (typeof props.user === "string" ? props.user : null);
    if (!userId) {
      return null;
    }

    try {
      const response = await axios.get(`${baseUrl}users/${userId}`, config);
      const user = response?.data?.user || response?.data || {};
      return user?.email || user?.user || null;
    } catch (error) {
      console.log(
        "Could not resolve user email for deletion:",
        error?.response?.data || error?.message || "Unknown error"
      );
      return null;
    }
  };

  const sendOrderDeletionEmail = async (config) => {
    const userEmail = await resolveOrderUserEmail(config);
    if (!userEmail) {
      return { sent: false, reason: "missing_user_email" };
    }

    const userId = props.user?._id || (typeof props.user === "string" ? props.user : null);

    const candidateRoutes = [
      "notifications/admin/send-email",
      "admin/notifications/send-email",
      "notifications/send-email",
      "emails/send",
      "admin/send-email",
      "admin/emails/send",
    ];

    let lastError;
    for (const route of candidateRoutes) {
      try {
        const text = `Your order #${props._id} was deleted. If this was not expected, please contact support.`;
        await axios.post(
          `${baseUrl}${route}`,
          {
            to: userEmail,
            email: userEmail,
            recipient: userEmail,
            userId,
            orderId: String(props._id),
            subject: "Order deleted",
            text,
            body: text,
            message: text,
            html: `<p>Your order <strong>#${props._id}</strong> was deleted.</p><p>If this was not expected, please contact support.</p>`,
          },
          config
        );
        return { sent: true };
      } catch (error) {
        lastError = error;
        if (error?.response?.status !== 404) {
          break;
        }
      }
    }

    console.log(
      "Order deletion email failed:",
      lastError?.response?.data || lastError?.message || "Unknown error"
    );
    return { sent: false, reason: "request_failed" };
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
    const fallbackEmail =
      props.user?.email ||
      props.email ||
      props.customerEmail ||
      null;
    const fallbackName = props.user?.name || props.customerName || null;

    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        notifyCustomer: true,
        customerEmail: fallbackEmail,
        customerName: fallbackName,
      },
    };

    try {
      const response = await axios.delete(
        `${baseUrl}orders/${props._id}?notifyCustomer=true`,
        config
      );

      if (response.status === 200) {
        const [notificationResult, emailResult] = await Promise.all([
          sendOrderDeletionNotification(config),
          sendOrderDeletionEmail(config),
        ]);

        Toast.show({
          topOffset: 60,
          type: "success",
          text1: "Order deleted",
          text2: "Order has been successfully deleted",
        });

        if (notificationResult.sent || emailResult.sent) {
          Toast.show({
            topOffset: 60,
            type: "success",
            text1: "Customer notified",
            text2: "Order deletion notification/email sent",
          });
        } else {
          Toast.show({
            topOffset: 60,
            type: "info",
            text1: "Order deleted",
            text2: "Could not send email/notification",
          });
        }

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
    if (props.status === "3" && props.dateOrdered) {
      // status 3 = delivered
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

    const fallbackEmail =
      props.user?.email ||
      props.email ||
      props.customerEmail ||
      null;
    const fallbackName = props.user?.name || props.customerName || null;

    const config = {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      data: {
        notifyCustomer: true,
        customerEmail: fallbackEmail,
        customerName: fallbackName,
      },
    };

    try {
      await axios.delete(
        `${baseUrl}orders/${props._id}?notifyCustomer=true`,
        config
      );
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
          Date Ordered: {formatOrderDateTime(props.dateOrdered)}
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
          Order Items: {orderItemsCount}
        </Text>
        <UserOrderItems orderId={props._id} />
        <View style={styles.priceContainer}>
          <Text>Total Price: </Text>
          <Text style={styles.price}>{formatPrice(props.totalPrice)}</Text>
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
              <Picker.Item label="Processing" value="1" />
              <Picker.Item label="Shipped" value="2" />
              <Picker.Item label="Delivered" value="3" />
            </Picker>
            <View style={styles.actionSection}>
              <View style={styles.buttonRow}>
                <View style={styles.halfButtonWrap}>
                  <EasyButton tertiary large onPress={() => updateOrder()}>
                    <Text style={styles.actionButtonText}>Update</Text>
                  </EasyButton>
                </View>

                <View style={styles.halfButtonWrap}>
                  <EasyButton
                    secondary
                    large
                    onPress={() => sendManualNotification()}
                  >
                    <Text style={styles.actionButtonText}>Notify Customer</Text>
                  </EasyButton>
                </View>
              </View>

              <View style={styles.deleteButtonWrap}>
                <EasyButton
                  danger
                  large
                  onPress={() => confirmDeleteOrder()}
                >
                  <Text style={styles.actionButtonText}>Delete Order</Text>
                </EasyButton>
              </View>
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
  actionSection: {
    marginTop: 10,
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "stretch",
    justifyContent: "space-between",
    columnGap: 10,
  },
  halfButtonWrap: {
    flex: 1,
  },
  deleteButtonWrap: {
    marginTop: 10,
  },
  actionButtonText: {
    color: "white",
    textAlign: "center",
  },
});

export default OrderCard;
