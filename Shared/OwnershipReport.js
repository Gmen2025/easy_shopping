import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { financeError, financeMoney, financeRequest } from "../assets/common/finance";

export default function OwnershipReport({ period, navigation }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try { setData(await financeRequest("admin/report")); }
    catch (failure) { setData(null); setError(financeError(failure)); }
    finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return <View style={styles.card}>
    <Text style={styles.heading}>Ownership & income</Text>
    <Text>Completed income, not all collected cash. Currencies are not combined.</Text>
    {loading ? <ActivityIndicator /> : null}
    {error ? <TouchableOpacity onPress={load}><Text style={styles.error}>{error} Tap to retry.</Text></TouchableOpacity> : null}
    {data ? Object.entries(data.reports).map(([currency, periods]) => {
      const report = periods[period];
      return <View key={currency} style={styles.section}>
        <Text style={styles.heading}>{currency}</Text>
        {[
          ["AdduGenet total income", report.adduGenetIncome],
          ["AdduGenet-owned sales & driving", report.ownedIncome],
          ["Independent platform fees", report.platformFees],
          ["Service fulfillment (AdduGenet)", report.serviceIncome],
          ["Independent operators' net income", report.independentIncome],
          ["Unassigned income (admin review)", report.unallocatedIncome],
        ].map(([label, value]) => <Text key={label} style={styles.row}>{label}: {financeMoney(value, currency)}</Text>)}
        {Object.entries(report.categories).map(([category, values]) =>
          <Text key={category} style={styles.row}>{category}: AdduGenet {financeMoney(values.adduGenetIncome, currency)} / Independent {financeMoney(values.independentIncome, currency)}</Text>)}
      </View>;
    }) : null}
    <Text style={styles.row}>Automatic transfers unavailable: no payout provider is connected.</Text>
    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("FinanceAccounts")}>
      <Text style={styles.buttonText}>Stores & drivers: dashboards, fees and payout access</Text>
    </TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: 16, marginVertical: 12, borderRadius: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d1d5db" },
  heading: { fontSize: 17, fontWeight: "700", color: "#0f172a", marginBottom: 8 },
  section: { borderTopWidth: 1, borderColor: "#e5e7eb", paddingTop: 12, marginTop: 12 },
  row: { color: "#334155", marginVertical: 4 },
  error: { color: "#b91c1c", marginVertical: 10 },
  button: { backgroundColor: "#0f766e", borderRadius: 8, padding: 12, marginTop: 12 },
  buttonText: { color: "#fff", fontWeight: "600" },
});
