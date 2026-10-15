// Overridable at build time for production, e.g.
//   VITE_API_BASE_URL="https://your-host.com/api" npm run build
// The host must match the one the browser actually uses (scheme + host),
// because the HttpOnly refresh cookie is only sent back to its origin.
export const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api";
