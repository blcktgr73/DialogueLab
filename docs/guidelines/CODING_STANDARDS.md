# Coding Guide

* **Before Code Change**: Design diagrams/flow explanation before and after changes.
* **After Code Change**: Present diff, comments, and test code.
* **Security**: API Keys/Secrets in `.env` or Secret Manager.
* **Performance**: Include O( ) complexity/memory footprint comments.
* **Logging/Monitoring**: Structured logging + core metric suggestions.
* **Testing Strategy**:
    * **Unit (Vitest)**: For all logic and independent components. Filename: `*.test.ts`
    * **E2E (Playwright)**: For complete user flows and page transitions. Filename: `*.spec.ts`
* **Review Summary**: "Summary: Refactored X, Added test Y, Updated Z. Structural Cohesion improved by Z%".
* **UX Quality Verification**:
    * **Consistency**: Design System/Atomic Component reuse check.
    * **Accessibility**: WCAG/A11y compliance check for User-facing changes.
    * **Context**: Ensure no breakage in User Journey (Path Continuity).
