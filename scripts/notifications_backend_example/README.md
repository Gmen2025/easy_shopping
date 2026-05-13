# Backend Notifications Module Example

This folder contains a drop-in example for admin/manual push notifications and automatic customer notifications.

## Files

- `notificationService.js`: Core Expo push service (token registration, send, broadcast, receipts cleanup).
- `notificationRoutes.js`: Express routes for app token registration and admin send actions.
- `orderNotificationHooks.js`: Reusable automatic notification hooks for order lifecycle events.
- `serverIntegrationExample.js`: Wiring example with Express and Mongoose.

## Install in your backend

```bash
npm install expo-server-sdk
```

If not already installed in backend:

```bash
npm install express mongoose
```

## User model requirement

Your user schema should include:

```js
expoPushTokens: { type: [String], default: [] }
```

## Route summary

App routes:

- `PUT /api/v1/users/:userId/push-token`
- `DELETE /api/v1/users/:userId/push-token`

Admin routes:

- `POST /api/v1/admin/notifications/send-user`
- `POST /api/v1/admin/notifications/send-many`
- `POST /api/v1/admin/notifications/broadcast`
- `POST /api/v1/admin/notifications/receipts`

## Manual send payload example

```json
{
  "userId": "664e4b9db2a2f6dce8a4d111",
  "title": "Order update",
  "body": "Your order has been shipped.",
  "data": { "orderId": "ABC123", "type": "order_shipped" }
}
```

## Automatic notifications usage

```js
const createOrderNotificationHooks = require("./orderNotificationHooks");

const orderNotifications = createOrderNotificationHooks({ notificationService });

await orderNotifications.notifyOrderPlaced(order);
await orderNotifications.notifyPaymentConfirmed(order);
await orderNotifications.notifyOrderShipped(order);
await orderNotifications.notifyOrderDelivered(order);
```

## Production checklist

- Protect app routes with JWT auth and validate user ownership.
- Protect admin routes with role-based middleware.
- Process Expo receipts and remove invalid tokens.
- Add idempotency on payment webhook handlers.
- Store notification logs for audit/troubleshooting.
