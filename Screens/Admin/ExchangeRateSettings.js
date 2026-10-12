import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, ScrollView, Text, View } from "react-native";
import { Button, Switch, TextInput } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { exchangeRequest, rateIsActive, usdInactiveMessage, exportInactiveMessage } from "../../assets/common/exchangeRate";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { styles } from "../../Shared/DeliveryCheckout";

export default function ExchangeRateSettings({ navigation }) {
  const [config, setConfig] = useState(null);
  const [savedPolicy, setSavedPolicy] = useState(null);
  const [rate, setRate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const [database, setDatabase] = useState("");
  const international = /usa/i.test(database);
  const running = useRef(false);
  const region = useRef("");
  const run = async (action) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError("");
    try {
      const db = await getDatabaseNameFromStorage();
      if (region.current && region.current !== db) throw new Error("Region changed. Reopen exchange settings.");
      region.current = db;
      setDatabase(db);
      await action();
    } catch (failure) {
      const message = failure.response?.data?.message || failure.message;
      setError(message); Alert.alert("Exchange settings", message);
    } finally { running.current = false; setBusy(false); }
  };
  const load = async () => {
    const result = await exchangeRequest();
    setConfig(result); setSavedPolicy(result); setRate(result.birrPerUsd == null ? "" : String(result.birrPerUsd)); setNow(Date.now());
  };
  useEffect(() => {
    run(load);
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const apply = (path, data) => run(async () => {
    await exchangeRequest(path, { method: "post", data });
    await load();
    Alert.alert("Rate update applied", "A new timestamp and revision were recorded, even if the numerical exchange rate stayed the same.");
  });
  return <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{international ? "USA products in birr / Ethiopia shipping" : "Ethiopia USD purchases"}</Text>
    <Text>{international ? "Rate convention: birr per 1 US dollar. ETB = total USD (products + US hub delivery + shipping) multiplied by the rate. Products only; no service or ride birr payments." :
      "Rate convention: birr per 1 US dollar. USD = birr total / rate. Products and non-ride quoted services stay in Ethiopia; passenger rides are excluded."}</Text>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    <Button disabled={busy} onPress={() => run(load)}>Reload saved settings / status</Button>
    {config ? <>
      <View style={styles.card}>
        <Text style={styles.heading}>{international ? "Allow birr checkout for USA exports" : "Allow USD purchasing"}</Text>
        <Switch disabled={busy} value={Boolean(config.enabled)} onValueChange={(enabled) => setConfig((previous) => ({ ...previous, enabled }))} />
        <Text style={styles.heading}>Automatically refresh expired rates</Text>
        <Switch disabled={busy} value={Boolean(config.autoRefresh)} onValueChange={(autoRefresh) => setConfig((previous) => ({ ...previous, autoRefresh }))} />
        <Picker enabled={!busy} selectedValue={config.provider || ""} onValueChange={(provider) => setConfig((previous) => ({ ...previous, provider }))}>
          <Picker.Item label="Choose server-configured provider..." value="" />
          {(config.providers || []).map((provider) => <Picker.Item key={provider} label={provider} value={provider} />)}
        </Picker>
        {!config.providers?.length ? <Text>No automatic providers configured. Configure a provider on the backend or use manual Apply.</Text> : null}
        <Text>Saving these toggles does not refresh the rate or extend its expiry. Save the provider before fetching.</Text>
        <Button mode="contained" disabled={busy} onPress={() => run(async () => {
          await exchangeRequest("", { method: "put", data: { enabled: Boolean(config.enabled), autoRefresh: Boolean(config.autoRefresh), provider: config.provider || "" } });
          await load(); Alert.alert("Saved", "Cross-currency checkout and automation settings saved. The last applied timestamp is unchanged.");
        })}>Save service & automation settings</Button>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Manual daily exchange rate</Text>
        <TextInput label="Birr for 1 USD" value={rate} keyboardType="decimal-pad" disabled={busy} onChangeText={setRate} />
        <Button mode="contained" disabled={busy} onPress={() => apply("apply", { birrPerUsd: rate })}>Apply rate / renew 24 hours</Button>
        <Button disabled={busy} onPress={() => apply("refresh")}>Fetch & apply from saved provider now</Button>
        <Text style={rateIsActive(savedPolicy, now) ? styles.success : styles.error}>
          {rateIsActive(savedPolicy, now) ? "Cross-currency checkout active: exchange rate is current." :
            !savedPolicy?.enabled ? "Cross-currency checkout is off." : international ? exportInactiveMessage : usdInactiveMessage}
        </Text>
        <Text>Last applied: {config.appliedAt ? new Date(config.appliedAt).toLocaleString() : "Never"}</Text>
        <Text>Expires: {config.expiresAt ? new Date(config.expiresAt).toLocaleString() : "No applied rate"}</Text>
        <Text>Current rate: {config.birrPerUsd ?? "Not set"} ETB / USD | Revision: {config.revision || 0} | Source: {config.source || "None"}</Text>
        <Text>Provider timestamp: {config.providerAsOf ? new Date(config.providerAsOf).toLocaleString() : "Manual / not applied"}</Text>
        <Text>Last attempt: {config.lastAttemptAt ? new Date(config.lastAttemptAt).toLocaleString() : "None"}</Text>
        {config.lastError ? <Text style={styles.error}>{config.lastError}</Text> : null}
        <Text>At exactly 24 hours the rate becomes invalid for new converted payments. Failed fetches do not renew it. Existing reserved payments retain their saved rate.</Text>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Payment setup</Text>
        <Text>{international ? "Configure an explicitly ETB-tagged bank account in the USA region. No cards or cash. Admin verifies birr funds before stores can fulfill." :
          `USD bank transfers require an account explicitly tagged USD. Cash is not supported. Card status: ${config.cardAvailable ? "Dedicated USD keys configured" : "Not configured"}. Card payments require a native build and a USD-capable merchant account.`}</Text>
        <Button onPress={() => navigation.navigate("BankAccountSettings")}>Configure payment bank accounts</Button>
        {international ? <Button onPress={() => navigation.navigate("InternationalShippingSettings")}>Configure hub & international shipping tariff</Button> : null}
        <Button onPress={() => navigation.navigate("DeliveryCheckouts", { admin: true })}>Verify product / service payments</Button>
      </View>
      <View style={styles.card}>
        <Text style={styles.heading}>Latest 30 applied updates</Text>
        {[...(config.history || [])].reverse().map((entry, index) => <View key={`${entry.appliedAt}-${index}`}>
          <Text>{new Date(entry.appliedAt).toLocaleString()} - {entry.birrPerUsd} ETB / USD</Text>
          <Text>{entry.source} - {entry.changed ? "Rate changed" : "Unchanged rate; update applied"}</Text>
        </View>)}
      </View>
    </> : null}
  </ScrollView>;
}
