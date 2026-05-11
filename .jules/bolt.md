## 2024-05-24 - Optimizing RegExp evaluations in scraping routines
**Learning:** In highly repetitive scraping tasks (like iterating over rows or matching large blocks of text), using `String.prototype.match()` just to check for the presence of a pattern creates unnecessary overhead because it constructs array objects. Furthermore, compiling regex within tight loops is costly.
**Action:** Always prefer `RegExp.prototype.test()` over `.match()` when you only need a boolean response. Pre-compile `RegExp` objects outside of iteration blocks to avoid compiling the same pattern repeatedly.
