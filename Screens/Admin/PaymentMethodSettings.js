import React, { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Switch, View } from "react-native";
import { Card, Text, Button } from "react-native-paper";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect } from "@react-navigation/native";
import { PAYMENT_LABELS, paymentSettings } from "../../assets/common/paymentSettings";

export default function PaymentMethodSettings() {
  const [database, setDatabase] = useState("E_Shopping");
  const [methods, setMethods] = useState(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const guard = useRef(false);
  useFocusEffect(useCallback(() => {
    let active = true;
    paymentSettings(database).then((result) => { if (active) { setMethods(result); setError(""); } })
      .catch((failure) => { if (active) { setMethods(null); setError(failure.response?.data?.message || failure.message); } })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [database]));
  const sync = async (key) => {
    if (guard.current) return;
    guard.current = true; setBusy(true); setError("");
    try { setMethods(await paymentSettings(database, key ? { [key]: !methods[key] } : undefined)); }
    catch (failure) { setMethods(null); setError(failure.response?.data?.message || failure.message); }
    finally { guard.current = false; setBusy(false); }
  };
  return <Card style={{ marginBottom: 20 }}><Card.Content>
    <Text variant="titleLarge">Payment methods</Text>
    <Text>Independent USA and Ethio switches apply to website and mobile, development and production.
      Currency/provider requirements still apply. Existing payments can still reconcile.</Text>
    <Picker accessibilityLabel="Payment settings region" selectedValue={database} enabled={!busy} onValueChange={(value) => {
      setBusy(true); setMethods(null); setError(""); setDatabase(value);
    }}><Picker.Item label="Ethio" value="E_Shopping" /><Picker.Item label="USA" value="E_ShopUSA" /></Picker>
    {Object.entries(PAYMENT_LABELS).map(([key, label]) => <View key={key}
      style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 12 }}>
      <Text>{label}: {methods ? methods[key] ? "ON" : "OFF" : "Unavailable"}</Text>
      <Switch accessibilityLabel={`Enable ${label}`} value={methods?.[key] === true}
        disabled={busy || !methods} onValueChange={() => sync(key)} />
    </View>)}
    {methods && !Object.values(methods).some(Boolean) ? <Text>All methods are OFF. Checkout will show a temporary-unavailable message.</Text> : null}
    {busy ? <ActivityIndicator /> : null}
    {error ? <Text accessibilityRole="alert" style={{ color: "#b91c1c" }}>{error}</Text> : null}
    <Button disabled={busy} onPress={() => sync()}>Refresh payment settings</Button>
  </Card.Content></Card>;
}
