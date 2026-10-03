import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

// Load the dependency-free Expo module without changing the app's package type.
const source = await readFile(new URL("../assets/common/notificationInbox.js", import.meta.url), "utf8");
const { mergeNotificationItems } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

test("receiving and opening the same notification produces one read entry", () => {
  const received = { id: "notification-a", title: "Received", isRead: false };
  const opened = { ...received, title: "Opened", isRead: true };
  const items = mergeNotificationItems([received], [opened]);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, "Opened");
  assert.equal(items[0].isRead, true);
  assert.equal(mergeNotificationItems(items, [received])[0].isRead, true);
});

test("saved duplicates are removed and read status survives hydration", () => {
  const saved = [
    { id: "a", isRead: false },
    { id: "a", isRead: true },
    { id: "b", isRead: false },
  ];
  const normalized = mergeNotificationItems([], saved);
  assert.deepEqual(normalized.map((item) => item.id), ["a", "b"]);
  assert.equal(normalized[0].isRead, true);
  const live = [{ id: "a", title: "Live update", isRead: false }, { id: "c", isRead: false }];
  const hydrated = mergeNotificationItems(normalized, live);
  assert.deepEqual(hydrated.map((item) => item.id), ["a", "c", "b"]);
  assert.equal(hydrated[0].title, "Live update");
  assert.equal(hydrated[0].isRead, true);
});

test("the inbox keeps twenty unique entries with incoming notifications first", () => {
  const saved = Array.from({ length: 25 }, (_, index) => ({ id: String(index), isRead: false }));
  const items = mergeNotificationItems(saved, [{ id: "new", isRead: false }, saved[0]]);
  assert.equal(items.length, 20);
  assert.equal(items[0].id, "new");
  assert.equal(new Set(items.map((item) => item.id)).size, 20);
});

test("malformed persisted entries fail explicitly", () => {
  assert.throws(() => mergeNotificationItems([], [{}]), /valid identifier/);
});
