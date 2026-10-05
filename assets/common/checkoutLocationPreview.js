import { resolveDeliveryLocation } from "./deliveryLocation";
import { buildStoreAssignmentPayload } from "./stores";
import { toLatLng } from "./orderTracking";

export const resolveCheckoutLocationPreview = async ({
  addressText, country, token, previousPreview,
}) => {
  if (!addressText?.trim() || !country?.trim()) {
    throw new Error("Enter your shipping address, city and country to preview delivery locations.");
  }
  const previousLocation = previousPreview?.addressText === addressText &&
    previousPreview?.country === country
    ? toLatLng(previousPreview.customerLocation) : null;
  const customerLocation = previousLocation || await resolveDeliveryLocation(addressText, country);
  const storeAssignment = await buildStoreAssignmentPayload(customerLocation, token);
  return { addressText, country, customerLocation, storeAssignment };
};

export const getGoogleMapsPinUrl = (location) => {
  const point = toLatLng(location);
  return point
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${point.latitude},${point.longitude}`)}`
    : null;
};
