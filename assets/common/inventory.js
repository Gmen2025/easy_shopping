import axios from "axios";
import baseUrl from "./baseUrl";

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
  return item?._id || item?.id || item?.product || "";
};

const getOrderItemName = (item, product) => {
  return item?.name || product?.name || "Selected product";
};

export const validateOrderStock = async ({ orderItems = [], token }) => {
  const headers = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const checks = orderItems.map(async (item) => {
    const productId = getOrderItemProductId(item);
    const requested = Number(item?.quantity || 1);

    if (!productId || requested <= 0) {
      return null;
    }

    try {
      const productResponse = await axios.get(`${baseUrl}products/${productId}`, {
        headers,
      });
      const product = normalizeProduct(productResponse?.data);

      if (!product) {
        return {
          type: "unverified",
          productId,
          name: getOrderItemName(item),
          message: "Unable to verify stock for one or more items.",
        };
      }

      const available = Number(product.countInStock || 0);
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
      return {
        type: "unverified",
        productId,
        name: getOrderItemName(item),
        message: "Unable to verify stock for one or more items.",
        reason: error?.response?.data?.message || error?.message || "stock_check_failed",
      };
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
