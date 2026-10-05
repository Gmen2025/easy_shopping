import axios from "axios";
import baseUrl from "./baseUrl";
import { getWithRetry } from "./requestRetry";
import { getDatabaseNameFromStorage, sanitizeDatabaseName } from "./databaseConfig";

const normalizeProduct = (data) => {
  if (!data) return null;
  if (data.product) return data.product;
  return data;
};

const toCategoryId = (category) => {
  if (!category) return "";
  if (typeof category === "string") return category;
  return category._id || category.id || "";
};

const buildProductUpdatePayload = (product, nextStock) => {
  const categoryId = toCategoryId(product.category);
  const images = Array.isArray(product.images)
    ? product.images.filter(Boolean)
    : product.image
      ? [product.image]
      : [];

  return {
    brand: product.brand || "",
    name: product.name || "",
    price: Number(product.price || 0),
    description: product.description || "",
    category: categoryId,
    countInStock: nextStock,
    rating: Number(product.rating || 0),
    richDescription: product.richDescription || "",
    numReviews: Number(product.numReviews || 0),
    isFeatured: Boolean(product.isFeatured),
    image: product.image || images[0] || "",
    images,
  };
};

const getOrderItemProductId = (item) => {
  const product = item?.product;
  const id = product?._id || product?.id ||
    (typeof product === "string" ? product : null) || item?._id || item?.id;
  return typeof id === "string" ? id.trim() : "";
};

const getOrderItemName = (item, product) => {
  return item?.name || product?.name || "Selected product";
};

export const validateOrderStock = async ({ orderItems = [], token }) => {
  const databaseName = await getDatabaseNameFromStorage();
  const headers = { "x-database-name": databaseName };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const checks = orderItems.map(async (item) => {
    const productId = getOrderItemProductId(item);
    const requested = Number(item?.quantity ?? 1);
    const name = getOrderItemName(item, item?.product);
    const unverified = (reason) => {
      const message = `Unable to verify stock for ${name}. ${reason}`;
      console.warn("Stock verification failed:", { productId, databaseName, reason });
      return { type: "unverified", productId, name, message, reason };
    };

    if (!productId || !Number.isSafeInteger(requested) || requested <= 0) {
      return unverified("The cart item has an invalid product ID or quantity. Remove it and add it again.");
    }
    const itemDatabase = item?.databaseName || item?.dbName;
    if (itemDatabase && sanitizeDatabaseName(itemDatabase) !== databaseName) {
      return unverified("This item belongs to a different shopping region. Remove it and add it again from the selected region.");
    }

    try {
      const productResponse = await getWithRetry(`${baseUrl}products/${encodeURIComponent(productId)}`, {
        headers,
        params: { db: databaseName },
        timeout: 15000,
      });
      const product = normalizeProduct(productResponse?.data);

      const stock = product?.countInStock;
      const available = typeof stock === "number" ||
        (typeof stock === "string" && stock.trim()) ? Number(stock) : NaN;
      if (!Number.isSafeInteger(available) || available < 0) {
        return unverified("The server returned missing or invalid inventory. Please retry or contact the store.");
      }

      if (requested > available) {
        return {
          type: "over_limit",
          productId,
          name: getOrderItemName(item, product),
          requested,
          available,
          message: `${getOrderItemName(item, product)} has only ${available} left, but ${requested} were requested.`,
        };
      }

      return null;
    } catch (error) {
      const status = Number(error?.response?.status);
      const reason = [401, 403].includes(status)
        ? "The server rejected access to this product. Please sign in again."
        : status === 404
          ? "This product is no longer available in the selected region. Remove it and add it again."
          : status >= 500
            ? `The inventory service is temporarily unavailable (HTTP ${status}). Please retry.`
            : !error?.response
              ? "The inventory service could not be reached. Check your connection and retry."
              : `The inventory request failed (HTTP ${status}). Please retry or contact the store.`;
      return unverified(reason);
    }
  });

  const issues = (await Promise.all(checks)).filter(Boolean);
  const overLimit = issues.filter((issue) => issue.type === "over_limit");
  const unverified = issues.filter((issue) => issue.type === "unverified");

  let message = "";
  if (overLimit.length > 0) {
    message = overLimit[0].message;
  } else if (unverified.length > 0) {
    message = unverified[0].message;
  }

  return {
    ok: issues.length === 0,
    issues,
    overLimit,
    unverified,
    message,
  };
};

export const deductInventoryFromOrder = async ({ orderItems = [], token }) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const updates = orderItems.map(async (item) => {
    const productId = item?._id || item?.id || item?.product;
    const quantity = Number(item?.quantity || 1);

    if (!productId || quantity <= 0) {
      return { ok: true, skipped: true, productId };
    }

    try {
      const productResponse = await axios.get(`${baseUrl}products/${productId}`);
      const product = normalizeProduct(productResponse?.data);

      if (!product) {
        return { ok: false, productId, reason: "missing_product_data" };
      }

      const currentStock = Number(product.countInStock || 0);
      const nextStock = Math.max(0, currentStock - quantity);

      if (nextStock === currentStock) {
        return { ok: true, skipped: true, productId };
      }

      const payload = buildProductUpdatePayload(product, nextStock);
      await axios.put(`${baseUrl}products/${productId}`, payload, { headers });

      return { ok: true, productId, previousStock: currentStock, nextStock };
    } catch (error) {
      return {
        ok: false,
        productId,
        reason: error?.response?.data?.message || error?.message || "update_failed",
      };
    }
  });

  const results = await Promise.all(updates);
  const failed = results.filter((result) => !result.ok);

  return {
    ok: failed.length === 0,
    failedCount: failed.length,
    results,
  };
};
