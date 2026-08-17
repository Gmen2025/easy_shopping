import AsyncStorage from "@react-native-async-storage/async-storage";

import baseUrl from "./baseUrl";

const getOrderId = (order) =>
  order?.orderId || order?._id || order?.rawPayload?.orderId || order?.rawPayload?._id;

export const updateDeliveryStatus = async (order, deliveryStatus) => {
  const orderId = getOrderId(order);
  const token = await AsyncStorage.getItem("token");

  if (!orderId || !token) {
    throw new Error("Missing order or driver authentication");
  }

  const response = await fetch(`${baseUrl}orders/${orderId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ deliveryStatus }),
  });

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(responseText || `Delivery update failed (${response.status})`);
  }

  return response.json();
};
