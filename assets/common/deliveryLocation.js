import { Platform } from "react-native";
import * as Location from "expo-location";
import { toLatLng } from "./orderTracking";
import countries from "../data/countries.json";

const normalizeCountry = (value) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");

const matchesCountry = (result, expectedCountry) => {
  const expected = countries.find(
    (country) => normalizeCountry(country.name) === normalizeCountry(expectedCountry)
  );
  const actualCode = String(result?.isoCountryCode || "").toUpperCase();
  if (expected?.code && actualCode) {
    return expected.code.toUpperCase() === actualCode;
  }
  return normalizeCountry(result?.country) === normalizeCountry(expectedCountry);
};

export const resolveDeliveryLocation = async (address, expectedCountry) => {
  if (!address?.trim()) {
    throw new Error("Enter a complete delivery address to locate the drop-off.");
  }
  if (Platform.OS === "android") {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      throw new Error("Allow location access to locate your delivery address on Android.");
    }
  }
  const results = await Location.geocodeAsync(address);
  const points = results.map(toLatLng).filter(Boolean);
  let point;
  for (const candidate of points) {
    if (!expectedCountry) {
      point = candidate;
      break;
    }
    const [reverseResult] = await Location.reverseGeocodeAsync(candidate);
    if (matchesCountry(reverseResult, expectedCountry)) {
      point = candidate;
      break;
    }
  }
  if (!point) {
    throw new Error(
      expectedCountry
        ? "The delivery address could not be verified in the selected country. Check the street, city, postal code and country."
        : "Unable to locate the delivery address. Check the street, city, postal code and country."
    );
  }
  return point;
};
