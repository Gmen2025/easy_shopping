export const isCashOnDeliveryAvailable = (databaseName) =>
  Boolean(databaseName);

export function deliveryPaymentMethods(
  group,
  databaseName,
  cardAvailable,
  telebirrAvailable,
  settings,
) {
  const supported =
    group?.international && group.international.direction !== "ethiopia-to-usa"
      ? ["bank", ...(telebirrAvailable ? ["telebirr"] : [])]
      : [
          "bank",
          ...((/usa/i.test(databaseName) || group?.exchangeRate) &&
          cardAvailable
            ? ["card"]
            : []),
          ...(!group?.international &&
          !group?.exchangeRate &&
          group?.kind !== "service" &&
          isCashOnDeliveryAvailable(databaseName)
            ? ["cash"]
            : []),
        ];
  return supported.filter((method) => settings?.[method] === true);
}

export const isCashOnDeliveryMethod = (value) =>
  value === 1 ||
  value === "1" ||
  ["cash", "cash on delivery"].includes(String(value).trim().toLowerCase());
