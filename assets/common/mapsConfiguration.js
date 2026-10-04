import { NativeModules, Platform } from "react-native";

export const canRenderNativeMap =
  Platform.OS !== "android" || NativeModules.MapsConfiguration?.isConfigured === true;

export const MAP_UNAVAILABLE_MESSAGE =
  "In-app maps are unavailable in this build. Configure the Android Google Maps API key and rebuild the app.";

export const formatDirectionsError = (error) => {
  const message = typeof error === "string" ? error : error?.message;
  const reason = message?.trim()
    .replace(/AIza[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/([?&]key=)[^&\s]+/gi, "$1[redacted]");
  return reason
    ? `Driving directions unavailable: ${reason}`
    : "Driving directions unavailable. Check your connection and Google Directions API configuration.";
};
