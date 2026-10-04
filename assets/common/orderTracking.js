export const toLatLng = (value) => {
  if (!value) return null;
  const coordinates = Array.isArray(value)
    ? value
    : value.coordinates || value.location?.coordinates;
  const rawLatitude = Array.isArray(coordinates)
    ? coordinates[1]
    : value.latitude ?? value.lat ?? value.coords?.latitude;
  const rawLongitude = Array.isArray(coordinates)
    ? coordinates[0]
    : value.longitude ?? value.lng ?? value.coords?.longitude;
  if (rawLatitude == null || rawLongitude == null ||
    rawLatitude === "" || rawLongitude === "") return null;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) ||
    Math.abs(latitude) > 90 || Math.abs(longitude) > 180 ||
    (latitude === 0 && longitude === 0)) return null;
  return { latitude, longitude };
};

export const usesMiles = (country) =>
  ["us", "usa", "united states", "united states of america"].includes(
    String(country || "").trim().toLowerCase()
  );

export const formatDistance = (distanceKm, country) => {
  const kilometers = Number(distanceKm);
  if (!Number.isFinite(kilometers) || kilometers < 0) return "—";
  const miles = usesMiles(country);
  const distance = miles ? kilometers * 0.621371 : kilometers;
  return `${distance.toFixed(1)} ${miles ? "mi" : "km"}`;
};

export const getTrackingAddress = (tracking, order) => ({
  address1: order?.shippingAddress1 || tracking?.dropoff?.address1 || "",
  address2: order?.shippingAddress2 || tracking?.dropoff?.address2 || "",
  city: order?.city || tracking?.dropoff?.city || "",
  zip: order?.zip || tracking?.dropoff?.zip || "",
  country: order?.country || tracking?.dropoff?.country || "",
});

export const getTrackingOrder = (checkoutOrder, createdOrder) => {
  const order = { ...checkoutOrder, ...createdOrder };
  if (checkoutOrder?.customerLocationSource === "shipping-address" &&
    toLatLng(checkoutOrder.customerLocation)) {
    order.customerLocation = checkoutOrder.customerLocation;
    order.customerLocationSource = "shipping-address";
  }
  return order;
};

export const getShippingAddressText = (address) => address?.address1
  ? [address.address1, address.address2, address.city, address.zip, address.country]
    .filter(Boolean).join(", ")
  : "";

export const getTrackingLocations = (tracking, order, resolvedDropoff) => ({
  pickup: toLatLng(tracking?.pickup) ||
    toLatLng(tracking?.storeLocation) || toLatLng(order?.storeLocation) ||
    toLatLng(order?.pickupStore),
  dropoff: toLatLng(resolvedDropoff) ||
    (order?.customerLocationSource === "shipping-address"
      ? toLatLng(order?.customerLocation) : null) ||
    (getShippingAddressText(getTrackingAddress(tracking, order))
      ? null
      : toLatLng(tracking?.dropoff) ||
        toLatLng(tracking?.customerLocation) || toLatLng(order?.customerLocation)),
});

export const getTrackingRoute = (deliveryStatus, pickup, dropoff, driverPoint) => {
  if (deliveryStatus === "Delivered" || !driverPoint) {
    return { origin: pickup, destination: dropoff };
  }
  return {
    origin: driverPoint,
    destination: deliveryStatus === "Picked Up" ? dropoff : pickup,
  };
};
