## 2026-05-13 - Insecure CORS Policy Fix
 **Vulnerability:** The application was using a completely permissive CORS policy (`app.use(cors())`) which exposed it to requests from arbitrary origins.
 **Learning:** Permissive CORS in a service handling API keys and stream metadata could allow cross-origin exploitation or data theft.
 **Prevention:** Use a restricted CORS policy that validates the `Origin` header against an explicitly allowed set of domains while still accommodating valid no-origin scenarios like desktop clients.
