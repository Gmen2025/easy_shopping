import React, { useState } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ScrollView,
  Dimensions,
} from "react-native";
import { CardField, useStripe } from "@stripe/stripe-react-native";
import { Card, Button, Divider, Avatar } from "react-native-paper";
import EasyButton from "../../../Shared/StyledComponenets/EasyButton";
import FormContainer from "../../../Shared/Form/FormContainer";
import baseUrl from "../../../assets/common/baseUrl";
import { useCheckout } from "../../../Context/store/CheckoutContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDispatch } from "react-redux";
import { clearCart } from "../../../store/cartSlice";
import Toast from "react-native-toast-message";
import axios from "axios";
import { useContext } from "react";
import { AuthContext } from "../../../Context/store/Auth";

const width = Dimensions.get("window").width;

const StripePayment = (props) => {
  const { confirmPayment } = useStripe();
  const [loading, setLoading] = useState(false);
  const [orderProcessing, setOrderProcessing] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  const { order } = useCheckout();
  const dispatch = useDispatch();
  const authContext = useContext(AuthContext);
  const [cardDetails, setCardDetails] = useState(null);

  const orderData = order || props.route?.params?.order;

  console.log("Order in StripePayment:", orderData);

  // Function to place the order directly
  const handlePlaceOrderDirectly = async (transactionId) => {
    setOrderProcessing(true);

    try {
      const orderItem = {
        ...orderData,
        user: authContext.user?._id,
        paymentId: transactionId,
        paymentStatus: "paid",
        paymentMethod: "Stripe",
        orderItems: orderData.orderItems.map((item) => ({
          product: item._id,
          quantity: item.quantity || 1,
        })),
      };

      console.log("Placing Stripe order directly:", orderItem);

      const token = await AsyncStorage.getItem("token");

      const response = await axios.post(`${baseUrl}orders`, orderItem, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 200 || response.status === 201) {
        Toast.show({
          topOffset: 60,
          type: "success",
          text1: "Order Placed Successfully",
          text2: "Thank you for using Stripe payment!",
        });

        // Clear cart and navigate back
        setTimeout(() => {
          dispatch(clearCart());
          props.navigation.navigate("Cart");
        }, 1500);
      }
    } catch (error) {
      console.log(
        "Order placement error:",
        error.response?.data || error.message
      );
      Toast.show({
        topOffset: 60,
        type: "error",
        text1: "Order Failed",
        text2: "Please try again",
      });
    } finally {
      setOrderProcessing(false);
    }
  };

  const handlePayment = async () => {
    if (!orderData || !orderData.totalPrice) {
      Alert.alert("Error", "Invalid order data");
      return;
    }

    // Validate card details before proceeding
    if (!cardDetails || !cardDetails.complete) {
      Alert.alert(
        "Card Details Required",
        "Please enter complete card details:\n• Card number (16 digits)\n• Expiry date (MM/YY)\n• CVC code (3-4 digits)"
      );
      return;
    }

    setLoading(true);

    try {
      // Get the auth token
      const token = await AsyncStorage.getItem("token");

      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch(`${baseUrl}stripe/create-payment-intent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: Math.round(orderData.totalPrice * 100),
          currency: "usd",
          orderId: orderData._id || Date.now().toString(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, message: ${errorText}`
        );
      }

      const { client_secret } = await response.json();

      if (!client_secret) {
        throw new Error("No client secret received");
      }

      const { error, paymentIntent } = await confirmPayment(client_secret, {
        paymentMethodType: "Card",
      });

      if (error) {
        // Handle specific card validation errors
        if (
          error.code === "IncompletePaymentMethod" ||
          error.message?.includes("incomplete") ||
          error.message?.includes("card details")
        ) {
          Alert.alert(
            "Card Details Incomplete",
            "Please fill in all card details (number, expiry, CVC)"
          );
        } else {
          Alert.alert("Payment failed", error.message);
        }
      } else if (paymentIntent) {
        // Payment successful - show order confirmation
        const transactionId = paymentIntent.id;
        setPaymentId(transactionId);
        setPaymentSuccess(true);
        setShowOrderDetails(true);
      } else {
        throw new Error("API not available");
      }
    } catch (error) {
      console.error("Payment error:", error);
      Alert.alert("Error", `Payment failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Calculate total price
  const calculateTotal = () => {
    return Array.isArray(orderData.orderItems)
      ? orderData.orderItems
          .reduce((sum, item) => sum + item.price * (item.quantity || 1), 0)
          .toFixed(2)
      : orderData.totalPrice?.toFixed(2) || "0.00";
  };

  if (!orderData) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: "center", fontSize: 16 }}>
          No order data available. Please go back to checkout.
        </Text>
        <EasyButton
          tertiary
          large
          onPress={() => props.navigation.goBack()}
          style={{ marginTop: 20 }}
        >
          <Text>Go Back</Text>
        </EasyButton>
      </View>
    );
  }

  // Order Confirmation View (similar to TelebirrPayment)
  if (showOrderDetails) {
    return (
      <View style={styles.confirmContainer}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.title}>
                {paymentSuccess ? "Payment Successful!" : "Order Confirmation"}
              </Text>

              {paymentSuccess && (
                <View style={styles.paymentSuccessSection}>
                  <Text style={styles.successText}>
                    ✅ Stripe Payment Completed
                  </Text>
                  <Text style={styles.paymentIdText}>
                    Payment ID: {paymentId}
                  </Text>
                  <Text style={styles.methodText}>
                    Method: Credit/Debit Card
                  </Text>
                </View>
              )}

              <Text variant="bodyLarge" style={styles.label}>
                Shipping Address:
              </Text>
              <Text>Address: {orderData.shippingAddress1}</Text>
              {orderData.shippingAddress2 && (
                <Text>Address2: {orderData.shippingAddress2}</Text>
              )}
              <Text>City: {orderData.city}</Text>
              <Text>Zip Code: {orderData.zip}</Text>
              <Text>{orderData.country}</Text>

              <Text variant="bodyLarge" style={styles.label}>
                Phone:
              </Text>
              <Text>{orderData.phone}</Text>

              <Text variant="bodyLarge" style={styles.label}>
                Payment Method:
              </Text>
              <Text>Stripe Card Payment</Text>
              {orderData.cardType && (
                <Text>Card Type: {orderData.cardType}</Text>
              )}

              <Divider style={{ marginVertical: 10 }} />

              <Text variant="bodyLarge" style={styles.label}>
                Order Items:
              </Text>
              {Array.isArray(orderData.orderItems) &&
              orderData.orderItems.length > 0 ? (
                orderData.orderItems.map((item, idx) => (
                  <View key={idx} style={styles.itemRow}>
                    <Avatar.Image
                      size={40}
                      source={{
                        uri:
                          item.image ||
                          "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png",
                      }}
                      style={styles.thumbnail}
                    />
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.itemQty}>X: {item.quantity || 1}</Text>
                    <Text style={styles.itemPrice}>
                      $
                      {item.price?.toFixed ? item.price.toFixed(2) : item.price}
                    </Text>
                  </View>
                ))
              ) : (
                <Text>No items in this order.</Text>
              )}

              <Divider style={{ marginVertical: 10 }} />

              <Text variant="bodyLarge" style={styles.label}>
                Total Price:
              </Text>
              <Text style={styles.totalPrice}>${calculateTotal()}</Text>
            </Card.Content>

            <Card.Actions
              style={{ justifyContent: "space-between", paddingHorizontal: 16 }}
            >

              <Button
                mode="contained"
                onPress={() => handlePlaceOrderDirectly(paymentId)}
                disabled={orderProcessing}
                style={{ flex: 1, marginLeft: 10 }}
              >
                {orderProcessing ? "Placing Order..." : "Place Order"}
              </Button>
            </Card.Actions>
          </Card>
        </ScrollView>
        <View style={{ height: 10 }} />
      </View>
    );
  }

  // Payment Form View
  return (
    <FormContainer title="Stripe Payment">
      <View style={styles.container}>
        <Text style={styles.orderInfo}>
          Total: ${orderData.totalPrice || 0}
        </Text>
        <Text style={styles.cardFieldLabel}>Card Details</Text>
        <View style={styles.cardFieldContainer}>
          <CardField
            postalCodeEnabled={false}
            placeholders={{
              number: "4242 4242 4242 4242",
              expiry: "MM/YY",
              cvc: "CVC",
            }}
            cardStyle={{
              backgroundColor: "#FFFFFF",
              textColor: "#000000",
              borderColor: "#E0E0E0",
              borderWidth: 1,
              borderRadius: 8,
              fontSize: 16,
              placeholderColor: "#999999",
            }}
            style={{
              width: "100%",
              height: 50,
            }}
            onCardChange={(details) => {
              setCardDetails(details);
              console.log("Card details:", details);
            }}
          />
        </View>

        {/* Show card validation status */}

        {cardDetails && (
          <View style={styles.cardStatus}>
            <Text
              style={[
                styles.cardStatusText,
                { color: cardDetails.complete ? "#4caf50" : "#f44336" },
              ]}
            >
              {cardDetails.complete
                ? "✅ Card details complete"
                : "⚠️ Please complete card details"}
            </Text>
          </View>
        )}

        <EasyButton
          primary
          large
          onPress={handlePayment}
          disabled={loading || orderProcessing}
          style={styles.payButton}
        >
          <Text style={{ color: "white" }}>
            {loading
              ? "Processing..."
              : orderProcessing
              ? "Placing Order..."
              : "Pay Now"}
          </Text>
        </EasyButton>

        <EasyButton
          secondary
          large
          onPress={() => props.navigation.goBack()}
          style={styles.backButton}
          disabled={loading || orderProcessing}
        >
          <Text>Back</Text>
        </EasyButton>
      </View>
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  confirmContainer: {
    flex: 1,
    backgroundColor: "#fff",
  },
  card: {
    margin: 16,
    width: width * 0.9,
    maxWidth: 400,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
  },
  paymentSuccessSection: {
    backgroundColor: "#e3f2fd",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    alignItems: "center",
  },
  successText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1976d2",
    marginBottom: 5,
  },
  paymentIdText: {
    fontSize: 14,
    color: "#666",
    marginBottom: 3,
  },
  methodText: {
    fontSize: 14,
    color: "#666",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  thumbnail: {
    marginRight: 12,
  },
  itemName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  itemQty: {
    fontSize: 14,
    marginRight: 12,
    minWidth: 40,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: "bold",
    minWidth: 60,
    textAlign: "right",
  },
  totalPrice: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    color: "#1976d2",
  },
  orderInfo: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  payButton: {
    marginTop: 20,
  },
  backButton: {
    marginTop: 10,
  },
  cardFieldContainer: {
  backgroundColor: '#FFFFFF',
  borderWidth: 1,
  borderColor: '#E0E0E0',
  borderRadius: 8,
  padding: 5,
  marginVertical: 20,
  minHeight: 60,
  justifyContent: 'center',
  width: 400,
},
});

export default StripePayment;
