const appJson = require("./app.json");

module.exports = ({ config }) => {
  const baseConfig = appJson.expo || config || {};

  return {
    ...baseConfig,
    android: {
      ...(baseConfig.android || {}),
      // Use EAS file env var in cloud builds; fallback to local file for local/dev usage.
      googleServicesFile:
        process.env.GOOGLE_SERVICES_JSON ||
        baseConfig.android?.googleServicesFile ||
        "./google-services.json",
    },
  };
};
