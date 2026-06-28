const listeners = new Set();

export const subscribeLowStockUpdates = (listener) => {
  if (typeof listener !== "function") {
    return () => {};
  }

  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const notifyLowStockUpdated = () => {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch (error) {
      console.log("Low stock listener error:", error?.message || error);
    }
  });
};
