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
  ["sameDayBase", "Express base fee (legacy checkout)"],
  ["sameDayPerKm", "Express fee per km (legacy checkout)"],
  ["sameDayPremium", "Express premium (legacy checkout)"],
  ["nextDayBase", "Standard base fee (legacy checkout)"],
  ["nextDayPerKm", "Standard fee per km (legacy checkout)"],
  ["scheduledBase", "Scheduled base fee"],
  ["scheduledPerKm", "Scheduled fee per km"],
  ["scheduledPeakSurcharge", "Scheduled peak surcharge (5-8 PM)"],
  ["scheduledOffPeakDiscount", "Scheduled off-peak discount (10 AM-3 PM)"],
];
const WINDOW_FIELDS = [
  ["expressMinBusinessDays", "Express earliest business day"],
  ["expressMaxBusinessDays", "Express latest business day"],
  ["standardMinBusinessDays", "Standard earliest business day"],
  ["standardMaxBusinessDays", "Standard latest business day"],
];
const SPEED_FIELDS = [
  ["expressSurcharge", "Express surcharge per vehicle delivery"],
  ["standardSurcharge", "Standard surcharge per vehicle delivery"],
  ["scheduledSurcharge", "Scheduled surcharge per vehicle delivery"],
];
const HOUR_FIELDS = [
  ["businessDayStartHour", "Earliest delivery hour (0-23)"],
  ["businessDayEndHour", "Latest delivery hour (1-24)"],
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
  expressMinBusinessDays: 1,
  expressMaxBusinessDays: 2,
  standardMinBusinessDays: 2,
  standardMaxBusinessDays: 5,
  expressSurcharge: 0,
  standardSurcharge: 0,
  scheduledSurcharge: 0,
  businessDayStartHour: 9,
  businessDayEndHour: 18,
  businessTimeZone: "",
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
        const settings = await getDeliverySettings({ token, allowCached: false });
        if (!settings?.deliveryConfig) {
          throw new Error("Delivery pricing is unavailable.");
        }
        setDeliveryConfig({ ...DEFAULT_DELIVERY_CONFIG, ...settings.deliveryConfig });
      } catch (error) {
        setDeliveryConfig({});
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
    const normalizedConfig = { ...deliveryConfig };

    for (const [field] of [...DELIVERY_FIELDS, ...WINDOW_FIELDS, ...SPEED_FIELDS, ...HOUR_FIELDS]) {
      const value = Number(deliveryConfig[field]);
      if (deliveryConfig[field] === "" || deliveryConfig[field] == null || !Number.isFinite(value) || value < 0 ||
          (WINDOW_FIELDS.some(([key]) => key === field) && (!Number.isInteger(value) || value < 1 || value > 30)) ||
          (HOUR_FIELDS.some(([key]) => key === field) && (!Number.isInteger(value) ||
            value > (field === "businessDayEndHour" ? 24 : 23) || (field === "businessDayEndHour" && value < 1)))) {
        Toast.show({
          type: "error",
          text1: "Enter valid delivery prices",
          text2: "Fees must be non-negative. Days must be whole numbers from 1 to 30; start hour 0-23 and end hour 1-24.",
        });
        return;
      }
      normalizedConfig[field] = value;
    }
    if (normalizedConfig.expressMinBusinessDays > normalizedConfig.expressMaxBusinessDays ||
        normalizedConfig.standardMinBusinessDays > normalizedConfig.standardMaxBusinessDays ||
        normalizedConfig.businessDayStartHour >= normalizedConfig.businessDayEndHour) {
      Toast.show({ type: "error", text1: "Invalid delivery window", text2: "Earliest day cannot exceed latest day; the start hour must be before the end hour." });
      return;
    }
    normalizedConfig.businessTimeZone = String(deliveryConfig.businessTimeZone || "").trim();

    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (await getDatabaseNameFromStorage() !== databaseName) throw new Error("Region changed. Reopen delivery settings before saving.");
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
            Express: 1-2 business days by default. Standard: 2-5. Business days are Monday-Friday; holidays are not excluded.
          </Text>
        </View>
        <Text style={styles.title}>Delivery windows</Text>
        {WINDOW_FIELDS.map(([field, label]) => <View key={field} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <Input name={field} value={deliveryConfig[field] == null ? "" : String(deliveryConfig[field])}
            onChangeText={(value) => updateField(field, value)} keyboardType="number-pad" />
        </View>)}
        <Text style={styles.description}>Delivery hours use the configured IANA time zone. Leave it blank for America/New_York in USA or Africa/Addis_Ababa in Ethiopia. Confirm the USA time zone matches your operation.</Text>
        <View style={styles.field}>
          <Text style={styles.label}>Business time zone</Text>
          <Input name="businessTimeZone" value={deliveryConfig.businessTimeZone || ""}
            placeholder="Regional default" autoCapitalize="none" autoCorrect={false}
            onChangeText={(value) => updateField("businessTimeZone", value)} />
        </View>
        {HOUR_FIELDS.map(([field, label]) => <View key={field} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <Input name={field} value={deliveryConfig[field] == null ? "" : String(deliveryConfig[field])}
            onChangeText={(value) => updateField(field, value)} keyboardType="number-pad" />
        </View>)}
        <Text style={styles.title}>Multi-delivery speed pricing</Text>
        <Text style={styles.description}>These surcharges are added once per pickup/destination delivery to the configured vehicle fee. Defaults are zero. Vehicle capacity and distance pricing stay in Vehicle Delivery Settings.</Text>
        {[...SPEED_FIELDS, ...DELIVERY_FIELDS].map(([field, label]) => (
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