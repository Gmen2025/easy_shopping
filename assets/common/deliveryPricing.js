const cents = (value) => Math.round(value * 100);

export const calculateDeliveryPricing = (deliveries, selections = {}) => {
  const groups = new Map();
  for (const delivery of deliveries) {
    const vehicle = selections[delivery.key] || delivery.vehicle;
    const option = vehicle
      ? delivery.vehicleOptions?.find((entry) => entry.type === vehicle)
      : [...(delivery.vehicleOptions || [])].sort((a, b) => a.fee - b.fee)[0];
    if (vehicle && delivery.vehicleOptions?.length && !option) {
      throw new Error("Choose one of the suitable vehicles offered for this delivery.");
    }
    const route = delivery.pricingGroup?.kind === "cart-route";
    const key = JSON.stringify([delivery.pricingGroup?.key || delivery.key, route ? "cart" : option?.type || vehicle || ""]);
    if (!groups.has(key)) groups.set(key, []);
    if (route && groups.get(key).some((member) => member.vehicle !== (option?.type || vehicle))) {
      throw new Error("Choose one vehicle for the entire cart route.");
    }
    groups.get(key).push({ delivery, fee: option?.fee ?? delivery.deliveryFee ?? 0, vehicle: option?.type || vehicle });
  }
  const byKey = {};
  let total = 0;
  for (const members of groups.values()) {
    members.sort((a, b) => a.delivery.distanceKm - b.delivery.distanceKm || a.delivery.key.localeCompare(b.delivery.key));
    const anchor = members[0];
    const fee = cents(anchor.fee);
    total += fee;
    [...members].sort((a, b) => a.delivery.key.localeCompare(b.delivery.key)).forEach(({ delivery }, index) => {
      byKey[delivery.key] = {
        deliveryFee: (Math.floor(fee / members.length) + (index < fee % members.length ? 1 : 0)) / 100,
        storeCount: members.length, storeName: anchor.delivery.store.name,
        sharedFee: fee / 100,
      };
    });
  }
  return { deliveryFee: total / 100, byKey };
};
