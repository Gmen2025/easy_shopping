import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome";
import { Searchbar } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import ListItem from "./ListItem";

import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";
import AsyncStorage from "@react-native-async-storage/async-storage";
import getImageUrl from "../../assets/common/getImageUrl";
import { getWithRetry, isServiceUnavailableError } from "../../assets/common/requestRetry";

var { height, width } = Dimensions.get("window");

const ListHeader = () => (
  <View style={styles.listHeader}>
    <Text style={[styles.headerItem, { width: width / 7 }]}>Image</Text>
    <Text style={styles.headerItem}>Brand</Text>
    <Text style={styles.headerItem}>Name</Text>
    <Text style={styles.headerItem}>Category</Text>
    <Text style={styles.headerItem}>Price</Text>
  </View>
);

const ActionButton = ({ icon, label, onPress, color = "#8a6c09" }) => (
  <TouchableOpacity style={[styles.actionBtn, { borderColor: color }]} onPress={onPress}>
    <Icon name={icon} size={16} color={color} />
    <Text style={[styles.actionBtnText, { color }]}>{label}</Text>
  </TouchableOpacity>
);

const Products = (props) => {
  const [productList, setProductList] = useState();
  const [productFilter, setProductFilter] = useState();
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState();
  const [search, setSearch] = useState("");
  const [loadError, setLoadError] = useState("");

  useFocusEffect(
    useCallback(() => {
      let mounted = true;
      AsyncStorage.getItem("token")
        .then((res) => setToken(res))
        .catch((error) => console.log(error));

      const loadProducts = async () => {
        setLoading(true);
        setLoadError("");

        try {
          const res = await getWithRetry(`${baseUrl}products`, {}, { retries: 2, delayMs: 1200 });
          if (!mounted) {
            return;
          }

          const fetchedProducts = Array.isArray(res.data) ? res.data : res.data.products;
          const normalizedProducts = (fetchedProducts || []).map((product) => ({
            ...product,
            image: getImageUrl(product),
          }));
          setProductList(normalizedProducts);
          setProductFilter(normalizedProducts);
        } catch (error) {
          if (!mounted) {
            return;
          }

          if (isServiceUnavailableError(error)) {
            setLoadError("Server is waking up. Please retry in a few seconds.");
          } else {
            setLoadError("Could not load products right now.");
          }
          setProductList([]);
          setProductFilter([]);
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

      loadProducts();

      return () => {
        mounted = false;
        setProductList();
        setProductFilter();
        setLoading(true);
        setLoadError("");
      };
    }, [])
  );

  const deleteProduct = (id) => {
    axios
      .delete(`${baseUrl}products/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then(() => {
        const updated = productFilter.filter((item) => item._id !== id);
        setProductFilter(updated);
        setProductList(updated);
      })
      .catch((error) => console.log("Api delete error: ", error));
  };

  return (
    <View style={styles.mainContainer}>
      {/* Navy header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Product Management</Text>
        <Text style={styles.headerSubtitle}>
          {productFilter ? `${productFilter.length} products` : "Loading…"}
        </Text>
        {loadError ? <Text style={styles.headerError}>{loadError}</Text> : null}
      </View>

      {/* Action buttons */}
      <View style={styles.actionRow}>
        <ActionButton
          icon="shopping-bag"
          label="Orders"
          color="#8a6c09"
          onPress={() => props.navigation.navigate("Orders")}
        />
        <ActionButton
          icon="plus-circle"
          label="Add Product"
          color="#2e7d32"
          onPress={() => props.navigation.navigate("ProductForm")}
        />
        <ActionButton
          icon="tags"
          label="Categories"
          color="#e65100"
          onPress={() => props.navigation.navigate("Categories")}
        />
        <ActionButton
          icon="exclamation-triangle"
          label="Low Stock"
          color="#9c1c1c"
          onPress={() => props.navigation.navigate("LowStock")}
        />
        <ActionButton
          icon="wrench"
          label="Maintenance"
          color="#d97706"
          onPress={() => props.navigation.navigate("MaintenanceSettings")}
        />
        <ActionButton
          icon="bank"
          label="Bank Account"
          color="#1d72d6"
          onPress={() => props.navigation.navigate("BankAccountSettings")}
        />
        <ActionButton
          icon="truck"
          label="Drivers"
          color="#0f766e"
          onPress={() => props.navigation.navigate("Drivers")}
        />
        <ActionButton
          icon="building"
          label="Store Owners"
          color="#2563eb"
          onPress={() => props.navigation.navigate("StoreOwners")}
        />
      </View>

      {/* Search */}
      <View style={styles.searchWrapper}>
        <Searchbar
          placeholder="Search products…"
          onChangeText={(text) => {
            setSearch(text);
            if (text) {
              setProductFilter(
                productList.filter((item) =>
                  (item.name || "").toUpperCase().includes(text.toUpperCase())
                )
              );
            } else {
              setProductFilter(productList);
            }
          }}
          value={search}
          style={styles.searchBar}
          inputStyle={{ fontSize: 14 }}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.spinner}>
          <ActivityIndicator size="large" color="#8a6c09" />
          <Text style={styles.loadingText}>Loading products…</Text>
        </View>
      ) : (
        <FlatList
          data={productFilter}
          ListHeaderComponent={ListHeader}
          stickyHeaderIndices={[0]}
          ListFooterComponent={<View style={{ marginBottom: 120 }} />}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <ListItem
              item={item}
              navigation={props.navigation}
              index={index}
              delete={deleteProduct}
            />
          )}
          keyExtractor={(item) => item._id}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#f5f6fa",
  },
  header: {
    backgroundColor: "#8a6c09",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 16,
  },
  headerTitle: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    marginTop: 2,
  },
  headerError: {
    color: "#ffe0e0",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "600",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e9dfc4",
    rowGap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    backgroundColor: "#fff",
    width: "48%",
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  searchWrapper: {
    marginHorizontal: 14,
    marginVertical: 10,
  },
  searchBar: {
    backgroundColor: "#fff",
    borderRadius: 10,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  spinner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: height / 4,
  },
  loadingText: {
    marginTop: 10,
    color: "#9e9e9e",
    fontSize: 14,
  },
  listHeader: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 6,
    backgroundColor: "#e9dfc4",
    borderBottomWidth: 1,
    borderBottomColor: "#c5cae9",
  },
  headerItem: {
    fontWeight: "700",
    fontSize: 11,
    color: "#8a6c09",
    width: width / 6,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
});

export default Products;
