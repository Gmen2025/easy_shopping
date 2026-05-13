// Example Express backend routes for Expo push notifications.
// This is a reference implementation for your backend service.
//
// Install in your backend project:
//   npm install express expo-server-sdk
//
// Run:
//   node scripts/expo_push_server_example.js

const express = require("express");
const { Expo } = require("expo-server-sdk");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3002;
const expo = new Expo();

// Demo in-memory store: replace with MongoDB/Postgres in production.
// Shape: userId -> Set of Expo push tokens.
const userPushTokens = new Map();

const requireAuth = (req, res, next) => {
  // Replace this with your JWT middleware.
  // Example: verify bearer token, attach req.user, then continue.
  return next();
};

const upsertUserPushToken = (userId, pushToken) => {
  const tokens = userPushTokens.get(userId) || new Set();
  tokens.add(pushToken);
  userPushTokens.set(userId, tokens);
};

const getUserPushTokens = (userId) => {
  const tokens = userPushTokens.get(userId);
  if (!tokens) {
    return [];
  }
  return Array.from(tokens);
};

// Route used by the mobile app: PUT /api/v1/users/:userId/push-token
app.put("/api/v1/users/:userId/push-token", requireAuth, (req, res) => {
  const { userId } = req.params;
  const { pushToken } = req.body || {};

  if (!pushToken || typeof pushToken !== "string") {
    return res.status(400).json({ message: "pushToken is required" });
  }

  if (!Expo.isExpoPushToken(pushToken)) {
    return res.status(400).json({ message: "Invalid Expo push token" });
  }

  upsertUserPushToken(userId, pushToken);

  return res.json({
    message: "Push token saved",
    userId,
    totalTokens: getUserPushTokens(userId).length,
  });
});

// Optional cleanup route if users disable notifications or log out.
app.delete("/api/v1/users/:userId/push-token", requireAuth, (req, res) => {
  const { userId } = req.params;
  const { pushToken } = req.body || {};

  if (!pushToken) {
    return res.status(400).json({ message: "pushToken is required" });
  }

  const tokens = userPushTokens.get(userId);
  if (!tokens) {
    return res.json({ message: "No token found", removed: false });
  }

  const removed = tokens.delete(pushToken);
  if (tokens.size === 0) {
    userPushTokens.delete(userId);
  }

  return res.json({ message: "Token removal processed", removed });
});

// Send a push notification to all registered tokens for a user.
app.post("/api/v1/notifications/send", requireAuth, async (req, res) => {
  const { userId, title, body, data } = req.body || {};

  if (!userId || !title || !body) {
    return res.status(400).json({ message: "userId, title, and body are required" });
  }

  const tokens = getUserPushTokens(userId);
  if (tokens.length === 0) {
    return res.status(404).json({ message: "No push tokens registered for this user" });
  }

  const messages = [];
  for (const pushToken of tokens) {
    if (!Expo.isExpoPushToken(pushToken)) {
      continue;
    }

    messages.push({
      to: pushToken,
      sound: "default",
      title,
      body,
      data: data || {},
      priority: "high",
    });
  }

  if (messages.length === 0) {
    return res.status(400).json({ message: "No valid Expo tokens to send" });
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (const chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("Error sending push chunk:", error);
    }
  }

  // Optional: collect receipts and remove invalid tokens from DB.
  const receiptIds = tickets
    .filter((ticket) => ticket.status === "ok" && ticket.id)
    .map((ticket) => ticket.id);

  return res.json({
    message: "Push request processed",
    sent: messages.length,
    tickets,
    receiptIds,
  });
});

app.get("/api/v1/notifications/health", (_, res) => {
  res.json({ ok: true, usersWithTokens: userPushTokens.size });
});

app.listen(PORT, () => {
  console.log(`Expo push example server running on port ${PORT}`);
});
