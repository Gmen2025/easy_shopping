export const isCancelledProfileOrder = (order) =>
  order.fulfillmentStatus === "cancelled" || order.deliveryStatus === "Cancelled";

export const isDeliveredProfileOrder = (order) =>
  !isCancelledProfileOrder(order) && (
    String(order.status) === "3" || order.deliveryStatus === "Delivered" ||
    order.fulfillmentStatus === "completed"
  );

export const filterProfileOrders = (orders, filter) => {
  if (filter === "delivered") return orders.filter(isDeliveredProfileOrder);
  if (filter === "tracking") return orders.filter((order) =>
    !isCancelledProfileOrder(order) && !isDeliveredProfileOrder(order));
  return orders;
};

export const getProfileUserOrders = (orders, userId) => {
  if (!Array.isArray(orders)) throw new Error("The server returned an invalid order list.");
  return orders.filter((order) => {
    return [order.user, order.customer].some((value) => {
      const owner = value?._id || value?.id || value;
      return owner != null && String(owner) === String(userId);
    });
  });
};
