export function shippingRoute(direction) {
  const reverse = direction === "ethiopia-to-usa";
  return {
    origin: reverse ? "Ethiopia" : "USA",
    destination: reverse ? "USA" : "Ethiopia",
    pickupField: reverse ? "usaPickup" : "ethiopiaPickup",
    exportField: reverse ? "exportToUSA" : "exportToEthiopia",
    stages: [
      "awaiting_hub",
      "at_hub",
      "shipped",
      reverse ? "arrived_usa" : "arrived_ethiopia",
      "delivered",
    ],
  };
}

export const isUSA = (country) =>
  /^(usa|us|united states|united states of america)$/i.test(
    String(country || "").trim(),
  );

export function internationalDestinationLegs(group) {
  if (!group.international) return [];
  const route = shippingRoute(group.international.direction);
  const dispatch = group.international.tariff?.[route.pickupField];
  return group.international.shipments.flatMap((shipment) => {
    const members = group.deliveries.filter((delivery) => delivery.address.id === shipment.id);
    const legs = [];
    if (members.some((delivery) => delivery.fulfillmentMethod !== "pickup")) {
      legs.push({ key: `${shipment.id}:delivery`, kind: "delivery", origin: dispatch, destination: shipment.recipient });
    }
    if (members.some((delivery) => delivery.fulfillmentMethod === "pickup")) {
      legs.push({ key: `${shipment.id}:collection`, kind: "collection", destination: dispatch });
    }
    return legs;
  });
}

export function editShippingAddress(address, field, value) {
  const next = { ...address, [field]: value };
  if (["address1", "address2", "city", "zip", "country"].includes(field)) {
    for (const key of ["placeId", "location", "latitude", "longitude", "formattedAddress"]) delete next[key];
  }
  return next;
}

export function internationalPreview(quote, hubDeliveryFee) {
  const native = quote.itemsSubtotal + hubDeliveryFee;
  const fees = quote.international.shippingFee + (quote.finalDeliveryFee || 0);
  const rate = quote.exchangeRate?.birrPerUsd;
  if (!Number.isFinite(rate) || rate <= 0)
    throw new Error(
      "The saved exchange rate is invalid. Request a fresh quote.",
    );
  if (quote.international.direction === "ethiopia-to-usa") {
    return {
      total: Math.round((native + fees * rate) * 100) / 100,
      payment:
        (Math.round((native / rate) * 100) + Math.round(fees * 100)) / 100,
    };
  }
  const total = Math.round((native + fees) * 100) / 100;
  return { total, payment: Math.round(total * rate * 100) / 100 };
}
