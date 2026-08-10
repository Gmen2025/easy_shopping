const appJson = require("./app.json");

module.exports = ({ config }) => {
  const baseConfig = appJson.expo || config || {};
  const existingExtra = baseConfig.extra || {};

  const stripePublishableKey =
    process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    existingExtra.stripePublishableKey ||
    "";

  const stripeCurrency =
    process.env.EXPO_PUBLIC_STRIPE_CURRENCY ||
    existingExtra.stripeCurrency ||
    "usd";

  const socketUrl =
    process.env.EXPO_PUBLIC_SOCKET_URL ||
    existingExtra.socketUrl ||
    "http://192.168.1.10:5000";

  const telebirrMockEnabledRaw =
    process.env.EXPO_PUBLIC_TELEBIRR_MOCK_ENABLED ??
    existingExtra.telebirrMockEnabled ??
    false;

  const telebirrMockEnabled = String(telebirrMockEnabledRaw).toLowerCase() === "true";

  return {
    ...baseConfig,
    android: {
      ...(baseConfig.android || {}),
      softwareKeyboardLayoutMode: "resize",
      // Use EAS file env var in cloud builds; fallback to local file for local/dev usage.
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ||
        baseConfig.android?.googleServicesFile ||
        "./google-services.json",
    },
    extra: {
      ...existingExtra,
      stripePublishableKey,
      stripeCurrency,
      telebirrMockEnabled,
      socketUrl,
    },
  };
};
