import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { financeError, financeRequest } from "../../assets/common/finance";

export default function FinanceAccounts({ navigation }) {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setAccounts(await financeRequest("admin/accounts")); }
    catch (failure) { setAccounts([]); setError(financeError(failure)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const filtered = accounts.filter((account) => (filter === "all" ||
    (filter === "owned" ? account.isCompanyOwned : !account.isCompanyOwned)) &&
    `${account.name} ${account.kind} ${account.email}`.toLowerCase().includes(search.toLowerCase()));
  return <View style={styles.screen}>
    <Text style={styles.heading}>Store & driver income</Text>
    <TextInput style={styles.input} placeholder="Search name, store, driver or email" value={search} onChangeText={setSearch} />
    <View style={styles.filters}>
      {["all", "owned", "independent"].map((key) => <TouchableOpacity key={key} onPress={() => setFilter(key)} style={styles.button}>
        <Text style={{ color: filter === key ? "#0f766e" : "#475569", fontWeight: "700" }}>{key === "owned" ? "AdduGenet-owned" : key}</Text>
      </TouchableOpacity>)}
    </View>
    {error ? <TouchableOpacity onPress={load}><Text style={styles.error}>{error} Tap to retry.</Text></TouchableOpacity> : null}
    {loading ? <ActivityIndicator /> : <FlatList data={filtered} onRefresh={load} refreshing={loading}
      keyExtractor={(item) => `${item.kind}:${item._id}`}
      ListEmptyComponent={<Text>No matching accounts.</Text>}
      renderItem={({ item }) => <TouchableOpacity style={styles.card}
        accessibilityLabel={`Open ${item.name} income dashboard`}
        onPress={() => navigation.navigate("IncomeDashboard", { kind: item.kind, accountId: item._id, admin: true })}>
        <Text style={styles.name}>{item.name}</Text>
        <Text>{item.kind} - {item.isCompanyOwned ? "AdduGenet-owned" : "Independent"}</Text>
        <Text>Payout requests {item.payoutsEnabled ? "enabled" : "disabled"} - {item.approvalStatus}</Text>
        <Text style={styles.link}>View income, products, fees & payout access</Text>
      </TouchableOpacity>} />}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 16, backgroundColor: "#f8fafc" },
  heading: { fontSize: 22, fontWeight: "700", marginBottom: 12, color: "#0f172a" },
  input: { padding: 12, borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 8, backgroundColor: "#fff" },
  filters: { flexDirection: "row", flexWrap: "wrap", marginVertical: 12 },
  button: { padding: 8 }, card: { padding: 16, backgroundColor: "#fff", borderRadius: 8, marginBottom: 12 },
  name: { fontWeight: "700", fontSize: 17, marginBottom: 6 }, link: { color: "#0f766e", marginTop: 8 }, error: { color: "#b91c1c", padding: 12 },
});
