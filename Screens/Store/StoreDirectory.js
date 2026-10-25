import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import StoreLogo from "../../Shared/StoreLogo";
import { useFocusEffect } from "@react-navigation/native";
import { storeRequest } from "../../assets/common/storefront";

const StoreDirectory = ({ navigation }) => {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setStores(await storeRequest("directory")); }
    catch (failure) { setError(failure.response?.data?.message || "Unable to load stores. Please retry."); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <FlatList
      style={styles.screen} contentContainerStyle={styles.content}
      data={stores.filter((store) => !store.parentStore)} keyExtractor={(store) => store._id}
      refreshing={loading} onRefresh={load}
      ListHeaderComponent={<Text style={styles.title}>Shop by store</Text>}
      ListEmptyComponent={loading ? <ActivityIndicator /> : <Text>{error || "No stores are available yet."}</Text>}
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.card} accessibilityRole="button" onPress={() => navigation.navigate("Storefront", { storeId: item._id })}>
          <StoreLogo name={item.name} logo={item.logo} />
          <View style={styles.details}>
            <Text style={styles.name}>{item.name}</Text>
            <Text>{item.address}</Text>
            <Text>{stores.filter((store) => store.parentStore === item._id).length} branches</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
};
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#f3f6fb" },
  content: { padding: 16 },
  title: { fontSize: 24, fontWeight: "700", marginBottom: 16 },
  card: { backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 12, flexDirection: "row", gap: 12 },
  details: { flex: 1 },
  name: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
});
export default StoreDirectory;
