import React, { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import Icon from "react-native-vector-icons/FontAwesome";
import { financeError, financeMoney, financeRequest } from "../assets/common/finance";

const CURRENCY_META = {
  ETB: { flag: "🇪🇹", caption: "Income Summary in ETB" },
  USD: { flag: "🇺🇸", caption: "Income Summary in USD" },
};

const SUMMARY_ROWS = [
  ["money", "AdduGenet total income", "adduGenetIncome"],
  ["car", "AdduGenet-owned sales & driving", "ownedIncome"],
  ["globe", "Independent platform fees", "platformFees"],
  ["wrench", "Service fulfillment (AdduGenet)", "serviceIncome"],
  ["users", "Independent operators' net income", "independentIncome"],
  ["file-text", "Unassigned income (admin review)", "unallocatedIncome"],
];

const CATEGORY_ICONS = { products: "cube", delivery: "truck", rides: "motorcycle", services: "cog" };

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
    <View style={styles.banner}>
      <View style={styles.bannerIcon}>
        <Icon name="line-chart" size={22} color="#fff" />
      </View>
      <View style={styles.bannerTextWrap}>
        <Text style={styles.bannerTitle}>Ownership & Income</Text>
        <Text style={styles.bannerSubtitle}>Income and account summary</Text>
      </View>
    </View>

    <View style={styles.noticeBox}>
      <View style={styles.noticeCheck}>
        <Icon name="check" size={12} color="#fff" />
      </View>
      <Text style={styles.noticeText}>Completed income, not all collected cash. Currencies are not combined.</Text>
    </View>

    {loading ? <ActivityIndicator color="#b8860b" style={styles.loader} /> : null}
    {error ? <TouchableOpacity onPress={load}><Text style={styles.error}>{error} Tap to retry.</Text></TouchableOpacity> : null}

    {data ? Object.entries(data.reports).map(([currency, periods]) => {
      const report = periods[period];
      const meta = CURRENCY_META[currency] || { flag: "", caption: `Income Summary in ${currency}` };
      return <View key={currency} style={styles.section}>
        <View style={styles.currencyHeader}>
          <View style={styles.currencyBadge}>
            <Icon name="dollar" size={18} color="#b8860b" />
          </View>
          <View style={styles.currencyTextWrap}>
            <Text style={styles.currencyTitle}>{currency}</Text>
            <Text style={styles.currencyCaption}>{meta.caption}</Text>
          </View>
          <Text style={styles.currencyFlag}>{meta.flag}</Text>
        </View>

        {SUMMARY_ROWS.map(([icon, label, key], index) => (
          <View key={label} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
            <Icon name={icon} size={15} color="#1e3a8a" style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{label}:</Text>
            <Text style={styles.rowValue}>{financeMoney(report[key], currency)}</Text>
          </View>
        ))}

        {Object.entries(report.categories).map(([category, values], index) => (
          <View key={category} style={[styles.row, index % 2 === 1 && styles.rowAlt]}>
            <Icon name={CATEGORY_ICONS[category] || "tag"} size={15} color="#1e3a8a" style={styles.rowIcon} />
            <Text style={styles.rowLabel}>{category}:</Text>
            <Text style={styles.rowCategoryValue}>
              AdduGenet {financeMoney(values.adduGenetIncome, currency)} / Independent {financeMoney(values.independentIncome, currency)}
            </Text>
          </View>
        ))}
      </View>;
    }) : null}

    <View style={styles.infoBox}>
      <Icon name="info-circle" size={15} color="#1d4ed8" style={styles.rowIcon} />
      <Text style={styles.infoText}>Automatic transfers unavailable: no payout provider is connected.</Text>
    </View>

    <TouchableOpacity style={styles.button} onPress={() => navigation.navigate("FinanceAccounts")}>
      <Text style={styles.buttonText}>Stores & drivers: dashboards, fees and payout access</Text>
    </TouchableOpacity>
  </View>;
}

const styles = StyleSheet.create({
  card: { marginVertical: 12, borderRadius: 16, backgroundColor: "#fff", overflow: "hidden", borderWidth: 1, borderColor: "#e5e7eb" },
  banner: { flexDirection: "row", alignItems: "center", backgroundColor: "#c99700", paddingVertical: 16, paddingHorizontal: 16, gap: 12 },
  bannerIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { color: "#fff", fontSize: 20, fontWeight: "800" },
  bannerSubtitle: { color: "#fdf3d7", fontSize: 12, marginTop: 2 },
  noticeBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fdf6dd", borderRadius: 10, margin: 12, padding: 12 },
  noticeCheck: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#16a34a", alignItems: "center", justifyContent: "center" },
  noticeText: { flex: 1, color: "#1f2937", fontSize: 13, fontWeight: "600" },
  loader: { marginVertical: 8 },
  error: { color: "#b91c1c", marginHorizontal: 12, marginVertical: 10 },
  section: { marginHorizontal: 12, marginBottom: 14, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#f1f2f6" },
  currencyHeader: { flexDirection: "row", alignItems: "center", backgroundColor: "#c99700", paddingVertical: 12, paddingHorizontal: 14, gap: 10 },
  currencyBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  currencyTextWrap: { flex: 1 },
  currencyTitle: { color: "#fff", fontSize: 18, fontWeight: "800" },
  currencyCaption: { color: "#fdf3d7", fontSize: 11, marginTop: 1 },
  currencyFlag: { fontSize: 24 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 12, backgroundColor: "#fff", gap: 8 },
  rowAlt: { backgroundColor: "#eef0f4" },
  rowIcon: { width: 20, textAlign: "center" },
  rowLabel: { flexShrink: 1, color: "#111827", fontSize: 13 },
  rowValue: { flex: 1, color: "#111827", fontSize: 14, fontWeight: "800", textAlign: "right" },
  rowCategoryValue: { flex: 1, color: "#111827", fontSize: 12, fontWeight: "700", textAlign: "right" },
  infoBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#dbeafe", borderRadius: 10, marginHorizontal: 12, marginBottom: 12, padding: 12 },
  infoText: { flex: 1, color: "#1d4ed8", fontSize: 13, fontWeight: "700" },
  button: { backgroundColor: "#0f766e", borderRadius: 10, padding: 13, marginHorizontal: 12, marginBottom: 14 },
  buttonText: { color: "#fff", fontWeight: "700", textAlign: "center" },
});
