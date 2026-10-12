import { apiRequest } from "./storefront";

export const rideRequest = (path = "", options) => apiRequest("rides", path, options);
export const rideFare = (ride, amount = ride.finalFare ?? ride.estimate) =>
  `${ride.currency.toUpperCase()} ${Number(amount).toFixed(2)}`;
export const offerSeconds = (deadline, now = Date.now()) => Math.max(0, Math.ceil((new Date(deadline).getTime() - now) / 1000));
export const addressText = (address) => [address.address1, address.address2, address.city, address.zip, address.country].filter(Boolean).join(", ");
export const newRideStop = (type, country = "") => ({
  type, passengers: "1", address: { label: type === "pickup" ? "Pickup" : "Drop-off", address1: "",
    address2: "", city: "", zip: "", country, phone: "" },
});
