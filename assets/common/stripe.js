import Constants from "expo-constants";

const stripeModule = (() => {
  if (Constants?.appOwnership === "expo" || Constants?.executionEnvironment === "storeClient") {
    return null;
  }

  try {
    return require("@stripe/stripe-react-native");
  } catch (error) {
    console.warn("Stripe module unavailable:", error?.message || error);
    return null;
  }
})();

export default stripeModule;
