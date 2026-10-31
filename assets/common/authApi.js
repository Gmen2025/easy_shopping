import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { requireOptionalNativeModule } from "expo";
import Constants from "expo-constants";
import { Platform } from "react-native";
import baseUrl from "./baseUrl";
import { getDatabaseNameFromStorage } from "./databaseConfig";
import { parseSocialCallback } from "./authFlow";
import { getSocialLoginSetting } from "./authFeatures";

if (Platform.OS === "web") {
  require("expo-web-browser").maybeCompleteAuthSession();
}

export const securityRequest = async (path, body, session) => {
  const token = session?.token || await AsyncStorage.getItem("token");
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const config = { headers: { Authorization: `Bearer ${token}`,
    ...(session ? { "x-database-name": session.database } : {}) }, timeout: 20000 };
  const response = body === undefined
    ? await axios.get(`${baseUrl}users/auth/${path}`, config)
    : await axios.post(`${baseUrl}users/auth/${path}`, body, config);
  return response.data;
};

const socialBrowserFlow = async (provider, linkProof) => {
  if (!["google", "apple", "facebook"].includes(provider)) {
    throw new Error("Unsupported sign-in provider.");
  }
  if (!(await getSocialLoginSetting()).providers[provider]) {
    throw new Error("This social sign-in provider is not available. Please use email sign-in.");
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
  const session = linkProof ? { token: await AsyncStorage.getItem("token"), database: db } : null;
  if (linkProof && !session.token) throw new Error("Your session has expired. Please sign in again.");
  const url = linkProof ? (await securityRequest("social/link/start", {
    ...linkProof, provider, redirectUri, codeChallenge, databaseName: db,
  }, session)).authorizationUrl : `${baseUrl}users/auth/social/start?${new URLSearchParams({
    provider, redirectUri, codeChallenge, db,
  })}`;
  if (linkProof && (typeof url !== "string" || new URL(url).origin !== "https://accounts.google.com" ||
      new URL(url).pathname !== "/o/oauth2/v2/auth")) {
    throw new Error("The server returned an invalid Google linking URL.");
  }
  const result = await WebBrowser.openAuthSessionAsync(url, redirectUri);
  if (result.type === "cancel" || result.type === "dismiss") return null;
  if (result.type !== "success") throw new Error("The sign-in browser could not complete authentication.");
  const code = parseSocialCallback(result.url, redirectUri);
  if (linkProof) {
    if (await AsyncStorage.getItem("token") !== session.token || await getDatabaseNameFromStorage() !== db) {
      throw new Error("Your account or store changed. Start Google linking again.");
    }
    const linked = await securityRequest("social/link/exchange", { code, codeVerifier, databaseName: db }, session);
    if (linked?.linked !== true || linked.provider !== "google") {
      throw new Error("The server did not confirm Google linking. Refresh Security Settings before trying again.");
    }
    return linked;
  }
  const response = await axios.post(`${baseUrl}users/auth/social/exchange`, {
    code, codeVerifier, databaseName: db,
  }, { timeout: 20000 });
  return response.data;
};

export const socialSignIn = (provider) => socialBrowserFlow(provider);
export const linkGoogleAccount = (proof) => {
  if (!proof || typeof proof.password !== "string" || !proof.password) {
    throw new Error("Enter your current account password to link Google.");
  }
  return socialBrowserFlow("google", proof);
};
