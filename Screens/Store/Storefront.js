import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from "react-native";
import StoreLogo from "../../Shared/StoreLogo";
import { useFocusEffect } from "@react-navigation/native";
import { storeRequest } from "../../assets/common/storefront";
import ProductList from "../Products/ProductList";

const Storefront = ({ navigation, route }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setData(await storeRequest(`directory/${route.params.storeId}/products`)); }
    catch (failure) { setData(null); setError(failure.response?.data?.message || "Unable to load this storefront. Please retry."); }
    finally { setLoading(false); }
  }, [route.params.storeId]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <FlatList
      style={styles.screen} data={data?.products || []} numColumns={2}
      keyExtractor={(item) => item._id} refreshing={loading} onRefresh={load}
      ListHeaderComponent={
        <View style={styles.header}>
          <StoreLogo name={data?.store.name} logo={data?.store.logo} size={80} />
          <Text style={styles.title}>{data?.store.name || "Store products"}</Text>
          <Text>{data?.store.address}</Text>
          <Text selectable>Store ID: {route.params.storeId}</Text>
          <Text>{data?.store.description}</Text>
          <Text style={styles.note}>Fulfilled by this store or its nearest eligible branch, at the displayed price. Stock includes matching-price branches.</Text>
        </View>
      }
      ListEmptyComponent={loading ? <ActivityIndicator /> : <Text style={styles.header}>{error || "This store has no products yet."}</Text>}
      renderItem={({ item }) => <ProductList item={item} navigation={navigation} />}
    />
  );
};
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6fb" },
  header: { padding: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 8 },
  note: { color: "#6b7280", marginTop: 12 },
});
export default Storefront;
