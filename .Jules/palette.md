
## 2024-05-19 - Replace tooltips with inline text for touch accessibility
**Learning:** `title` attributes on DOM elements fail to provide reliable accessibility on mobile and touch devices because there is no way to simulate a 'hover' to trigger them. This means critical field dependency warnings (e.g. "Not applicable when Wiki is selected") become invisible to touch users.
**Action:** When communicating critical field states or form validation rules, always use explicitly visible inline subtext elements (e.g. `<span class="optional-text">`) combined with dynamic display logic rather than relying on `title` tooltips.
