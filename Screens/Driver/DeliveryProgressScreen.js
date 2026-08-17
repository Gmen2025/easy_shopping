import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";

import { updateDeliveryStatus } from "../../assets/common/delivery";

const DeliveryProgressScreen = () => {
  const navigation = useNavigation();
  const route = useRoute();

  const request = route?.params?.request || {};
  const orderStatus = route?.params?.orderStatus || "Picked Up";
  const mode = route?.params?.mode || "pickup";

  const isDelivered = orderStatus === "Delivered";
  const isPickupMode = mode === "pickup";

  const handleComplete = async () => {
    if (isDelivered) {
      navigation.navigate("User Profile");
      return;
    }

    if (isPickupMode && orderStatus !== "Picked Up") {
      await updateDeliveryStatus(request, "Picked Up");
      navigation.navigate("DeliveryRoute", { request, orderStatus: "Picked Up" });
      return;
    }

    navigation.navigate("DeliveryRoute", {
      request,
      orderStatus: "Picked Up",
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Text style={styles.title}>{isDelivered ? "Delivery completed" : isPickupMode ? "Pickup confirmed" : "Delivery in progress"}</Text>
          <Text style={styles.subtitle}>
            {isDelivered
              ? "The pickup is complete and the delivery is finished."
              : isPickupMode
                ? "The order has been picked up and is ready for the delivery leg."
                : "Proceed to the customer delivery step."}
          </Text>

          <View style={styles.infoBox}>
            <Text style={styles.label}>Store</Text>
            <Text style={styles.value}>{request.pickupStoreName || "Store"}</Text>
          </View>

          <View style={styles.infoBox}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{request.customerName || "Customer"}</Text>
          </View>

          <TouchableOpacity style={styles.button} onPress={handleComplete}>
            <Text style={styles.buttonText}>{isDelivered ? "Back to dashboard" : isPickupMode && orderStatus !== "Picked Up" ? "Confirm pickup" : "Return to route"}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f3f6fb",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 18,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
  },
  subtitle: {
    marginTop: 8,
    color: "#6b7280",
    fontSize: 14,
    lineHeight: 20,
  },
  infoBox: {
    marginTop: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 12,
  },
  label: {
    color: "#6b7280",
    fontSize: 12,
    textTransform: "uppercase",
  },
  value: {
    marginTop: 4,
    color: "#111827",
    fontWeight: "600",
  },
  button: {
    marginTop: 20,
    backgroundColor: "#8a6c09",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});

export default DeliveryProgressScreen;
