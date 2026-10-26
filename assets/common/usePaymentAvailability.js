import { useCallback, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { paymentSettings } from "./paymentSettings";

export default function usePaymentAvailability() {
  const [methods, setMethods] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const generation = useRef(0);
  useFocusEffect(useCallback(() => {
    const version = ++generation.current;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const result = await paymentSettings();
        if (version === generation.current) { setMethods(result); setError(""); }
      } catch (failure) {
        if (version === generation.current) { setMethods(null); setError(failure.response?.data?.message || failure.message); }
      } finally {
        pending = false;
        if (version === generation.current) setLoading(false);
      }
    };
    refresh();
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") refresh(); });
    return () => { generation.current++; clearInterval(timer); subscription.remove(); };
  }, []));
  return { methods, error, loading };
}
