import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "./baseUrl";

export const SOCIAL_PROVIDERS = ["google", "apple", "facebook"];
export const DISABLED_SOCIAL_PROVIDERS = { google: false, apple: false, facebook: false };

function parseSetting(data) {
  if (data?.success !== true || !data.providers ||
      SOCIAL_PROVIDERS.some((provider) => typeof data.providers[provider] !== "boolean")) {
    throw new Error("The server returned invalid social sign-in settings.");
  }
  return data;
}

export async function getSocialLoginSetting() {
  const response = await axios.get(`${baseUrl}settings/social-login`, { timeout: 20000 });
  return parseSetting(response.data);
}

export async function updateSocialLoginSetting(provider, enabled) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await axios.put(`${baseUrl}settings/social-login`, { providers: { [provider]: enabled } }, {
    headers: { Authorization: `Bearer ${token}` }, timeout: 20000,
  });
  return parseSetting(response.data);
}
