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

  return {
    notifyOrderPlaced,
    notifyPaymentConfirmed,
    notifyOrderShipped,
    notifyOrderDelivered,
  };
}

module.exports = createOrderNotificationHooks;
