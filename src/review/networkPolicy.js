// Shared by the review HTTP server and browser. Only local hot-reload sockets
// are permitted; fetch/XHR, external sockets, forms, and frames are blocked.
const REVIEW_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src ws://localhost:* ws://127.0.0.1:*",
  "form-action 'none'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'"
].join('; ');

function installReviewNetworkPolicy() {
  if (document.querySelector('meta[data-reset-review-policy]')) return;
  const policy = document.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content = REVIEW_CSP;
  policy.dataset.resetReviewPolicy = 'true';
  document.head.prepend(policy);
}

module.exports = { REVIEW_CSP, installReviewNetworkPolicy };
