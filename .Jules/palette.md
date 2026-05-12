## 2026-05-11 - [Replace Disruptive Alerts]
**Learning:** Using `alert()` for simple feedback like copying a URL disrupts the user flow, takes focus away from the page, and creates a poor UX, especially for keyboard/screen reader users.
**Action:** Replace blocking alerts with inline visual feedback (e.g., changing button text to 'Copied! ✓') to keep the user in context.

## 2024-05-11 - [Dynamic Feedback with aria-live]
**Learning:** For dynamic preview areas that react to configuration changes (like the "Live Preview" or the suddenly appearing installation instructions), screen readers won't announce the changes unless explicitly instructed.
**Action:** Use `aria-live="polite"` and `aria-atomic="true"` on containers that update dynamically to ensure changes are announced cleanly without being overly disruptive.

## 2024-05-11 - [Password Input Feedback]
**Learning:** For setup forms that require a sensitive token (like an API key), users often struggle to verify what they pasted without a way to view the obscured characters.
**Action:** Always provide a "Show/Hide" toggle or checkbox for password inputs, particularly when dealing with long API keys or tokens, to prevent silent failures caused by bad copy-paste operations.
