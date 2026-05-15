## 2026-05-14 - Restricted CORS Policy
 **Vulnerability:** Overly permissive CORS policy in `server.js` allowed all origins (`*`) by default, potentially exposing the Stremio addon to unauthorized cross-origin requests.
 **Learning:** Default configurations in popular libraries like `cors` can lead to insecure deployments if not explicitly restricted to necessary origins. Enforcing HTTPS and whitelisting specific trusted domains is critical for security.
 **Prevention:** Implement a whitelist for CORS origins, enforce the HTTPS protocol, and validate the `Origin` header in a custom function to allow only trusted domains and non-browser clients.
