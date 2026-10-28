# Update checker verification

2026-10-28T02:13:49.190Z

**42 integration checks passed; 0 failed.** Current package version: 0.1.3. Isolated headless Edge contexts; the Tauri transport was mocked, with no real release download, installation or external write. Native GitHub HTTP classification and URL validation are covered separately by Rust tests.

The scenarios cover launch-once behavior under development StrictMode, all six native statuses, quiet failure states, notice/badge behavior, manual recheck and in-flight deduplication, explicit release opening, keyboard focus containment/return, context preservation and dialog geometry at 1440×960 and 1100×760.

All integration scenarios passed.

The [GitHub latest-release API](https://docs.github.com/en/rest/releases/releases#get-the-latest-release) identifies published stable releases. [Private-resource 404 responses and rate-limit errors](https://docs.github.com/en/rest/using-the-rest-api/troubleshooting-the-rest-api) must not be interpreted as a confirmed current installation.

Machine-readable evidence: [update-verification-results.json](update-verification-results.json). Unit/service coverage: [update-checker.test.ts](../tests/update-checker.test.ts).
