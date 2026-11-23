import React, { useRef, useState } from "react";
import {
  View,
  Text,
  Alert,
  StyleSheet,
  ScrollView,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import Constants from "expo-constants";
import { Card, Button, Divider, Avatar } from "react-native-paper";
import FormContainer from "../../../Shared/Form/FormContainer";
import EasyButton from "../../../Shared/StyledComponenets/EasyButton";
import baseUrl from "../../../assets/common/baseUrl";
import { useCheckout } from "../../../Context/store/CheckoutContext";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDispatch } from "react-redux";
import { clearCart } from "../../../store/cartSlice";
import Toast from "react-native-toast-message";
import axios from "axios";
import { useContext } from "react";
import { AuthContext } from "../../../Context/store/Auth";
import { useCurrency } from "../../../assets/common/currency";
import { deductInventoryFromOrder, validateOrderStock } from "../../../assets/common/inventory";
import { getTrackingOrder } from "../../../assets/common/orderTracking";
import { useIsFocused } from "@react-navigation/native";
import stripeModule from "../../../assets/common/stripe";
import EmbeddedStripePayment from "../../../Shared/EmbeddedStripePayment";

const width = Dimensions.get("window").width;
const stripeCurrency =
  Constants?.expoConfig?.extra?.stripeCurrency || "usd";
const stripePublishableKey = (() => {
  const configKey = Constants?.expoConfig?.extra?.stripePublishableKey;
  const envKey = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

  if (typeof configKey === "string" && configKey.trim()) {
    return configKey;
  }

  if (typeof envKey === "string") {
    return envKey;
  }

  return "";
})();

const hasValidStripePublishableKey = (key) => {
  const normalized = typeof key === "string" ? key.trim() : "";
  return normalized.startsWith("pk_");
};

const useEmbeddedPaymentElement = stripeModule?.useEmbeddedPaymentElement;

const StripeUnavailable = ({ navigation }) => {
  return (
    <FormContainer title="Stripe Payment">
      <View style={styles.container}>
        <View style={styles.summaryCard}>
          <Text style={styles.paymentTitle}>Card Payment Unavailable</Text>
          <Text style={styles.summaryHint}>
            Native card checkout is unavailable on web, in Expo Go, or without a configured Stripe build.
          </Text>
        </View>

        <View style={styles.inputCard}>
          <Text style={styles.emptyStateText}>
            Open the project in a development build and configure a valid Stripe publishable key, or go back and choose another payment method.
          </Text>
        </View>

        <EasyButton
          secondary
          large
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </EasyButton>
      </View>
    </FormContainer>
  );
};

