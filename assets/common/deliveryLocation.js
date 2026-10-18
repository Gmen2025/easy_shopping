import { Platform } from "react-native";
import * as Location from "expo-location";
import { toLatLng } from "./orderTracking";
import countries from "../data/countries.json";

const normalizeCountry = (value) =>
  String(value || "").trim().toLowerCase().replace(/[^a-z]/g, "");

const countryAliases = {
  us: "US",
  usa: "US",
  unitedstates: "US",
  unitedstatesofamerica: "US",
  et: "ET",
  ethio: "ET",
  ethiopia: "ET",
};

const countryCode = (value) => {
  const normalized = normalizeCountry(value);
  return countryAliases[normalized] ||
    countries.find((country) => normalizeCountry(country.name) === normalized)?.code?.toUpperCase() ||
    (normalized.length === 2 ? normalized.toUpperCase() : "");
};

const matchesCountry = (result, expectedCountry) => {
  const expectedCode = countryCode(expectedCountry);
  const actualCode = String(result?.isoCountryCode || "").trim().toUpperCase() ||
    countryCode(result?.country);
  if (expectedCode && actualCode) {
    return expectedCode === actualCode;
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
