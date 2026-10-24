import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getSocialLoginSetting } from "./authFeatures";

export function useSocialSignInAvailability() {
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState("");

  useFocusEffect(useCallback(() => {
    let active = true;
    let pending = false;
    const refresh = async () => {
      if (pending) return;
      pending = true;
      try {
        const setting = await getSocialLoginSetting();
        if (active) {
          setEnabled(setting.enabled);
          setError("");
        }
      } catch (requestError) {
        if (active) {
          setEnabled(false);
          setError(requestError.response?.data?.message || requestError.message || "Unable to load social sign-in settings.");
        }
      } finally {
        pending = false;
      }
    };
    setEnabled(false);
    refresh();
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      active = false;
      clearInterval(timer);
      subscription.remove();
    };
  }, []));

  return { enabled, error };
}
