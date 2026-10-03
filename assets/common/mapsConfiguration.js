import { NativeModules, Platform } from "react-native";

export const canRenderNativeMap =
  Platform.OS !== "android" || NativeModules.MapsConfiguration?.isConfigured === true;

export const MAP_UNAVAILABLE_MESSAGE =
  "In-app maps are unavailable in this build. Configure the Android Google Maps API key and rebuild the app.";
