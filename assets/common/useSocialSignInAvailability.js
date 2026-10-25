import { useCallback, useState } from "react";
import { AppState } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { DISABLED_SOCIAL_PROVIDERS, getSocialLoginSetting } from "./authFeatures";

export function useSocialSignInAvailability() {
  const [providers, setProviders] = useState(DISABLED_SOCIAL_PROVIDERS);
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
          setProviders(setting.providers);
          setError("");
        }
      } catch (requestError) {
        if (active) {
          setProviders(DISABLED_SOCIAL_PROVIDERS);
          setError(requestError.response?.data?.message || requestError.message || "Unable to load social sign-in settings.");
        }
      } finally {
        pending = false;
      }
    };
    setProviders(DISABLED_SOCIAL_PROVIDERS);
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

  return { providers, error };
}
