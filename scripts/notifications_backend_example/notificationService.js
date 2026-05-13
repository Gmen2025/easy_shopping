const { Expo } = require("expo-server-sdk");

class NotificationService {
  constructor({ UserModel, NotificationLogModel = null }) {
    if (!UserModel) {
      throw new Error("NotificationService requires a UserModel");
    }

    this.User = UserModel;
    this.NotificationLog = NotificationLogModel;
    this.expo = new Expo();
  }

  static isValidExpoPushToken(token) {
    return typeof token === "string" && Expo.isExpoPushToken(token);
  }

  async registerPushToken(userId, pushToken) {
    if (!NotificationService.isValidExpoPushToken(pushToken)) {
      throw new Error("Invalid Expo push token");
    }

    const updated = await this.User.findByIdAndUpdate(
      userId,
      { $addToSet: { expoPushTokens: pushToken } },
      { new: true }
    ).lean();

    if (!updated) {
      throw new Error("User not found");
    }

    return { totalTokens: (updated.expoPushTokens || []).length };
  }

  async removePushToken(userId, pushToken) {
    const updated = await this.User.findByIdAndUpdate(
      userId,
      { $pull: { expoPushTokens: pushToken } },
      { new: true }
    ).lean();

    if (!updated) {
      throw new Error("User not found");
    }

    return { totalTokens: (updated.expoPushTokens || []).length };
  }

  async sendToUser(userId, { title, body, data = {}, channel = "transactional" }) {
    const user = await this.User.findById(userId).lean();
    if (!user) {
      return { sent: 0, reason: "User not found" };
    }

    return this.sendToTokens(user.expoPushTokens || [], {
      title,
      body,
      data: { ...data, userId: String(userId), channel },
      metadata: { userId: String(userId), channel },
    });
  }

  async sendToUsers(userIds, { title, body, data = {}, channel = "transactional" }) {
    const users = await this.User.find({ _id: { $in: userIds } }).lean();
    const allTokens = users.flatMap((user) => user.expoPushTokens || []);

    return this.sendToTokens(allTokens, {
      title,
      body,
      data: { ...data, channel },
      metadata: { userCount: users.length, channel },
    });
  }

  async sendBroadcast({ title, body, data = {}, channel = "marketing", query = {} }) {
    const users = await this.User.find(query, { expoPushTokens: 1 }).lean();
    const allTokens = users.flatMap((user) => user.expoPushTokens || []);

    return this.sendToTokens(allTokens, {
      title,
      body,
      data: { ...data, channel },
      metadata: { userCount: users.length, channel },
    });
  }

  async sendToTokens(tokens, { title, body, data = {}, metadata = {} }) {
    const uniqueValidTokens = [...new Set(tokens)].filter((token) =>
      NotificationService.isValidExpoPushToken(token)
    );

    if (!uniqueValidTokens.length) {
      return {
        sent: 0,
        accepted: 0,
        failed: 0,
        tickets: [],
        invalidTokens: tokens.length,
      };
    }

    const messages = uniqueValidTokens.map((to) => ({
      to,
      sound: "default",
      title,
      body,
      data,
      priority: "high",
    }));

    const chunks = this.expo.chunkPushNotifications(messages);
    const tickets = [];

    for (const chunk of chunks) {
      try {
        const result = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...result);
      } catch (error) {
        tickets.push({ status: "error", message: error.message || "Chunk send failed" });
      }
    }

    const accepted = tickets.filter((t) => t.status === "ok").length;
    const failed = tickets.length - accepted;

    await this.logNotification({
      title,
      body,
      metadata,
      requestedCount: uniqueValidTokens.length,
      accepted,
      failed,
      tickets,
    });

    return {
      sent: uniqueValidTokens.length,
      accepted,
      failed,
      tickets,
    };
  }

  async processReceipts(ticketIds = []) {
    if (!ticketIds.length) {
      return { checked: 0, removedTokens: 0 };
    }

    const chunks = this.expo.chunkPushNotificationReceiptIds(ticketIds);
    const invalidTokens = new Set();

    for (const chunk of chunks) {
      try {
        const receipts = await this.expo.getPushNotificationReceiptsAsync(chunk);
        for (const receiptId of Object.keys(receipts)) {
          const receipt = receipts[receiptId];
          if (receipt.status === "error" && receipt.details?.error === "DeviceNotRegistered") {
            if (receipt.details.expoPushToken) {
              invalidTokens.add(receipt.details.expoPushToken);
            }
          }
        }
      } catch (error) {
        // Keep processing other chunks.
      }
    }

    let removedTokens = 0;
    if (invalidTokens.size > 0) {
      const tokenList = [...invalidTokens];
      await this.User.updateMany(
        { expoPushTokens: { $in: tokenList } },
        { $pull: { expoPushTokens: { $in: tokenList } } }
      );
      removedTokens = tokenList.length;
    }

    return { checked: ticketIds.length, removedTokens };
  }

  async logNotification(payload) {
    if (!this.NotificationLog) {
      return;
    }

    try {
      await this.NotificationLog.create(payload);
    } catch (error) {
      // Notification send should not fail due to log failures.
    }
  }
}

module.exports = NotificationService;
