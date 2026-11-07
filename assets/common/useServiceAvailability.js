import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { serviceAvailabilityRequest } from "./serviceAvailability";

export default function useServiceAvailability(focused = true, refreshKey) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    try {
      const result = await serviceAvailabilityRequest();
      if (request === sequence.current) { setSettings(result); setError(""); }
    } catch (failure) {
      if (request === sequence.current) {
        setSettings(null); setError(failure.response?.data?.message || failure.message);
      }
    }
  }, []);
  useEffect(() => {
    if (!focused) return undefined;
    setSettings(null);
    reload();
    const timer = setInterval(reload, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reload();
    });
    return () => { sequence.current += 1; clearInterval(timer); subscription.remove(); };
  }, [focused, reload, refreshKey]);
  return { settings, error, reload };
}
