const FALLBACK_IMAGE_URL = "https://cdn.pixabay.com/photo/2012/04/01/17/29/box-23649_960_720.png";

const pickFromObject = (obj) => {
  if (!obj || typeof obj !== "object") return "";

  const direct = [obj.secure_url, obj.url, obj.uri]
    .find((value) => typeof value === "string" && value.trim());

  if (direct) return direct.trim();
  return "";
};

const normalizeValue = (value) => {
  if (!value) return "";

  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value) && value.length > 0) {
    return normalizeValue(value[0]);
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
