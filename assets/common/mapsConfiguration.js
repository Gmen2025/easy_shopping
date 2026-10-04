import { NativeModules, Platform } from "react-native";

export const canRenderNativeMap =
  Platform.OS !== "android" || NativeModules.MapsConfiguration?.isConfigured === true;

export const MAP_UNAVAILABLE_MESSAGE =
  NativeModules.MapsConfiguration == null
    ? "In-app maps are unavailable: this development/app build is missing the native map configuration module. Rebuild and reinstall the app; a Metro reload cannot fix this."
    : "In-app maps are unavailable: this build has no Android Google Maps API key. Set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in the EAS build environment, then rebuild and reinstall the app.";

export const formatDirectionsError = (error) => {
  const message = typeof error === "string" ? error : error?.message;
  if (/not authorized to use this api key/i.test(message || "")) {
    return "Google rejected the Directions API key. Configure a separate key authorized for the Directions API; the Android Maps SDK key cannot authorize this web-service request.";
  }
  const reason = message?.trim()
    .replace(/AIza[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/([?&]key=)[^&\s]+/gi, "$1[redacted]");
  return reason
    ? `Driving directions unavailable: ${reason}`
    : "Driving directions unavailable. Check your connection and Google Directions API configuration.";
};
