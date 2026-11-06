import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Text, View } from "react-native";
import { Button } from "react-native-paper";
import { ReviewAvailabilityContext, reviewError, reviewRequest } from "../assets/common/reviews";
import { getDatabaseNameFromStorage } from "../assets/common/databaseConfig";

export default function ReviewAvailabilityProvider({ children }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const current = ++sequence.current;
    try {
      const database = await getDatabaseNameFromStorage();
      const result = await reviewRequest("settings");
      if (database !== await getDatabaseNameFromStorage()) throw new Error("Region changed. Reload review availability.");
      if (current === sequence.current) { setSettings(result); setError(""); }
    } catch (failure) {
      if (current === sequence.current) { setSettings(null); setError(reviewError(failure)); }
    }
  }, []);
  useEffect(() => {
    reload();
    const timer = setInterval(reload, 30000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") reload(); });
    return () => { ++sequence.current; clearInterval(timer); subscription.remove(); };
  }, [reload]);
  return <ReviewAvailabilityContext.Provider value={{ settings }}>
    <View style={{ flex: 1 }}>
      {error ? <View><Text accessibilityRole="alert" style={{ color: "#b91c1c" }}>{error}</Text><Button onPress={reload}>Retry review availability</Button></View> : null}
      {children}
    </View>
  </ReviewAvailabilityContext.Provider>;
}
