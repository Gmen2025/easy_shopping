# Wire Into Your Real Backend

This mobile repo does not include your production backend source files, so direct in-place wiring is not possible here.

Use these steps in your backend repository.

## 1) Add push token field to User model

```js
expoPushTokens: { type: [String], default: [] }
```

## 2) Copy module files to backend

Copy these files from this repo:

- scripts/notifications_backend_example/notificationService.js
- scripts/notifications_backend_example/notificationRoutes.js
- scripts/notifications_backend_example/orderNotificationHooks.js

## 3) Install dependency in backend

```bash
npm install expo-server-sdk
```

## 4) Wire routes in backend app

```js
const NotificationService = require("./path/to/notificationService");
const createNotificationRoutes = require("./path/to/notificationRoutes");

const notificationService = new NotificationService({
  UserModel: User,
  NotificationLogModel: NotificationLog, // optional
});

app.use(
  "/api/v1",
  createNotificationRoutes({
    notificationService,
    requireAuth,
    requireAdmin,
  })
);
```

## 5) Trigger automatic notifications from order events

```js
const createOrderNotificationHooks = require("./path/to/orderNotificationHooks");
const orderNotifications = createOrderNotificationHooks({ notificationService });

await orderNotifications.notifyOrderPlaced(order);
await orderNotifications.notifyPaymentConfirmed(order);
await orderNotifications.notifyOrderShipped(order);
await orderNotifications.notifyOrderDelivered(order);
```

## 6) Ensure mobile endpoint matches

Your app calls:

- PUT /api/v1/users/:userId/push-token

Keep this route enabled and protected by auth.

## 7) Admin manual send endpoint

Use:

- POST /api/v1/admin/notifications/send-user

Payload example:

```json
{
  "userId": "664e4b9db2a2f6dce8a4d111",
  "title": "Order update",
  "body": "Your order has been shipped.",
  "data": { "orderId": "ABC123", "type": "order_shipped" }
}
```

## 8) Production recommendations

- Validate req.user owns req.params.userId for token registration route.
- Use role middleware for admin routes.
- Process Expo receipts and remove invalid tokens.
- Add idempotency for payment webhooks to avoid duplicates.
