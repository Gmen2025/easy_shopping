import React, { useEffect, useRef, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { Button } from "react-native-paper";
import { reviewRequest, reviewError } from "../../assets/common/reviews";
import { Picker } from "@react-native-picker/picker";
import { getDatabaseNameFromStorage } from "../../assets/common/databaseConfig";
import { reviewFeature } from "../../assets/common/reviews";

export default function ReviewSettings() {
  const [settings, setSettings] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState("product");
  const [result, setResult] = useState(null);
  const [retry, setRetry] = useState(0);
  const region = useRef("");
  const ensureRegion = async () => {
    const database = await getDatabaseNameFromStorage();
    if (region.current && region.current !== database) throw new Error("Region changed. Reopen review settings before continuing.");
    region.current = database;
  };
  const run = async (action) => {
    setBusy(true); setError("");
    try { await ensureRegion(); const saved = await action(); await ensureRegion(); setSettings(saved); }
    catch (failure) { setError(reviewError(failure)); }
    finally { setBusy(false); }
  };
  const load = () => run(() => reviewRequest("settings"));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    let active = true;
    if (settings?.[reviewFeature[kind]]) {
      const fetchReviews = async () => {
        await ensureRegion();
        const data = await reviewRequest(`admin?kind=${kind}`);
        await ensureRegion();
        if (active) setResult({ kind, reviews: data.reviews });
      };
      fetchReviews().catch((failure) => { if (active) { setResult(null); setError(reviewError(failure)); } });
    }
    return () => { active = false; };
  }, [settings, kind, retry]);
  return <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
    <Text style={{ fontSize: 22, fontWeight: "700" }}>Review settings</Text>
    <Text>Switches apply to the selected shopping region. Off hides reviews and prevents submissions without deleting saved reviews. All switches default off.</Text>
    {error ? <Text accessibilityRole="alert">{error}</Text> : null}
    <Button disabled={busy} onPress={load}>Refresh settings</Button>
    {settings ? [["products", "Products"], ["deliveries", "Delivery experience"], ["rides", "Drivers and ride customers"], ["services", "Service fulfillment"]].map(([key, label]) =>
      <View key={key} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text>{label}</Text><Switch accessibilityLabel={`Enable ${label} reviews`} disabled={busy} value={settings[key]}
          onValueChange={(value) => run(() => reviewRequest("settings", { method: "put", data: { [key]: value } }))} />
      </View>) : null}
    <Text style={{ fontSize: 18, fontWeight: "700" }}>Recent reviews</Text>
    <Picker selectedValue={kind} onValueChange={setKind}>
      {[["product", "Products"], ["delivery", "Delivery experience"], ["rideDriver", "Ride drivers"],
        ["rideCustomer", "Ride customers"], ["service", "Service fulfillment"]].map(([value, label]) => <Picker.Item key={value} label={label} value={value} />)}
    </Picker>
    <Button onPress={() => setRetry((value) => value + 1)}>Refresh reviews</Button>
    {settings?.[reviewFeature[kind]] && result?.kind === kind ? result.reviews.map((review) => <View key={review._id}>
      <Text>{review.rating}/5 - {new Date(review.dateCreated).toLocaleDateString()}</Text>
      <Text selectable>Transaction: {review.transaction}</Text><Text>{review.comment}</Text>
    </View>) : <Text>Enable this feature to view its saved reviews.</Text>}
  </ScrollView>;
}
