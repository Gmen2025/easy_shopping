import { useCallback, useContext, useRef, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getFinancialHealthSettings } from "./financialHealth";
import { AuthContext } from "../../Context/store/Auth";

export default function useFinancialHealth() {
  const { user } = useContext(AuthContext);
  const userId = user?._id || user?.id;
  const [accessUserId, setAccessUserId] = useState(null);
  const [configuredEnabled, setConfiguredEnabled] = useState(null);
  const [enabled, setEnabled] = useState(null);
  const [error, setError] = useState("");
  const sequence = useRef(0);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setEnabled(null); setConfiguredEnabled(null); setError("");
    try {
      const setting = await getFinancialHealthSettings();
      if (request === sequence.current) {
        setConfiguredEnabled(setting.enabled);
        setEnabled(setting.enabled || setting.testingAccess === true);
        setAccessUserId(userId);
      }
    } catch (failure) {
      if (request === sequence.current) setError(failure.response?.data?.message || failure.message);
    }
  }, [userId]);
  useFocusEffect(useCallback(() => {
    reload();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") reload();
    });
    const timer = setInterval(reload, 30000);
    return () => { sequence.current += 1; subscription.remove(); clearInterval(timer); };
  }, [reload]));
  return { enabled: accessUserId === userId ? enabled : null,
    configuredEnabled: accessUserId === userId ? configuredEnabled : null, error, reload };
}
