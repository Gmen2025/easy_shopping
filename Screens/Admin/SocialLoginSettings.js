import React, { useCallback, useState } from "react";
import { ActivityIndicator, Switch, View } from "react-native";
import { Card, Text, Button } from "react-native-paper";
import { useFocusEffect } from "@react-navigation/native";
import { SOCIAL_PROVIDERS, getSocialLoginSetting, updateSocialLoginSetting } from "../../assets/common/authFeatures";

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

  const change = async (provider, enabled) => {
    setBusy(true);
    setError("");
    try {
      setSetting(await updateSocialLoginSetting(provider, enabled));
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
      <Text>Control each provider separately across all regions, development and production.
        Disabling a provider blocks its new and in-progress sign-ins, not other providers,
        existing sessions or email login.</Text>
      {SOCIAL_PROVIDERS.map((provider) => {
        const label = provider === "google" ? "Google" : provider === "apple" ? "Apple" : "Facebook";
        return <View key={provider} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 16 }}>
          <Text>{label}: {setting ? (setting.providers[provider] ? "Enabled" : "Disabled") : "Status unavailable"}</Text>
          <Switch accessibilityLabel={`Enable ${label} sign-in`}
            value={setting?.providers[provider] === true} disabled={busy || !setting}
            onValueChange={(enabled) => change(provider, enabled)} />
        </View>;
      })}
      {busy && <ActivityIndicator />}
      {!!error && <Text accessibilityRole="alert" style={{ color: "#B91C1C" }}>{error}</Text>}
      <Button disabled={busy} onPress={reload}>Refresh social sign-in status</Button>
    </Card.Content>
  </Card>;
}
