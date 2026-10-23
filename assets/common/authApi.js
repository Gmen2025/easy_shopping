import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
import { Platform } from "react-native";
import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";
import { parseSocialCallback } from "./authFlow";

if (Platform.OS === "web") {
  require("expo-web-browser").maybeCompleteAuthSession();
}

export const securityRequest = async (path, body) => {
  const token = await AsyncStorage.getItem("token");
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const config = { headers: { Authorization: `Bearer ${token}` }, timeout: 20000 };
  const response = body === undefined
    ? await axios.get(`${baseUrl}users/auth/${path}`, config)
    : await axios.post(`${baseUrl}users/auth/${path}`, body, config);
  return response.data;
};

export const socialSignIn = async (provider) => {
  if (!["google", "apple", "facebook"].includes(provider)) {
    throw new Error("Unsupported sign-in provider.");
  }
  if (Platform.OS !== "web") {
    const missingModules = ["ExpoCrypto", "ExpoWebBrowser"].filter(
      (name) => !requireOptionalNativeModule(name)
    );
    if (missingModules.length) {
      throw new Error(
        `This installed app is missing ${missingModules.join(" and ")}. ` +
        "Install a newly rebuilt app to use social sign-in. Reloading Metro is not enough. " +
        "Email sign-in is still available."
      );
    }
  }
  const Crypto = require("expo-crypto");
  const WebBrowser = require("expo-web-browser");
  const configuredRedirect = Constants.expoConfig?.extra?.authRedirectUri;
  const redirectUri = configuredRedirect ||
    (Platform.OS === "web" ? window.location.origin : "addugeneteshop://auth");
  const bytes = await Crypto.getRandomBytesAsync(32);
  const codeVerifier = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256, codeVerifier,
    { encoding: Crypto.CryptoEncoding.BASE64 }
  );
  const codeChallenge = digest.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const db = await getDatabaseNameFromStorage();
  const url = `${baseUrl}users/auth/social/start?${new URLSearchParams({
    provider, redirectUri, codeChallenge, db,
  })}`;
  const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
  if (result.type === "cancel" || result.type === "dismiss") return null;
  if (result.type !== "success") throw new Error("The sign-in browser could not complete authentication.");
  const code = parseSocialCallback(result.url, redirectUri);
  const response = await axios.post(`${baseUrl}users/auth/social/exchange`, {
    code, codeVerifier, databaseName: db,
  }, { timeout: 20000 });
  return response.data;
};
