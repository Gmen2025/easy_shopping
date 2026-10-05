import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import Icon from "react-native-vector-icons/FontAwesome";

import baseUrl from "../../assets/common/baseUrl";
import Input from "../../Shared/Form/Input";
import FormContainer from "../../Shared/Form/FormContainer";
import EasyButton from "../../Shared/StyledComponenets/EasyButton";
import { getCurrencyConfigForDatabase } from "../../assets/common/currency";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { cacheDeliverySettings, getDeliverySettings, getDeliveryDistanceUnit } from "../../assets/common/delivery";

const DELIVERY_FIELDS = [
  ["sameDayBase", "Same-day base fee"],
  ["sameDayPerKm", "Same-day fee per km"],
  ["sameDayPremium", "Same-day premium"],
  ["nextDayBase", "Next-day base fee"],
  ["nextDayPerKm", "Next-day fee per km"],
  ["scheduledBase", "Scheduled base fee"],
  ["scheduledPerKm", "Scheduled fee per km"],
  ["scheduledPeakSurcharge", "Scheduled peak surcharge (5-8 PM)"],
  ["scheduledOffPeakDiscount", "Scheduled off-peak discount (10 AM-3 PM)"],
];

const DEFAULT_DELIVERY_CONFIG = {
  sameDayBase: 9,
  sameDayPerKm: 1,
  sameDayPremium: 4,
  nextDayBase: 4,
  nextDayPerKm: 0.6,
  scheduledBase: 5,
  scheduledPerKm: 0.75,
  scheduledPeakSurcharge: 1.5,
  scheduledOffPeakDiscount: 0.5,
};

const DeliverySettings = () => {
  const [deliveryConfig, setDeliveryConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currencyCode, setCurrencyCode] = useState("ETB");
  const [databaseName, setDatabaseName] = useState("E_Shopping");
  const distanceUnit = getDeliveryDistanceUnit(databaseName);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const selectedDatabaseName = await getDatabaseNameFromStorage();
        setDatabaseName(selectedDatabaseName);
        setCurrencyCode(getCurrencyConfigForDatabase(selectedDatabaseName).code);
        const token = await AsyncStorage.getItem("token");
        const settings = await getDeliverySettings({ token });
        if (!settings?.deliveryConfig) {
          throw new Error("Delivery pricing is unavailable.");
        }
        setDeliveryConfig({ ...DEFAULT_DELIVERY_CONFIG, ...settings.deliveryConfig });
      } catch (error) {
        setDeliveryConfig(DEFAULT_DELIVERY_CONFIG);
        Toast.show({
          type: "error",
          text1: "Could not load delivery pricing",
          text2: "Please try again.",
        });
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateField = (field, value) => {
    setDeliveryConfig((currentConfig) => ({ ...currentConfig, [field]: value }));
  };

  const saveSettings = async () => {
    const normalizedConfig = {};

    for (const [field] of DELIVERY_FIELDS) {
      const value = Number(deliveryConfig[field]);
      if (!Number.isFinite(value) || value < 0) {
        Toast.show({
          type: "error",
          text1: "Enter valid delivery prices",
          text2: "Every delivery setting must be zero or greater.",
        });
        return;
      }
      normalizedConfig[field] = value;
    }

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const response = await axios.put(
        `${baseUrl}settings/delivery`,
        { deliveryConfig: normalizedConfig },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }
      );
      const savedConfig = response.data?.deliveryConfig || normalizedConfig;
      await cacheDeliverySettings(savedConfig);
      setDeliveryConfig(savedConfig);
      Toast.show({
        type: "success",
        text1: "Delivery pricing saved",
        text2: "New checkout calculations will use these rates.",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Could not save delivery pricing",
        text2: error.response?.data?.message || "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <FormContainer title="Delivery Pricing">
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#1d72d6" />
        </View>
      </FormContainer>
    );
  }

  return (
    <FormContainer title="Delivery Pricing">
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Icon name="truck" size={32} color="#0f766e" />
          <Text style={styles.title}>Delivery Cost Settings</Text>
          <Text style={styles.description}>
            These {currencyCode} rates apply only to the selected {databaseName} database.
          </Text>
          <Text style={styles.rateHint}>
            Same-day fee = base fee + premium + (distance x fee per {distanceUnit}). Store coordinates are required for distance charges.
          </Text>
        </View>
        {DELIVERY_FIELDS.map(([field, label]) => (
          <View key={field} style={styles.field}>
            <Text style={styles.label}>{label.replace("per km", `per ${distanceUnit}`)} ({currencyCode})</Text>
            <Input
              placeholder="0"
              name={field}
              value={deliveryConfig[field] === undefined ? "" : String(deliveryConfig[field])}
              onChangeText={(value) => updateField(field, value)}
              keyboardType="decimal-pad"
            />
          </View>
        ))}
        <EasyButton primary large disabled={saving} onPress={saveSettings} style={styles.saveButton}>
          {saving ? <ActivityIndicator color="#ffffff" /> : <Text style={styles.saveText}>Save Delivery Pricing</Text>}
        </EasyButton>
      </ScrollView>
    </FormContainer>
  );
};

const styles = StyleSheet.create({
  container: { padding: 18, paddingBottom: 36 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { alignItems: "center", marginBottom: 22 },
  title: { fontSize: 21, fontWeight: "700", color: "#152642", marginTop: 8 },
  description: { color: "#4b5563", lineHeight: 20, marginTop: 6, textAlign: "center" },
  rateHint: { color: "#0f766e", lineHeight: 20, marginTop: 8, textAlign: "center" },
  field: { marginBottom: 12 },
  label: { color: "#374151", fontSize: 14, fontWeight: "600", marginBottom: 4 },
  saveButton: { marginTop: 12 },
  saveText: { color: "#ffffff", fontWeight: "700" },
});

export default DeliverySettings;