const StripePaymentSupported = (props) => {
  const focused = useIsFocused();
  const [loading, setLoading] = useState(false);
  const [orderProcessing, setOrderProcessing] = useState(false);
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [paymentId, setPaymentId] = useState(null);
  const { order } = useCheckout();
  const dispatch = useDispatch();
  const authContext = useContext(AuthContext);
  const { formatPrice } = useCurrency();
  const paymentAttempt = useRef(null);
  const paymentRequestUncertain = useRef(false);

  const orderData = order || props.route?.params?.order;

  const buildPaymentIntentOrderId = () => {
    const baseOrderId =
      orderData?.orderId ||
      (typeof orderData?._id === "string" ? orderData._id : "checkout");
    return `${baseOrderId}-${Date.now()}`;
  };

  console.log("Order in StripePayment:", orderData);

  // Function to place the order directly
  const handlePlaceOrderDirectly = async (transactionId) => {
    setOrderProcessing(true);

    try {
      const orderItem = {
        user: authContext.user?._id,
        storefrontId: orderData.storefrontId || null,
        shippingAddress1: orderData.shippingAddress1,
        pickupStore: orderData.pickupStore || null,
        pickupStoreName: orderData.pickupStoreName || orderData.pickupStore?.name || null,
        storeLocation: orderData.storeLocation || null,
        customerLocation: orderData.customerLocation || null,
        customerLocationSource: orderData.customerLocationSource,
        pickupStoreId: orderData.pickupStoreId || orderData.pickupStore?._id || orderData.pickupStore?.id || null,
        storeId: orderData.storeId || orderData.pickupStore?._id || orderData.pickupStore?.id || null,
        storeAssignment: orderData.storeAssignment || null,
        storeAssignmentStatus: orderData.storeAssignmentStatus || "assigned",
        shippingAddress2: orderData.shippingAddress2,
        city: orderData.city,
        zip: orderData.zip,
        country: orderData.country,
        phone: orderData.phone,
        status: orderData.status || "3",
        totalPrice: Number(orderData.totalPrice || 0),
        deliveryMode: orderData.deliveryMode,
        deliveryDistanceKm: orderData.deliveryDistanceKm,
        deliveryFee: orderData.deliveryFee,
        scheduledFor: orderData.scheduledFor || null,
        scheduledDeliveryDate:
          orderData.scheduledDeliveryDate || orderData.scheduledFor || null,
        methodName: "Card Payment",
        paymentId: transactionId,
        paymentStatus: "paid",
        paymentMethod: 3,
        orderItems: orderData.orderItems.map((item) => ({
          product: item._id || item.id,
          quantity: item.quantity || 1,
          price: item.price,
        })),
      };

      console.log("Placing Stripe order directly:", orderItem);

      const token = await AsyncStorage.getItem("token");

      const response = await axios.post(`${baseUrl}orders`, orderItem, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 200 || response.status === 201) {
        const inventoryResult = await deductInventoryFromOrder({
          orderItems: orderData.orderItems,
          token,
          inventoryManaged: response.data?.order?.inventoryManaged === true,
        });

        if (!inventoryResult.ok) {
          Toast.show({
            topOffset: 60,
            type: "info",
            text1: "Order placed",
            text2: "Some stock counts could not be updated",
          });
        }

        Toast.show({
          topOffset: 60,
          type: "success",
          text1: "Order Placed Successfully",
          text2: "Thank you for using Stripe payment!",
        });

        setTimeout(() => {
          dispatch(clearCart());
          const createdOrder = response.data?.order || response.data;
          if (orderData.deliveryMode === "SAME_DAY" && createdOrder?._id) {
            props.navigation.navigate("User", {
              screen: "OrderTracking",
              params: { orderId: createdOrder._id, order: getTrackingOrder(orderData, createdOrder) },
            });
          } else {
            props.navigation.navigate("CartHome");
          }
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
        text2: error.response?.data?.message || "Unable to save your paid order. Contact support before paying again.",
      });
    } finally {
      setOrderProcessing(false);
    }
  };

  const createCardIntent = async () => {
    if (paymentAttempt.current) return paymentAttempt.current;
    if (paymentRequestUncertain.current) throw new Error("The payment request could not be verified. Contact support before trying again.");
    const token = await AsyncStorage.getItem("token");
    if (!token) throw new Error("Authentication token not found");
    const stockValidation = await validateOrderStock({ orderItems: orderData.orderItems, token });
    if (!stockValidation.ok) throw new Error(stockValidation.message || "Could not verify order stock.");
    let response;
    try {
      response = await axios.post(`${baseUrl}stripe/create-payment-intent`, {
        amount: Math.round(Number(orderData.totalPrice) * 100),
        currency: String(stripeCurrency).toLowerCase(),
        orderId: buildPaymentIntentOrderId(),
        cardOnly: true,
      }, { headers: { Authorization: `Bearer ${token}` } });
    } catch (error) {
      if (!error.response) paymentRequestUncertain.current = true;
      throw error;
    }
    const data = response.data;
    if (!data?.client_secret || !data.payment_intent_id ||
        data.payment_method_types?.length !== 1 || data.payment_method_types[0] !== "card") {
      paymentRequestUncertain.current = true;
      throw new Error("The payment service must be updated before this checkout can accept cards.");
    }
    paymentAttempt.current = { clientSecret: data.client_secret, paymentId: data.payment_intent_id };
    return paymentAttempt.current;
  };
  const completeCardPayment = async (payment) => {
    if (!payment?.paymentId) throw new Error("Payment reference unavailable. Contact support before trying again.");
    setPaymentId(payment.paymentId);
    setPaymentSuccess(true);
    setShowOrderDetails(true);
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
        <Text style={styles.emptyStateText}>
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
          contentContainerStyle={styles.confirmScrollContent}
        >
          <Card style={styles.card}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.confirmTitle}>
                {paymentSuccess ? "Payment Successful!" : "Order Confirmation"}
              </Text>

              {paymentSuccess && (
                <View style={styles.paymentSuccessSection}>
                  <Text style={styles.successText}>Stripe payment completed</Text>
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
                      {formatPrice(item.price?.toFixed ? item.price : Number(item.price || 0))}
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
              <Text style={styles.totalPrice}>{formatPrice(calculateTotal())}</Text>
            </Card.Content>

            <Card.Actions
              style={{ justifyContent: "space-between", paddingHorizontal: 16 }}
            >

              <Button
                mode="contained"
                onPress={() => handlePlaceOrderDirectly(paymentId)}
                disabled={orderProcessing}
                style={styles.placeOrderButton}
                labelStyle={styles.placeOrderButtonLabel}
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
    <View style={styles.paymentScreen}>
      <Text style={styles.formTitle}>Stripe Payment</Text>
      <KeyboardAvoidingView
        style={styles.formWrapper}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.formScrollContent}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            <View style={styles.summaryCard}>
              <Text style={styles.paymentTitle}>Secure Card Payment</Text>
              <Text style={styles.orderInfo}>Total: {formatPrice(orderData.totalPrice || 0)}</Text>
              <Text style={styles.summaryHint}>Your card details are securely handled by Stripe.</Text>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.cardFieldLabel}>Payment Details</Text>
              {focused ? <EmbeddedStripePayment
                amount={Math.round(Number(orderData.totalPrice) * 100)}
                currency={stripeCurrency}
                createIntent={createCardIntent}
                onCompleted={completeCardPayment}
                onProcessingChange={setLoading}
                disabled={orderProcessing}
                label="Pay Now"
              /> : null}
            </View>

            <EasyButton
              secondary
              large
              onPress={() => props.navigation.goBack()}
              style={styles.backButton}
              disabled={loading || orderProcessing}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </EasyButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const StripePayment = (props) => {
  if (!useEmbeddedPaymentElement || !hasValidStripePublishableKey(stripePublishableKey)) {
    return <StripeUnavailable navigation={props.navigation} />;
  }

  return <StripePaymentSupported {...props} />;
};

const styles = StyleSheet.create({
  paymentScreen: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  formTitle: {
    fontSize: 30,
    textAlign: "center",
    marginTop: 10,
    marginBottom: 5,
  },
  formWrapper: {
    flex: 1,
  },
  formScrollContent: {
    flexGrow: 1,
    paddingBottom: Platform.OS === "ios" ? 36 : 80,
  },
  container: {
    padding: 5,
    backgroundColor: "#f3f6fb",
  },
  confirmContainer: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  confirmScrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 16,
  },
  card: {
    marginHorizontal: 16,
    marginVertical: 10,
    width: width * 0.9,
    maxWidth: 400,
    borderRadius: 16,
    backgroundColor: "#ffffff",
  },
  confirmTitle: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 16,
    textAlign: "center",
    color: "#333",
  },
  paymentSuccessSection: {
    backgroundColor: "#ecfdf3",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#b5e3c8",
  },
  successText: {
    fontSize: 17,
    fontWeight: "bold",
    color: "#1f7a45",
    marginBottom: 5,
  },
  paymentIdText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 3,
  },
  methodText: {
    fontSize: 14,
    color: "#4b5563",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    marginTop: 16,
    marginBottom: 8,
    color: "#333",
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
    color: "#8a6c09",
  },
  summaryCard: {
    backgroundColor: "goldenrod",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  paymentTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
  },
  orderInfo: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f3f7ff",
    marginBottom: 4,
  },
  summaryHint: {
    color: "#ffffff",
    fontSize: 13,
    lineHeight: 18,
  },
  inputCard: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce3ef",
    padding: 14,
    marginBottom: 12,
  },
  cardFieldLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a2f4a",
    marginBottom: 10,
  },
  payButton: {
    marginTop: 6,
    borderRadius: 12,
    paddingVertical: 4,
  },
  backButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 4,
  },
  payButtonText: {
    color: "#ffffff",
    fontWeight: "700",
    letterSpacing: 0.2,
  },
  backButtonText: {
    color: "#0f172a",
    fontWeight: "600",
  },
  cardFieldContainer: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d7dce5",
    borderRadius: 10,
    padding: 6,
    minHeight: 60,
    justifyContent: "center",
    width: "100%",
  },
  cardStatus: {
    marginTop: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  cardStatusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  cardStatusSuccess: {
    color: "#1f7a45",
  },
  cardStatusPending: {
    color: "#b45309",
  },
  emptyStateText: {
    textAlign: "center",
    fontSize: 16,
    color: "#374151",
    lineHeight: 22,
  },
  placeOrderButton: {
    flex: 1,
    marginLeft: 10,
    borderRadius: 12,
    backgroundColor: "goldenrod",
    minHeight: 50,
    justifyContent: "center",
  },
  placeOrderButtonLabel: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
});

export default StripePayment;
