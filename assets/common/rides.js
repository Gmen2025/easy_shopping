import { apiRequest } from "./storefront";

export const rideRequest = (path = "", options) => apiRequest("rides", path, options);
export const rideFare = (ride, amount = ride.finalFare ?? ride.estimate) =>
  `${ride.currency.toUpperCase()} ${Number(amount).toFixed(2)}`;
export const rideOptions = [
  { key: "economy", name: "Economy", icon: "car", detail: "Economy car" },
  { key: "comfort", name: "Comfort", icon: "car", detail: "Comfort car" },
  { key: "van", name: "Van", icon: "shuttle-van", detail: "More passengers" },
];
export const rideOptionName = (key) => rideOptions.find((option) => option.key === key)?.name || "";
export const offerSeconds = (deadline, now = Date.now()) => Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
export const addressText = (address) => [address.address1, address.address2, address.city, address.zip, address.country].filter(Boolean).join(", ");
export const newRideStop = (type, country = "") => ({
  type, passengers: "1", address: { label: type === "pickup" ? "Pickup" : "Drop-off", address1: "",
    address2: "", city: "", zip: "", country, phone: "" },
});
export const balanceRideStops = (stops) => {
  const remaining = stops.slice(0, -1).reduce((total, stop) =>
    total + (stop.type === "pickup" ? 1 : -1) * Number(stop.passengers), 0);
  return stops.map((stop, index) => index === stops.length - 1
    ? { ...stop, type: "dropoff", passengers: stops.slice(0, -1).some((entry) => entry.passengers === "") ||
        !Number.isFinite(remaining) ? "" : String(remaining) }
    : index === 0 ? { ...stop, type: "pickup" } : stop);
};
export const rideStopPoint = (stop) => {
  const coordinates = stop?.address?.location?.coordinates;
  if (!Array.isArray(coordinates) || coordinates.length !== 2) return null;
  const [longitude, latitude] = coordinates.map(Number);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180 || (latitude === 0 && longitude === 0)) return null;
  return { latitude, longitude };
};
// Google Maps driving directions through every located stop, in booking order.
export const rideDirectionsUrl = (stops = []) => {
  const points = stops.map(rideStopPoint).filter(Boolean).map(({ latitude, longitude }) => `${latitude},${longitude}`);
  if (points.length < 2) return null;
  const waypoints = points.slice(1, -1);
  return `https://www.google.com/maps/dir/?api=1&travelmode=driving&origin=${encodeURIComponent(points[0])}` +
    `&destination=${encodeURIComponent(points.at(-1))}` +
    (waypoints.length ? `&waypoints=${encodeURIComponent(waypoints.join("|"))}` : "");
};
export const isEthiopia = (country) => /^(ethiopia|ethio|et)$/i.test(String(country || "").trim());
export const newPlacesSession = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
export const searchPlaces = (input, session) =>
  rideRequest(`places/autocomplete?input=${encodeURIComponent(input)}&session=${encodeURIComponent(session)}`);
export const placeAddress = (placeId, session) =>
  rideRequest(`places/details/${encodeURIComponent(placeId)}?session=${encodeURIComponent(session)}`);
