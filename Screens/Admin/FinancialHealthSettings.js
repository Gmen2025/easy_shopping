import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Switch, Text, TouchableOpacity } from "react-native";
import useFinancialHealth from "../../assets/common/useFinancialHealth";
import { saveFinancialHealthSettings } from "../../assets/common/financialHealth";

export default function FinancialHealthSettings() {
  const availability = useFinancialHealth();
  const [saving, setSaving] = useState(false);
  const save = async (enabled) => {
    if (saving || availability.enabled === null) return;
    setSaving(true);
    try {
      await saveFinancialHealthSettings(enabled);
      await availability.reload();
      Alert.alert("Saved", enabled ? "Financial Health is available to signed-in customers." :
        "Financial Health is disabled. Customer records are preserved.");
    } catch (failure) {
      Alert.alert("Unable to save availability", failure.response?.data?.message || failure.message);
    } finally { setSaving(false); }
  };
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text style={{ fontSize: 22, fontWeight: "700" }}>Financial Health service</Text>
    <Text>Enable customer revenue, expense and financial statements</Text>
    <Switch accessibilityLabel="Enable Financial Health service" value={availability.enabled === true}
      disabled={saving || availability.enabled === null} onValueChange={save} />
    {saving || (availability.enabled === null && !availability.error) ? <ActivityIndicator /> : null}
    {availability.error ? <TouchableOpacity onPress={availability.reload}>
      <Text accessibilityRole="alert">{availability.error} Tap to retry.</Text>
    </TouchableOpacity> : null}
    <Text>Off by default for this shopping region. Off hides the customer badge and blocks customer financial reads and writes without deleting records. Turning it back on restores access.</Text>
    <Text>Each signed-in customer has private personal and business ledgers. This switch never changes the admin Revenue and Expense Tracker or grants access to customer records.</Text>
  </ScrollView>;
}
