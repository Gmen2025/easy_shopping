const FALLBACK_IMAGE_URL = "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png";

import baseUrl from "./baseUrl";

const getApiOrigin = () => {
  if (typeof baseUrl !== "string" || !baseUrl.trim()) return "";

  const cleanBaseUrl = baseUrl.trim().replace(/\/+$/, "");
  const apiMatch = cleanBaseUrl.match(/^(https?:\/\/[^/]+)(?:\/api(?:\/v\d+)?.*)?$/i);

  if (apiMatch && apiMatch[1]) {
    return apiMatch[1];
  }

  return cleanBaseUrl;
};

const normalizeToAbsoluteUrl = (rawUrl) => {
  if (typeof rawUrl !== "string") return "";

  const value = rawUrl.trim();
  if (!value) return "";

  if (/^(https?:|data:|file:|content:)/i.test(value)) {
    return value;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  if (value.startsWith("/")) {
    const origin = getApiOrigin();
    return origin ? `${origin}${value}` : value;
  }

  return value;
};

const tryParseJsonString = (value) => {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed || (!trimmed.startsWith("{") && !trimmed.startsWith("["))) {
    return null;
  }

  try {
    return JSON.parse(trimmed);
  } catch (_err) {
    return null;
  }
};

const pickFromObject = (obj) => {
  if (!obj || typeof obj !== "object") return "";

  const direct = [obj.secure_url, obj.url, obj.uri, obj.src, obj.path, obj.imageUrl]
    .find((value) => typeof value === "string" && value.trim());

  if (direct) return normalizeToAbsoluteUrl(direct);
  return "";
};

const normalizeValue = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    const parsed = tryParseJsonString(value);
    if (parsed) return normalizeValue(parsed);
    return normalizeToAbsoluteUrl(value);
  }

  if (Array.isArray(value) && value.length > 0) {
    for (const entry of value) {
      const resolvedEntry = normalizeValue(entry);
      if (resolvedEntry) return resolvedEntry;
    }
    return "";
  }

  if (typeof value === "object") {
    const fromObject = pickFromObject(value);
    if (fromObject) return fromObject;

    if (value.image) return normalizeValue(value.image);
    if (value.images) return normalizeValue(value.images);
  }

  return "";
};

const getImageUrl = (productOrImage) => {
  const resolved = normalizeValue(productOrImage);
  return resolved || FALLBACK_IMAGE_URL;
};

export { FALLBACK_IMAGE_URL };
export default getImageUrl;
