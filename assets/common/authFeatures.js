import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import baseUrl from "./baseUrl";

function parseSetting(data) {
  if (data?.success !== true || typeof data.enabled !== "boolean") {
    throw new Error("The server returned invalid social sign-in settings.");
  }
  return data;
}

export async function getSocialLoginSetting() {
  const response = await axios.get(`${baseUrl}settings/social-login`, { timeout: 20000 });
  return parseSetting(response.data);
}

export async function updateSocialLoginSetting(enabled) {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const response = await axios.put(`${baseUrl}settings/social-login`, { enabled }, {
    headers: { Authorization: `Bearer ${token}` }, timeout: 20000,
  });
  return parseSetting(response.data);
}
