import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getFinancialHealthSettings } from "./financialHealth";

export default function useFinancialHealth() {
  const [enabled, setEnabled] = useState(null);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setEnabled(null); setError("");
    try {
      const setting = await getFinancialHealthSettings();
      if (request === sequence.current) setEnabled(setting.enabled);
    } catch (failure) {
      if (request === sequence.current) setError(failure.response?.data?.message || failure.message);
    }
  }, []);
  useFocusEffect(useCallback(() => {
    reload();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reload();
    });
    return () => { sequence.current += 1; subscription.remove(); };
  }, [reload]));
  return { enabled, error, reload };
}
