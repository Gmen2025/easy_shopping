import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, Switch, Text, View } from "react-native";
import { Button } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { SERVICE_LABELS, serviceAvailabilityRequest } from "../../assets/common/serviceAvailability";

export default function ServiceAvailabilitySettings() {
  const [database, setDatabase] = useState("E_Shopping");
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const guard = useRef(false);
  useEffect(() => {
    let active = true;
    serviceAvailabilityRequest(database).then((result) => {
      if (active) { setSettings(result); setError(""); }
    }).catch((failure) => {
      if (active) { setSettings(null); setError(failure.response?.data?.message || failure.message); }
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [database, revision]);
  const save = async (key, value) => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError(""); setNotice("");
    try {
      setSettings(await serviceAvailabilityRequest(database, { [key]: value }));
      setNotice(`${SERVICE_LABELS[key]} ${value ? "enabled" : "disabled"} for ${database === "E_ShopUSA" ? "USA" : "Ethiopia"}.`);
    } catch (failure) {
      setSettings(null); setError(failure.response?.data?.message || failure.message);
    } finally { guard.current = false; setBusy(false); }
  };
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text style={{ fontSize: 22, fontWeight: "700" }}>Service availability</Text>
    <Text>Separate switches for USA and Ethiopia. Off hides booking badges and blocks new requests. Existing trips, requests, payments and admin/driver operations remain accessible.</Text>
    <Picker accessibilityLabel="Service availability region" selectedValue={database} enabled={!busy}
      onValueChange={(value) => { setBusy(true); setSettings(null); setError(""); setNotice(""); setDatabase(value); }}>
      <Picker.Item label="Ethiopia" value="E_Shopping" />
      <Picker.Item label="USA" value="E_ShopUSA" />
    </Picker>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    {notice ? <Text accessibilityRole="alert">{notice}</Text> : null}
    {Object.entries(SERVICE_LABELS).map(([key, label]) => <View key={key}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text>{label}: {settings ? settings[key] ? "ON" : "OFF" : "Unavailable"}</Text>
      <Switch accessibilityLabel={`Enable ${label}`} value={settings?.[key] === true}
        disabled={busy || !settings} onValueChange={(value) => save(key, value)} />
    </View>)}
    <Button disabled={busy} onPress={() => { setBusy(true); setSettings(null); setRevision((value) => value + 1); }}>Refresh availability</Button>
    <Text>Switches default ON to preserve existing behavior. Ride fare configuration must also be enabled before rides can be booked. These switches do not change country maintenance mode or erase fare settings.</Text>
  </ScrollView>;
}
