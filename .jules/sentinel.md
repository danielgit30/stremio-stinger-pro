## 2026-05-14 - Restricted CORS Policy
 **Vulnerability:** Overly permissive CORS policy in `server.js` allowed all origins (`*`) by default, potentially exposing the Stremio addon to unauthorized cross-origin requests.
 **Learning:** Default configurations in popular libraries like `cors` can lead to insecure deployments if not explicitly restricted to necessary origins. Enforcing HTTPS and whitelisting specific trusted domains is critical for security.
 **Prevention:** Implement a whitelist for CORS origins, enforce the HTTPS protocol, and validate the `Origin` header in a custom function to allow only trusted domains and non-browser clients.
## 2024-05-24 - Missing Server Errors Logging Sanitzation
 **Vulnerability:** console.error was directly logging e.message from external HTTP requests, which is vulnerable to log injection and sensitive API credential leakage (especially for TMDB api_key).
 **Learning:** When passing exception messages directly to a logger, we can easily expose api credentials or allow attackers to craft malicious multi-line log entries.
 **Prevention:** Implement a sanitizeError helper that strips newlines, carriage returns, and api credentials from the error messages, before sending them to the console.
