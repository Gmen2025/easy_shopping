export const mergeNotificationItems = (currentItems, incomingItems) => {
  const itemsById = new Map();

  for (const item of [...incomingItems, ...currentItems]) {
    if (!item || typeof item.id !== "string" || !item.id) {
      throw new Error("Notification inbox entry is missing a valid identifier.");
    }

    const existing = itemsById.get(item.id);
    if (existing) {
      itemsById.set(item.id, { ...existing, isRead: Boolean(existing.isRead || item.isRead) });
    } else {
      itemsById.set(item.id, item);
    }
  }

  return [...itemsById.values()].slice(0, 20);
};
