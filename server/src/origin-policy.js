export function isAllowedOrigin(origin, allowedOrigins) {
  if (typeof origin !== "string" || !origin.trim()) return false;
  if (allowedOrigins instanceof Set && allowedOrigins.has(origin)) return true;
  return /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
}
