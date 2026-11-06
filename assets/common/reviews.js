import { apiRequest } from "./storefront";
import { createContext } from "react";

export const ReviewAvailabilityContext = createContext({ settings: null });
export const reviewRequest = async (path = "", options) => {
  const result = await apiRequest("reviews", path, options);
  if (path === "settings" && ["products", "deliveries", "rides", "services"].some((key) => typeof result?.[key] !== "boolean")) {
    throw new Error("Review settings could not be verified. Please retry.");
  }
  return result;
};
export const reviewFeature = { product: "products", delivery: "deliveries", rideDriver: "rides", rideCustomer: "rides", service: "services" };
export const productRating = (product) => Number(product.verifiedReviewCount > 0 ? product.verifiedRating : product.rating || 0);
export const productReviewCount = (product) => Number(product.verifiedReviewCount > 0 ? product.verifiedReviewCount : product.numReviews || 0);
export const reviewError = (failure) => failure.response?.data?.message || failure.message || "Unable to load reviews.";
export function reviewQuery(kind, transaction, product) {
  return `context?kind=${encodeURIComponent(kind)}&transaction=${encodeURIComponent(transaction)}` +
    (product ? `&product=${encodeURIComponent(product)}` : "");
}
