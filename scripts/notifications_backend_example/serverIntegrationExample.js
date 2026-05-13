const express = require("express");
const mongoose = require("mongoose");

const NotificationService = require("./notificationService");
const createNotificationRoutes = require("./notificationRoutes");
const createOrderNotificationHooks = require("./orderNotificationHooks");

// Replace with your actual models.
const User = mongoose.model(
  "User",
  new mongoose.Schema({
    email: String,
    expoPushTokens: { type: [String], default: [] },
    role: { type: String, default: "user" },
  })
);

const NotificationLog = mongoose.model(
  "NotificationLog",
  new mongoose.Schema(
    {
      title: String,
      body: String,
      metadata: Object,
      requestedCount: Number,
      accepted: Number,
      failed: Number,
      tickets: Array,
    },
    { timestamps: true }
  )
);

const requireAuth = (req, _res, next) => {
  // Replace with JWT validation middleware.
  // Set req.user = { _id, role } from decoded token.
  req.user = req.user || { _id: "demo-user", role: "admin" };
  next();
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== "admin") {
    return res.status(403).json({ message: "Admin access required" });
  }
  next();
};

async function createServer() {
  // Example only: replace with your real URI.
  // await mongoose.connect(process.env.MONGO_URI);

  const app = express();
  app.use(express.json());

  const notificationService = new NotificationService({
    UserModel: User,
    NotificationLogModel: NotificationLog,
  });

  app.use(
    "/api/v1",
    createNotificationRoutes({
      notificationService,
      requireAuth,
      requireAdmin,
    })
  );

  const orderNotifications = createOrderNotificationHooks({ notificationService });

  // Example route: call this when an order is created.
  app.post("/api/v1/orders/:orderId/mock-success", requireAuth, async (req, res) => {
    const order = {
      _id: req.params.orderId,
      user: req.user._id,
    };

    const pushResult = await orderNotifications.notifyOrderPlaced(order);
    return res.json({ message: "Order success notification triggered", pushResult });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  return app;
}

module.exports = { createServer };
