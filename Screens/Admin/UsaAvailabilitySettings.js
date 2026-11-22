import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Switch, Text, View } from "react-native";
import { Button } from "react-native-paper";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import baseUrl from "../../assets/common/baseUrl";

export default function UsaAvailabilitySettings() {
  const [enabled, setEnabled] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const guard = useRef(false);
  const parse = (data) => {
    if (typeof data?.enabled !== "boolean") throw new Error("USA availability could not be verified.");
    return data.enabled;
  };
  useEffect(() => {
    let active = true;
    axios.get(`${baseUrl}settings/usa-availability`, { timeout: 20000 }).then((response) => {
      if (active) { setEnabled(parse(response.data)); setError(""); }
    }).catch((failure) => {
      if (active) setError(failure.response?.data?.message || failure.message);
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [revision]);
  const save = async (value) => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) throw new Error("Sign in as an administrator to change USA availability.");
      const response = await axios.put(`${baseUrl}settings/usa-availability`, { enabled: value },
        { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 });
      setEnabled(parse(response.data));
    } catch (failure) {
      setEnabled(null); setError(failure.response?.data?.message || failure.message);
    } finally { guard.current = false; setBusy(false); }
  };
  return <View style={{ gap: 12 }}>
    <Text style={{ fontSize: 20, fontWeight: "700" }}>USA storefront</Text>
    <Text>When OFF, only USA administrators and approved verified USA testers can browse and shop. Existing orders, payments and deliveries remain accessible. Sign in as a USA administrator and select USA below to manage its tester list.</Text>
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
      <Text>USA storefront: {enabled === null ? "Unavailable" : enabled ? "ON" : "OFF"}</Text>
      <Switch accessibilityLabel="Enable USA storefront" value={enabled === true} disabled={busy || enabled === null} onValueChange={save} />
    </View>
    <Button disabled={busy} onPress={() => { setBusy(true); setRevision((value) => value + 1); }}>Refresh USA availability</Button>
  </View>;
}
