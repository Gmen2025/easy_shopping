import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { financialMoney } from "../assets/common/financialManagement";
import { FinancialCard } from "./FinancialForm";

export function FinancialMetrics({ rows, currency }) {
  return <View style={styles.metrics}>
    {rows.map(({ label, minor }) => <View key={label} style={styles.metric}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{financialMoney(minor, currency)}</Text>
    </View>)}
  </View>;
}

export function FinancialChart({ title, rows, currency, help }) {
  const maximum = Math.max(1, ...rows.flatMap((row) => row.values.map((value) => Math.abs(value.minor))));
  return <FinancialCard title={title}>
    {help ? <Text style={styles.help}>{help}</Text> : null}
    {rows.length ? rows.map((row) => <View key={row.label} style={styles.chartRow}>
      <Text style={styles.label}>{row.label}</Text>
      {row.values.map((value, index) => <View key={value.label}>
        <Text style={styles.help}>{value.label}: {financialMoney(value.minor, currency)}</Text>
        <View accessibilityLabel={`${row.label}, ${value.label}: ${financialMoney(value.minor, currency)}`} style={styles.track}>
          <View style={[styles.bar, { width: `${Math.min(100, Math.abs(value.minor) / maximum * 100)}%`,
            backgroundColor: value.minor < 0 ? "#b91c1c" : ["#0369a1", "#b45309", "#15803d"][index % 3] }]} />
        </View>
      </View>)}
    </View>) : <Text>No activity for this period.</Text>}
  </FinancialCard>;
}

export function FinancialStatement({ title, rows, currency, help }) {
  return <FinancialCard title={title}>
    {help ? <Text style={styles.help}>{help}</Text> : null}
    {rows.map((row) => <View key={row.label} style={styles.statementRow}>
      <Text style={row.total ? styles.total : styles.label}>{row.label}</Text>
      <Text style={row.total ? styles.total : styles.help}>{financialMoney(row.minor, currency)}</Text>
    </View>)}
  </FinancialCard>;
}

const styles = StyleSheet.create({
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { backgroundColor: "#fff", borderRadius: 10, padding: 14, minWidth: 140, flexGrow: 1, flexBasis: "45%", gap: 8 },
  label: { fontWeight: "600", color: "#334155" },
  value: { fontSize: 20, fontWeight: "800", color: "#0f172a" },
  help: { color: "#475569", lineHeight: 20 },
  chartRow: { gap: 5, marginVertical: 5 },
  track: { height: 8, backgroundColor: "#e2e8f0", borderRadius: 4, overflow: "hidden", marginVertical: 4 },
  bar: { height: 8, borderRadius: 4 },
  statementRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, paddingVertical: 7, borderBottomWidth: 1, borderColor: "#e2e8f0" },
  total: { fontWeight: "800", color: "#0f172a" },
});
