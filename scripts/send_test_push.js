// Send a test push notification through your backend route.
// Usage:
// node scripts/send_test_push.js --userId=<USER_ID> [--baseUrl=https://easy-shop-server-wldr.onrender.com/api/v1] [--title="Order update"] [--body="Your order has been shipped"] [--auth="Bearer ..."]

const DEFAULT_BASE_URL = "https://easy-shop-server-wldr.onrender.com/api/v1";

const parseArgs = () => {
  const args = process.argv.slice(2);
  const parsed = {};

  for (const arg of args) {
    if (!arg.startsWith("--")) {
      continue;
    }

    const [key, ...rest] = arg.slice(2).split("=");
    parsed[key] = rest.join("=");
  }

  return parsed;
};

const trimSlash = (value) => value.replace(/\/+$/, "");

const run = async () => {
  const args = parseArgs();
  const userId = args.userId;
  const baseUrl = trimSlash(args.baseUrl || process.env.PUSH_BASE_URL || DEFAULT_BASE_URL);
  const title = args.title || "Test Notification";
  const body = args.body || "Push notifications are working.";
  const auth = args.auth || process.env.PUSH_AUTH || "";

  if (!userId) {
    console.error("Missing required --userId argument");
    process.exit(1);
  }

  const headers = {
    "Content-Type": "application/json",
  };

  if (auth) {
    headers.Authorization = auth.startsWith("Bearer ") ? auth : `Bearer ${auth}`;
  }

  const response = await fetch(`${baseUrl}/notifications/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      userId,
      title,
      body,
      data: {
        source: "manual-test",
        timestamp: new Date().toISOString(),
      },
    }),
  });

  const text = await response.text();

  let payload = text;
  try {
    payload = JSON.parse(text);
  } catch {
    // Keep text payload if response is not JSON.
  }

  if (!response.ok) {
    console.error("Push send failed:", response.status, payload);
    process.exit(1);
  }

  console.log("Push send response:", payload);
};

run().catch((error) => {
  console.error("Push test command failed:", error.message || error);
  process.exit(1);
});
