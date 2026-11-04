import React, { useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Switch, Text, TouchableOpacity } from "react-native";
import useCatalogPricing from "../../assets/common/useCatalogPricing";
import { saveCatalogSettings } from "../../assets/common/catalog";

export default function CatalogSettings() {
  const pricing = useCatalogPricing();
  const [saving, setSaving] = useState(false);
  const save = async (enabled) => {
    if (saving || pricing.enabled === null) return;
    setSaving(true);
    try {
      await saveCatalogSettings(enabled);
      await pricing.reload();
      Alert.alert("Saved", enabled ? "Customers must select a location to see the nearest available store's price." : "Main catalog prices are visible again.");
    } catch (failure) {
      Alert.alert("Unable to save pricing", failure.response?.data?.message || failure.message);
    } finally { setSaving(false); }
  };
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text style={{ fontSize: 22, fontWeight: "700" }}>Catalog pricing</Text>
    <Text>Use nearest-store prices</Text>
    <Switch accessibilityLabel="Use nearest-store prices" value={pricing.enabled === true}
      disabled={saving || pricing.enabled === null} onValueChange={save} />
    {saving || (pricing.enabled === null && !pricing.error) ? <ActivityIndicator /> : null}
    {pricing.error ? <TouchableOpacity onPress={pricing.reload}><Text accessibilityRole="alert">{pricing.error} Tap to retry.</Text></TouchableOpacity> : null}
    <Text>On: hide main-screen and search prices. Product details require a customer location and show the nearest available store's own price. Checkout uses that store's inventory.</Text>
    <Text>Off (default): keep current catalog prices and shopping behavior. Individual storefronts always show their own prices.</Text>
    <Text>Migrate store inventory before enabling. Existing main-catalog cart items must be removed and re-added from product details while this is on.</Text>
  </ScrollView>;
}
