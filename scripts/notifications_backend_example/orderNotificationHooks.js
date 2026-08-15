function createOrderNotificationHooks({ notificationService }) {
  if (!notificationService) {
    throw new Error("notificationService is required");
  }

  const send = async (userId, payload) => {
    if (!userId) {
      return { sent: 0, reason: "Missing userId" };
    }
    return notificationService.sendToUser(userId, payload);
  };

  const notifyOrderPlaced = async (order) => {
    return send(order.user, {
      title: "Purchase successful",
      body: `Your order #${order._id} was placed successfully.`,
      data: {
        type: "order_placed",
        orderId: String(order._id),
      },
      channel: "transactional",
    });
  };

  const notifyPaymentConfirmed = async (order) => {
    return send(order.user, {
      title: "Payment confirmed",
      body: `Payment received for order #${order._id}.`,
      data: {
        type: "payment_confirmed",
        orderId: String(order._id),
      },
      channel: "transactional",
    });
  };

  const notifyOrderShipped = async (order) => {
    return send(order.user, {
      title: "Order shipped",
      body: `Your order #${order._id} is on the way.`,
      data: {
        type: "order_shipped",
        orderId: String(order._id),
      },
      channel: "transactional",
    });
  };

  const notifyOrderDelivered = async (order) => {
    return send(order.user, {
      title: "Order delivered",
      body: `Your order #${order._id} has been delivered.`,
      data: {
        type: "order_delivered",
        orderId: String(order._id),
      },
      channel: "transactional",
    });
  };

  // Call when a driver accepts/starts the delivery leg (order status -> "Picked Up"/"Driver Assigned").
  const notifyDeliveryStarted = async (order) => {
    return send(order.user, {
      title: "Delivery started",
      body: `Your order #${order._id} is out for delivery.`,
      data: {
        type: "delivery_started",
        orderId: String(order._id),
      },
      channel: "transactional",
    });
  };

  // Call when the customer's chosen delivery slot (same day/next day/scheduled) is confirmed.
  const notifyDeliveryScheduled = async (order) => {
    const dateLabel = order.scheduledDeliveryDate
      ? ` for ${order.scheduledDeliveryDate}`
      : "";
    return send(order.user, {
      title: "Delivery scheduled",
      body: `Your order #${order._id} delivery has been scheduled${dateLabel}.`,
      data: {
        type: "delivery_scheduled",
        orderId: String(order._id),
      },
      channel: "transactional",
    });
  };

  return {
    notifyOrderPlaced,
    notifyPaymentConfirmed,
    notifyOrderShipped,
    notifyOrderDelivered,
    notifyDeliveryStarted,
    notifyDeliveryScheduled,
  };
}

module.exports = createOrderNotificationHooks;
