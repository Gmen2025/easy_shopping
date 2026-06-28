import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "../../assets/common/baseUrl";
import getImageUrl from "../../assets/common/getImageUrl";
import { useCurrency } from "../../assets/common/currency";
import { notifyLowStockUpdated } from "../../assets/common/lowStockEvents";
import { getWithRetry, isServiceUnavailableError } from "../../assets/common/requestRetry";

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

const LowStock = (props) => {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [threshold, setThreshold] = useState(DEFAULT_LOW_STOCK_THRESHOLD);
  const [thresholdInput, setThresholdInput] = useState(String(DEFAULT_LOW_STOCK_THRESHOLD));
  const [loadError, setLoadError] = useState("");
  const { formatPrice } = useCurrency();

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      const loadData = async () => {
        setLoading(true);
        setLoadError("");
        try {
          const storedThreshold = await AsyncStorage.getItem("adminLowStockThreshold");
          const parsed = Number(storedThreshold);
          if (!Number.isNaN(parsed) && parsed >= 0 && mounted) {
            setThreshold(parsed);
            setThresholdInput(String(parsed));
          }

          const response = await getWithRetry(`${baseUrl}products`, {}, { retries: 2, delayMs: 1200 });
          const fetchedProducts = Array.isArray(response.data)
            ? response.data
            : response.data.products;

          if (mounted) {
            const normalizedProducts = (fetchedProducts || []).map((product) => ({
              ...product,
              image: getImageUrl(product),
            }));
            setProducts(normalizedProducts);
          }
        } catch (error) {
          if (mounted) {
            if (isServiceUnavailableError(error)) {
              setLoadError("Server is waking up. Please retry in a few seconds.");
            } else {
              setLoadError("Could not load products right now.");
            }
            setProducts([]);
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

      loadData();

      return () => {
        mounted = false;
      };
    }, [])
  );

  const lowStockProducts = useMemo(() => {
    return [...products]
      .filter((item) => Number(item.countInStock || 0) <= threshold)
      .sort((a, b) => Number(a.countInStock || 0) - Number(b.countInStock || 0));
  }, [products, threshold]);

  const applyThreshold = async () => {
    const parsed = Number(thresholdInput);
    if (Number.isNaN(parsed) || parsed < 0) {
      setThresholdInput(String(threshold));
      return;
    }

    setThreshold(parsed);
    try {
      await AsyncStorage.setItem("adminLowStockThreshold", String(parsed));
      notifyLowStockUpdated();
    } catch (error) {
      console.log("Threshold save error:", error?.message || error);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={styles.itemRow}
      onPress={() => props.navigation.navigate("ProductForm", { item, title: "Edit Product" })}
    >
      <View style={styles.itemMain}>
        <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemSub} numberOfLines={1}>
          {item.brand || "No brand"} • {formatPrice(item.price || 0)}
        </Text>
      </View>
      <View style={styles.badgeWrap}>
        <Text style={styles.badgeText}>{Number(item.countInStock || 0)} left</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Low Stock Monitor</Text>
        <Text style={styles.subtitle}>Products at or below your minimum threshold</Text>
      </View>

      <View style={styles.thresholdRow}>
        <Text style={styles.thresholdLabel}>Minimum stock threshold</Text>
        <TextInput
          value={thresholdInput}
          onChangeText={(text) => setThresholdInput(text.replace(/[^0-9]/g, ""))}
          keyboardType="number-pad"
          maxLength={3}
          style={styles.thresholdInput}
          placeholder="0"
        />
        <TouchableOpacity onPress={applyThreshold} style={styles.applyBtn}>
          <Text style={styles.applyBtnText}>Set</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.countText}>{lowStockProducts.length} product(s) need attention</Text>
      {loadError ? <Text style={styles.errorText}>{loadError}</Text> : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#8a6c09" />
        </View>
      ) : (
        <FlatList
          data={lowStockProducts}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No low-stock products for this threshold.</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f6fa",
    padding: 14,
  },
  headerCard: {
    backgroundColor: "#9c1c1c",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  title: {
    color: "#fff",
    fontSize: 19,
    fontWeight: "700",
  },
  subtitle: {
    color: "#f7dede",
    marginTop: 3,
    fontSize: 12,
  },
  thresholdRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ead8d8",
    padding: 10,
    marginBottom: 10,
  },
  thresholdLabel: {
    flex: 1,
    fontSize: 13,
    color: "#374151",
    fontWeight: "600",
  },
  thresholdInput: {
    width: 62,
    height: 34,
    borderWidth: 1,
    borderColor: "#e1c0c0",
    borderRadius: 8,
    marginHorizontal: 8,
    paddingHorizontal: 8,
    backgroundColor: "#fff",
  },
  applyBtn: {
    backgroundColor: "#9c1c1c",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  applyBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 12,
  },
  countText: {
    color: "#6b7280",
    marginBottom: 10,
    fontSize: 12,
  },
  errorText: {
    color: "#9c1c1c",
    fontWeight: "600",
    marginBottom: 8,
    fontSize: 12,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ececec",
    padding: 12,
    marginBottom: 8,
  },
  itemMain: {
    flex: 1,
    marginRight: 8,
  },
  itemName: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "700",
  },
  itemSub: {
    marginTop: 2,
    fontSize: 12,
    color: "#6b7280",
  },
  badgeWrap: {
    backgroundColor: "#fde8e8",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: {
    color: "#9c1c1c",
    fontWeight: "700",
    fontSize: 12,
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyWrap: {
    paddingVertical: 30,
    alignItems: "center",
  },
  emptyText: {
    color: "#6b7280",
    fontSize: 13,
  },
});

export default LowStock;
