import { installReviewNetworkPolicy } from "./networkPolicy";

// Every development session is isolated, including direct react-scripts starts.
export const isLocalReview = process.env.NODE_ENV === "development";
export const useMockServices = process.env.NODE_ENV !== "production";
if (isLocalReview) installReviewNetworkPolicy();

export function createReviewStorage(storage) {
  return {
    getItem: (key) => storage.getItem(`reset-review:${key}`),
    setItem: (key, value) => storage.setItem(`reset-review:${key}`, value),
    removeItem: (key) => storage.removeItem(`reset-review:${key}`)
  };
}

export const appStorage = isLocalReview ? createReviewStorage(window.localStorage) : window.localStorage;
