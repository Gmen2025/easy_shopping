import React, { useEffect, useState, useCallback } from "react";
import { AppState } from "react-native";
import { Badge } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "../assets/common/baseUrl";
import { subscribeLowStockUpdates } from "../assets/common/lowStockEvents";
import { getWithRetry, isServiceUnavailableError } from "../assets/common/requestRetry";

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const AdminLowStockBadge = () => {
  const [count, setCount] = useState(0);

  const refreshCount = useCallback(async () => {
    try {
      const storedThreshold = await AsyncStorage.getItem("adminLowStockThreshold");
      const parsedThreshold = Number(storedThreshold);
      const threshold =
        !Number.isNaN(parsedThreshold) && parsedThreshold >= 0
          ? parsedThreshold
          : DEFAULT_LOW_STOCK_THRESHOLD;

      const response = await getWithRetry(`${baseUrl}products`, {}, { retries: 2, delayMs: 1200 });
      const products = Array.isArray(response.data)
        ? response.data
        : response.data.products;

      const lowStockCount = (products || []).filter(
        (item) => Number(item.countInStock || 0) <= threshold
      ).length;

      setCount(lowStockCount);
    } catch (error) {
      if (isServiceUnavailableError(error)) {
        setCount(0);
        return;
      }
      console.log("Admin low stock badge refresh error:", error?.message || error);
    }
  }, []);

  useEffect(() => {
    refreshCount();

    const intervalId = setInterval(refreshCount, 60000);
    const unsubscribe = subscribeLowStockUpdates(refreshCount);
    const appStateSub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        refreshCount();
      }
    });

    return () => {
      clearInterval(intervalId);
      unsubscribe();
      appStateSub?.remove?.();
    };
  }, [refreshCount]);

  if (count <= 0) {
    return null;
  }

  return <Badge style={styles.badge}>{count}</Badge>;
};

const styles = {
  badge: {
    position: "absolute",
    top: -8,
    right: -10,
    backgroundColor: "#b91c1c",
    color: "white",
    fontSize: 10,
    zIndex: 10,
    minWidth: 18,
    height: 18,
    lineHeight: 18,
  },
};

export default AdminLowStockBadge;
