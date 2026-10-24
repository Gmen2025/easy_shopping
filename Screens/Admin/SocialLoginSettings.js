import React, { useCallback, useState } from "react";
import { ActivityIndicator, Switch, View } from "react-native";
import { Card, Text, Button } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import { getSocialLoginSetting, updateSocialLoginSetting } from "../../assets/common/authFeatures";

export default function SocialLoginSettings() {
  const [setting, setSetting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    let active = true;
    setBusy(true);
    getSocialLoginSetting().then((result) => {
      if (active) { setSetting(result); setError(""); }
    }).catch((requestError) => {
      if (active) {
        setSetting(null);
        setError(requestError.response?.data?.message || requestError.message);
      }
    }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, []));

  const change = async (enabled) => {
    setBusy(true);
    setError("");
    try {
      setSetting(await updateSocialLoginSetting(enabled));
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message);
      setSetting(null);
    } finally {
      setBusy(false);
    }
  };

  const reload = async () => {
    setBusy(true);
    setError("");
    try {
      setSetting(await getSocialLoginSetting());
    } catch (requestError) {
      setSetting(null);
      setError(requestError.response?.data?.message || requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return <Card style={{ marginBottom: 20 }}>
    <Card.Content>
      <Text variant="titleLarge">Social sign-in</Text>
      <Text>One global switch for Google, Apple, and Facebook across all regions, development and production.
        Disabling blocks new and in-progress social sign-ins, not existing sessions or email login.</Text>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 16 }}>
        <Text>{setting ? (setting.enabled ? "Enabled" : "Disabled") : "Status unavailable"}</Text>
        <Switch accessibilityLabel="Enable Google, Apple, and Facebook sign-in"
          value={setting?.enabled === true} disabled={busy || !setting}
          onValueChange={change} />
      </View>
      {busy && <ActivityIndicator />}
      {!!error && <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>{error}</Text>}
      <Button disabled={busy} onPress={reload}>Refresh social sign-in status</Button>
    </Card.Content>
  </Card>;
}
