export function businessPath(kind, accountId, view) {
  if (!["store", "driver"].includes(kind) || !accountId || accountId === "me") throw new Error("Select a store or driver.");
  const id = encodeURIComponent(accountId);
  if (view === "profile") return `finance/accounts/${kind}/${id}/profile`;
  if (kind === "store") {
    if (view === "reviews") return `stores/${id}/reviews`;
    if (view === "fulfillment") return `products/admin/stores/${id}/fulfillment-products`;
    if (["dashboard", "assignments"].includes(view)) return `stores/admin/${id}/${view}`;
  } else {
    if (view === "rides") return `rides/admin/drivers/${id}/dashboard`;
    if (["dashboard", "queue", "completed-today", "available-deliveries", "wallet"].includes(view)) return `drivers/admin/${id}/${view}`;
  }
  throw new Error("Unsupported account dashboard.");
}

export function validateBusiness(data, view, kind) {
  const list = (value) => Array.isArray(value) && value.every((item) => item && typeof item === "object");
  if (view === "dashboard") {
    const store = kind === "store" || (!kind && Boolean(data?.store));
    const fields = store ? ["sales", "earnings", "orders", "completedOrders", "unitsSold", "averageOrder", "reviews", "averageRating"]
      : ["income", "deliveries", "averageFee", "distanceKm"];
    if (!data?.periods || !["daily", "weekly", "monthly", "quarterly", "yearly"].every((period) =>
      fields.every((field) => Number.isFinite(data.periods[period]?.[field]) && data.periods[period][field] >= 0))) {
      throw new Error("Incomplete business analytics.");
    }
    if (store ? !(list(data.activeOrders) && list(data.recentOrders)) : !list(data.recentDeliveries)) throw new Error("Missing dashboard activity.");
    if (store && ["products", "inventory", "orders"].some((key) => !data[key] || typeof data[key] !== "object")) throw new Error("Missing store operations.");
  } else if (view === "profile") {
    if (!data?.account?._id || !list(data.locations) || typeof data.inventoryEnabled !== "boolean") throw new Error("Invalid account profile.");
  } else if (view === "rides") {
    if (!data?.driver?.serviceModes || !list(data.riders) || !list(data.payments) || (data.trip && !list(data.trip.stops))) throw new Error("Invalid ride dashboard.");
  } else if (view === "wallet") {
    if (!Number.isFinite(data?.walletBalance) || !list(data.transactions)) throw new Error("Invalid commission wallet.");
  } else {
    const field = { queue: "queue", "completed-today": "orders", "available-deliveries": "orders", reviews: "reviews", fulfillment: "products" }[view];
    if (!list(view === "assignments" ? data : data?.[field])) throw new Error("Invalid account activity list.");
  }
  return data;
}
