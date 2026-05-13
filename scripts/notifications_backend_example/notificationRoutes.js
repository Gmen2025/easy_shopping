const express = require("express");

function createNotificationRoutes({ notificationService, requireAuth, requireAdmin }) {
  const router = express.Router();

  if (!notificationService) {
    throw new Error("notificationService is required");
  }

  const auth = typeof requireAuth === "function" ? requireAuth : (_req, _res, next) => next();
  const admin = typeof requireAdmin === "function" ? requireAdmin : (_req, _res, next) => next();

  // App route: save token for current user device.
  router.put("/users/:userId/push-token", auth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { pushToken } = req.body || {};

      const result = await notificationService.registerPushToken(userId, pushToken);
      return res.json({ message: "Push token saved", userId, ...result });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Unable to save push token" });
    }
  });

  // Optional app route: remove token on logout/disable.
  router.delete("/users/:userId/push-token", auth, async (req, res) => {
    try {
      const { userId } = req.params;
      const { pushToken } = req.body || {};

      const result = await notificationService.removePushToken(userId, pushToken);
      return res.json({ message: "Push token removed", userId, ...result });
    } catch (error) {
      return res.status(400).json({ message: error.message || "Unable to remove push token" });
    }
  });

  // Admin: notify one customer.
  router.post("/admin/notifications/send-user", auth, admin, async (req, res) => {
    try {
      const { userId, title, body, data } = req.body || {};
      if (!userId || !title || !body) {
        return res.status(400).json({ message: "userId, title, and body are required" });
      }

      const result = await notificationService.sendToUser(userId, {
        title,
        body,
        data,
        channel: "admin",
      });

      return res.json({ message: "Notification processed", ...result });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Failed to send notification" });
    }
  });

  // Admin: notify multiple customers.
  router.post("/admin/notifications/send-many", auth, admin, async (req, res) => {
    try {
      const { userIds = [], title, body, data } = req.body || {};
      if (!Array.isArray(userIds) || userIds.length === 0 || !title || !body) {
        return res.status(400).json({ message: "userIds[], title, and body are required" });
      }

      const result = await notificationService.sendToUsers(userIds, {
        title,
        body,
        data,
        channel: "admin",
      });

      return res.json({ message: "Bulk notification processed", ...result });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Failed to send notifications" });
    }
  });

  // Admin: marketing broadcast (use filters carefully).
  router.post("/admin/notifications/broadcast", auth, admin, async (req, res) => {
    try {
      const { title, body, data, query = {} } = req.body || {};
      if (!title || !body) {
        return res.status(400).json({ message: "title and body are required" });
      }

      const result = await notificationService.sendBroadcast({
        title,
        body,
        data,
        query,
        channel: "marketing",
      });

      return res.json({ message: "Broadcast processed", ...result });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Failed to broadcast" });
    }
  });

  // Optional admin route: process Expo receipts and clean invalid tokens.
  router.post("/admin/notifications/receipts", auth, admin, async (req, res) => {
    try {
      const { ticketIds = [] } = req.body || {};
      const result = await notificationService.processReceipts(ticketIds);
      return res.json({ message: "Receipts processed", ...result });
    } catch (error) {
      return res.status(500).json({ message: error.message || "Failed to process receipts" });
    }
  });

  return router;
}

module.exports = createNotificationRoutes;
