import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Linking,
} from "react-native";
import Constants from "expo-constants";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDispatch } from "react-redux";
import { clearCart } from "../../../store/cartSlice";
import Toast from "react-native-toast-message";
import axios from "axios";
import baseUrl from "../../../assets/common/baseUrl";
import { useCurrency } from "../../../assets/common/currency";
import { deductInventoryFromOrder, validateOrderStock } from "../../../assets/common/inventory";

const TelebirrPayment = (props) => {
  // Change from destructured props to props
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [orderProcessing, setOrderProcessing] = useState(false);
  const [pendingTransactionId, setPendingTransactionId] = useState(null);
  const dispatch = useDispatch();
  const { formatPrice } = useCurrency();
  const allowMockTelebirr =
    String(Constants?.expoConfig?.extra?.telebirrMockEnabled || "false").toLowerCase() ===
    "true";

  // Get order data from navigation params
  const orderData = props.route?.params?.order;

  console.log("Order data in TelebirrPayment:", orderData);

  // Add validation for orderData
  if (!orderData) {
    return (
      <View
        style={[
          styles.container,
          { justifyContent: "center", alignItems: "center" },
        ]}
      >
        <Text style={styles.errorText}>No order data found</Text>
        <TouchableOpacity
          style={[styles.button, styles.payButton]}
          onPress={() => props.navigation.goBack()}
        >
          <Text style={styles.payButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const API_BASE_URL = baseUrl; // Use your existing baseUrl

  // Function to place the order directly
  const handlePlaceOrderDirectly = async (transactionId) => {
    setOrderProcessing(true);

    try {
      const orderItem = {
        ...orderData,
        user: orderData.user,
        paymentId: transactionId,
        paymentStatus: "paid",
        paymentMethod: "Telebirr",
        orderItems: orderData.orderItems.map((item) => ({
          product: item._id,
          quantity: item.quantity || 1,
        })),
      };

      console.log("Placing Telebirr order directly:", orderItem);

      const token = await AsyncStorage.getItem("token");

      const response = await axios.post(`${baseUrl}orders`, orderItem, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 200 || response.status === 201) {
        const inventoryResult = await deductInventoryFromOrder({
          orderItems: orderData.orderItems,
          token,
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
          text2: "Thank you for using Telebirr payment!",
        });

        // Clear cart and navigate back
        setTimeout(() => {
          dispatch(clearCart());
          props.navigation.navigate("CartHome");
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

  // Function to initiate Telebirr payment
  // Update the initiatePayment function in your TelebirrPayment.js
  const initiatePayment = async (paymentData) => {
    try {
      // Validate inputs
      if (!phoneNumber || !customerName) {
        Alert.alert("Error", "Please fill in all required fields");
        return;
      }

      if (!phoneNumber.startsWith("251") || phoneNumber.length !== 12) {
        Alert.alert(
          "Error",
          "Please enter a valid Ethiopian phone number (251XXXXXXXXX)"
        );
        return;
      }

      setLoading(true);

      // Get JWT token
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        Alert.alert("Error", "Please login first");
        setLoading(false);
        return;
      }

      const stockValidation = await validateOrderStock({
        orderItems: orderData.orderItems,
        token,
      });

      if (!stockValidation.ok) {
        Alert.alert(
          "Reduce item quantity",
          stockValidation.message || "Some items exceed available stock."
        );
        setLoading(false);
        return;
      }

      // Prepare payment data
      paymentData = {
        amount: orderData.totalPrice, // No conversion needed
        phoneNumber: phoneNumber,
        orderId: orderData.orderId || orderData._id || `ORDER_${Date.now()}`,
        customerName: customerName,
        description: `Payment for order ${
          orderData.orderId || orderData._id || "N/A"
        }`,
        returnUrl: "easyshopping://payment-success",
        cancelUrl: "easyshopping://payment-cancel",
      };

      console.log("Initiating payment with data:", paymentData);

      try {
        // Call backend API with better error handling
        const response = await fetch(
          `${API_BASE_URL}telebirr/initiate-payment`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(paymentData),
          }
        );

        console.log("Response status:", response.status);
        console.log("Response headers:", response.headers);

        // Check if response is JSON or HTML
        const contentType = response.headers.get("content-type");

        if (!response.ok) {
          if (contentType && contentType.includes("application/json")) {
            const errorResult = await response.json();
            throw new Error(errorResult.message || `HTTP ${response.status}`);
          } else {
            // HTML response (likely 404 or 500 error page)
            const htmlText = await response.text();
            console.log("HTML Error Response:", htmlText);
            throw new Error(`API endpoint not found (${response.status})`);
          }
        }

        // Check if response is JSON
        if (contentType && contentType.includes("application/json")) {
          const result = await response.json();
          if (result.success) {
            console.log("Payment initiation successful:", result);

            const transactionId =
              result.transactionId ||
              result.data?.transactionId ||
              result.data?.prepayId ||
              `TXN_${Date.now()}`;

            setPendingTransactionId(transactionId);

            Alert.alert(
              "Payment Initiated",
              `Payment request sent to ${phoneNumber}. Complete payment in Telebirr, then tap \"Check Payment Status\".`,
              [
                {
                  text: "Open Telebirr",
                  onPress: () => {
                    handlePaymentInitiated({ ...result, transactionId });
                  },
                },
              ]
            );
          } else {
            throw new Error(result.message || "Payment initiation failed");
          }
        } else {
          throw new Error("Invalid response format from server");
        }
      } catch (apiError) {
        console.log("API error details:", apiError.message);

        // Show more specific error messages
        if (
          apiError.message.includes("JSON Parse error") ||
          apiError.message.includes("Unexpected character")
        ) {
          console.log(
            "Server returned HTML instead of JSON - API endpoint likely doesn't exist"
          );
        }

        if (
          apiError.message.includes("Network request failed") ||
          apiError.message.includes("Failed to fetch")
        ) {
          console.log("Network error - server might be down");
        }

        if (allowMockTelebirr) {
          Alert.alert(
            "Telebirr Payment Simulation",
            `API Error: ${apiError.message}\n\nUsing mock payment for testing:\n\nCustomer: ${customerName}\nPhone: ${phoneNumber}\nAmount: ${formatPrice(orderData.totalPrice)}`,
            [
              {
                text: "Cancel",
                style: "cancel",
              },
              {
                text: "Complete Mock Payment",
                onPress: () => {
                  const mockTransactionId = `telebirr_mock_${Date.now()}`;
                  handlePaymentSuccess({ transactionId: mockTransactionId });
                },
              },
            ]
          );
          return;
        }

        Alert.alert(
          "Payment initiation failed",
          apiError.message || "Could not start Telebirr payment"
        );
      }
    } catch (error) {
      console.error("Payment error:", error);
      Alert.alert("Error", `Network error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Handle payment initiated
  const handlePaymentInitiated = (paymentResult) => {
    console.log("Payment initiated:", paymentResult);

    // Extract transaction ID from the payment result
    const transactionId =
      paymentResult.transactionId ||
      paymentResult.prepayId ||
      `TXN_${Date.now()}`;

    console.log("Extracted transaction ID for verification:", transactionId);

    openPaymentUrl(paymentResult);
  };

  //Open payment URL in browser
  const openPaymentUrl = async (paymentData) => {
    try {
      if (paymentData.paymentUrl) {
        const supported = await Linking.canOpenURL(paymentData.paymentUrl);
        if (supported) {
          await Linking.openURL(paymentData.paymentUrl);
        }
      }

    } catch (error) {
      console.error("Error opening payment URL:", error);
      Alert.alert("Error", "Failed to open payment URL");
    }
  };

  // Verify payment status
  const verifyPayment = async (transactionId) => {
    try {
      console.log("Verifying payment for transaction ID:", transactionId);

      // Make sure transactionId is not undefined
      if (!transactionId) {
        console.error("Transaction ID is undefined or null");
        throw new Error("Transaction ID is required for verification");
      }

      const verificationData = {
        transactionId: transactionId,
        orderId: orderData.orderId || orderData._id || `ORDER_${Date.now()}`,
      };

      console.log("Verification request body:", verificationData);

      const response = await fetch(`${API_BASE_URL}telebirr/verify-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await AsyncStorage.getItem("token")}`,
        },
        body: JSON.stringify(verificationData),
      });

      console.log("Verification response status:", response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.log("Verification error response:", errorText);
        throw new Error(`Verification failed: ${response.status}`);
      }

      const result = await response.json();
      console.log("Verification result:", result);

      if (result.success && result.data?.status === "completed") {
        handlePaymentSuccess(result.data);
      } else {
        Alert.alert(
          "Payment Verification Failed",
          "Unable to verify payment status."
        );
      }
    } catch (error) {
      console.error("Verification error:", error.message);

      if (allowMockTelebirr) {
        console.log("Verification failed, using mock success for testing");
        handlePaymentSuccess({
          transactionId: transactionId,
          status: "completed",
          message: "Mock verification due to API error",
        });
        return;
      }

      Alert.alert(
        "Verification failed",
        error.message || "Could not verify Telebirr payment"
      );
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = async (result) => {
    Alert.alert(
      "Payment Successful",
      "Your payment has been completed successfully!",
      [
        {
          text: "Place Order",
          onPress: () => handlePlaceOrderDirectly(result.transactionId),
        },
      ]
    );
  };

  // Handle payment cancellation
  const onPaymentCancel = () => {
    props.navigation.goBack();
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Telebirr Payment</Text>
        <Text style={styles.subtitle}>Pay securely and complete your order in minutes.</Text>
      </View>

      <View style={styles.orderSummary}>
        <Text style={styles.sectionTitle}>Order Summary</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Order ID:</Text>
          <Text style={styles.summaryValue}>
            {orderData.orderId || orderData._id || "N/A"}
          </Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>Total Amount:</Text>
          <Text style={styles.summaryValue}>{formatPrice(orderData.totalPrice)}</Text>
        </View>
      </View>

      <View style={styles.form}>
        <Text style={styles.sectionTitle}>Payment Details</Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Customer Name *</Text>
          <TextInput
            style={styles.input}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Enter your full name"
            placeholderTextColor="#999"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Phone Number *</Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="251912345678"
            placeholderTextColor="#999"
            keyboardType="phone-pad"
            maxLength={12}
          />
          <Text style={styles.helperText}>
            Enter your Telebirr phone number
          </Text>
        </View>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={onPaymentCancel}
          disabled={loading || orderProcessing}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.button,
            styles.payButton,
            (loading || orderProcessing) && styles.disabledButton,
          ]}
          onPress={initiatePayment}
          disabled={loading || orderProcessing}
        >
          {loading ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : orderProcessing ? (
            <Text style={styles.payButtonText}>Placing Order...</Text>
          ) : (
            <Text style={styles.payButtonText}>
              Pay {formatPrice(orderData.totalPrice)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {pendingTransactionId ? (
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.payButton, { width: "100%" }]}
            onPress={() => verifyPayment(pendingTransactionId)}
            disabled={loading || orderProcessing}
          >
            <Text style={styles.payButtonText}>Check Payment Status</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  contentContainer: {
    paddingBottom: 30,
  },
  errorText: {
    fontSize: 18,
    color: "#f44336",
    marginBottom: 20,
    textAlign: "center",
  },
  header: {
    backgroundColor: "goldenrod",
    marginHorizontal: 15,
    marginTop: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    alignItems: "flex-start",
    borderRadius: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#fff",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#ffffff",
    lineHeight: 18,
  },
  orderSummary: {
    backgroundColor: "#fff",
    margin: 15,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce3ef",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 14,
    color: "#333",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2f7",
  },
  summaryLabel: {
    fontSize: 15,
    color: "#64748b",
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "700",
    color: "#8a6c09",
  },
  form: {
    backgroundColor: "#fff",
    marginHorizontal: 15,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce3ef",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
    color: "#1e293b",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d7dce5",
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f8fafc",
    color: "#0f172a",
  },
  helperText: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 5,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    paddingTop: 14,
    gap: 10,
  },
  button: {
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    height: 52,
    width: "48%",
    justifyContent: "center",
  },
  cancelButton: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d7dce5",
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#334155",
    letterSpacing: 0.2,
  },
  payButton: {
    backgroundColor: "goldenrod",
  },
  payButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.2,
  },
  disabledButton: {
    backgroundColor: "#94a3b8",
  },
});

export default TelebirrPayment;
