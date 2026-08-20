---
name: pre-push-code-review
description: Review local git changes before pushing. Use when the user asks for a pre-push code review, wants to validate local changes, or wants to check code quality before committing/pushing. Focus on bugs, edge cases, security, correctness, maintainability, reuse, unnecessary code, performance, and consistency with the existing codebase.
---

# Pre-Push Code Review

Perform a thorough but practical code review of the current local changes before they are pushed.

The goal is to identify **real problems and meaningful improvements**, not to nitpick stylistic details or rewrite working code unnecessarily.

Do NOT modify files unless the user explicitly asks you to fix the issues found.

---

## 1. Understand the Change

Before reviewing:

1. Inspect the current git status.
2. Identify the current branch.
3. Determine the appropriate comparison/base branch.
4. Inspect the complete diff, including:
   - staged changes
   - unstaged changes
   - untracked files relevant to the implementation
5. Read surrounding code when necessary to understand how the changed code is actually used.
6. Inspect relevant existing utilities, hooks, components, services, types, tests, and configuration before suggesting new abstractions or changes.
7. Identify the intended behavior of the change from the diff, surrounding code, naming, tests, and project conventions.

Do not review the diff in isolation when understanding the surrounding code is necessary.

---

## 2. Review Priorities

Prioritize findings in this order:

1. Bugs and incorrect behavior
2. Security vulnerabilities
3. Data corruption, data loss, or destructive behavior
4. Broken edge cases
5. Incorrect assumptions about APIs, state, concurrency, or async behavior
6. Regression risks
7. Incorrect error handling
8. Performance problems that can materially affect the application
9. Poor reuse or duplicated logic
10. Unnecessary complexity or dead code
11. Maintainability problems
12. Inconsistency with established project patterns
13. Minor style issues

Do not report an issue merely because you personally would implement it differently.

---

# 3. Correctness & Bugs

Check for:

- Incorrect conditions
- Incorrect boolean logic
- Wrong comparisons
- Off-by-one errors
- Incorrect defaults
- Incorrect null/undefined handling
- Missing validation
- Incorrect assumptions about input shape
- Incorrect state transitions
- Race conditions
- Async ordering problems
- Promises that are not awaited when necessary
- Errors that are swallowed
- Incorrect error propagation
- Incorrect retry behavior
- Infinite loops
- Recursive behavior without safe termination
- Incorrect cleanup
- Resource leaks
- Incorrect lifecycle behavior
- Stale closures
- Stale state
- Incorrect memoization
- Incorrect dependency arrays
- Incorrect cache invalidation
- Incorrect optimistic updates
- Incorrect rollback behavior
- Incorrect transaction boundaries
- Partial failures leaving inconsistent state
- API contract mismatches
- Incorrect HTTP status handling
- Incorrect serialization/deserialization
- Incorrect date/time handling
- Timezone assumptions
- Numeric precision problems
- Incorrect sorting/filtering/pagination
- Incorrect handling of empty collections

Look for bugs introduced specifically by the current change, but also identify existing code that the change causes to behave incorrectly.

---

# 4. Edge Cases

Think through realistic edge cases relevant to the change.

Consider, when applicable:

- Empty input
- Missing input
- `null`
- `undefined`
- Zero
- Negative numbers
- Very large values
- Duplicate values
- Empty arrays
- Large arrays
- First item
- Last item
- Only item
- No results
- Multiple results
- Rapid repeated actions
- Double submission
- Slow network
- Network failure
- Timeout
- Partial API response
- Unexpected API response
- Unauthorized/expired session
- Concurrent requests
- Component unmounting during async work
- User navigating away during an operation
- Refresh/reload during an operation
- Browser differences
- Mobile-specific behavior
- Offline/poor connectivity
- Different screen sizes
- Different permissions/roles
- Existing records vs new records
- Migration/legacy data
- Backward compatibility

Do not blindly enumerate edge cases. Only mention ones that are plausible for the code being reviewed.

---

# 5. Security Review

Look for security problems introduced or exposed by the change.

Check, when relevant:

- Authentication bypass
- Authorization failures
- Missing ownership checks
- IDOR vulnerabilities
- Privilege escalation
- Sensitive data exposure
- Secrets accidentally committed
- API keys/tokens in client code
- Unsafe environment variable usage
- Injection vulnerabilities
- SQL injection
- NoSQL injection
- Command injection
- XSS
- HTML injection
- Unsafe URL handling
- Open redirects
- SSRF
- Path traversal
- Unsafe file uploads
- Unsafe file handling
- Insecure deserialization
- Weak validation
- Trusting client-provided permissions or roles
- Missing server-side validation
- Sensitive information in logs
- Excessive error details exposed to clients
- Insecure cookies
- Incorrect CORS behavior
- CSRF risks where applicable
- Missing rate limiting where appropriate
- Unsafe third-party integrations
- Insecure WebView usage
- Mobile deep-link/security issues where applicable

For frontend code, specifically verify that security-sensitive validation is not being performed exclusively on the client.

For backend code, assume all client-provided data is untrusted.

Do not flag theoretical security concerns without a credible attack path or meaningful risk.

---

# 6. Code Reuse & Duplication

Check whether the change:

- Reimplements an existing utility
- Duplicates an existing function
- Duplicates business logic
- Creates a component that already exists
- Creates a hook that overlaps with an existing hook
- Repeats API/request logic
- Repeats validation logic
- Repeats formatting logic
- Creates unnecessary types
- Creates unnecessary wrappers
- Reinvents existing project abstractions

Before suggesting reuse, actually search the repository for existing implementations.

Prefer existing abstractions when they are genuinely appropriate.

Do not recommend creating an abstraction solely to eliminate a few lines of simple code.

---

# 7. Unnecessary Code & Complexity

Look for:

- Dead code
- Unused imports
- Unused variables
- Unused parameters
- Unreachable branches
- Redundant conditions
- Duplicate checks
- Redundant state
- Derived state that does not need to be stored
- Over-engineered abstractions
- Excessive indirection
- Premature generalization
- Unnecessary configuration
- Unnecessary dependencies
- Overly complicated control flow
- Functions doing too many unrelated things
- Code that can be simplified without losing clarity

Prefer the simplest implementation that correctly solves the problem.

Do not suggest simplification merely because a different implementation is shorter.

---

# 8. Maintainability

Check:

- Naming
- Function responsibilities
- Component responsibilities
- Separation of concerns
- Type safety
- Readability
- Error handling
- API boundaries
- Coupling
- Cohesion
- Appropriate abstraction level
- Consistency with the existing architecture
- Whether future changes will be unnecessarily difficult

Follow the conventions already established in the repository unless there is a strong reason not to.

Do not impose generic architecture preferences over existing project conventions without justification.

---

# 9. Frontend-Specific Review

When frontend code is involved, additionally check:

### React / React Native

- Incorrect `useEffect` dependencies
- Effects that should not exist
- Infinite effect loops
- Stale closures
- Unnecessary rerenders
- Incorrect memoization
- Incorrect `useMemo`/`useCallback`
- State that should be derived
- State synchronization problems
- Race conditions between requests
- Incorrect loading/error states
- Missing cleanup
- Event listener leaks
- Timer leaks
- Subscription leaks
- Incorrect component keys
- Unnecessary prop drilling
- Components becoming too large
- Incorrect controlled/uncontrolled behavior

### Data Fetching

Check:

- Query cache invalidation
- Duplicate requests
- Incorrect query keys
- Missing loading states
- Missing error states
- Race conditions
- Stale data
- Optimistic update consistency
- Pagination/infinite query behavior
- Retry behavior

### UI/UX

Check:

- Broken loading states
- Broken empty states
- Broken error states
- Disabled states
- Double-click/double-submit behavior
- Accessibility
- Keyboard navigation where applicable
- Screen reader semantics
- Touch targets on mobile
- Responsive behavior
- Form validation
- User feedback after mutations

---

# 10. Backend-Specific Review

When backend code is involved, additionally check:

- Authorization at the correct layer
- Input validation
- DTO/schema validation
- Database constraints
- Transaction boundaries
- Race conditions
- N+1 queries
- Excessive database calls
- Missing indexes when clearly relevant
- Pagination
- Large/unbounded queries
- Correct HTTP semantics
- Idempotency
- Retry safety
- Rate limiting
- Error handling
- Logging
- Sensitive information in logs
- External API failures
- Timeout handling
- Connection/resource cleanup
- Backward compatibility
- Migration safety

---

# 11. Database Review

When database changes are involved, check:

- Data integrity
- Nullability
- Foreign keys
- Unique constraints
- Indexes
- Migration reversibility where applicable
- Migration ordering
- Existing data compatibility
- Default values
- Destructive migrations
- Locking behavior
- Performance implications
- Race conditions
- Transaction consistency

Pay particular attention to migrations that can fail on existing production data.

---

# 12. API Review

When API contracts change, check both sides when available.

Verify:

- Request/response shape
- Required vs optional fields
- Error responses
- HTTP status codes
- Validation
- Authentication
- Authorization
- Backward compatibility
- Pagination
- Filtering
- Sorting
- Nullability
- Serialization
- Versioning
- Client assumptions

Search the repository for consumers of changed APIs before concluding that a change is safe.

---

# 13. Performance

Only flag performance issues when they are meaningful or likely.

Look for:

- O(n²) or worse algorithms where avoidable
- Repeated expensive computation
- Excessive renders
- Large unnecessary payloads
- N+1 database queries
- Unnecessary network requests
- Duplicate requests
- Large synchronous work on the UI thread
- Memory leaks
- Unbounded caches
- Missing pagination
- Large lists rendered inefficiently
- Expensive operations inside loops
- Unnecessary serialization

Avoid premature optimization.

---

# 14. Tests

Review whether the change is adequately tested.

Look for:

- Missing tests for important behavior
- Missing regression tests for bug fixes
- Tests that only verify implementation details
- Tests that don't cover meaningful failure cases
- Tests that are overly brittle
- Missing edge-case coverage
- Missing authorization/security tests
- Missing API contract tests where appropriate

If existing tests are sufficient, do not demand additional tests just for the sake of increasing coverage.

When a meaningful bug is found, recommend the smallest useful regression test.

---

# 15. Git / Change Hygiene

Check:

- Unrelated changes
- Debug statements
- Temporary code
- Commented-out code
- Accidental files
- Generated files that should not be committed
- Environment files
- Secrets
- Large binaries
- Unexpected dependency changes
- Lockfile changes without corresponding dependency changes
- Changes that should probably be split into separate commits

Do not modify or remove anything automatically.

---

# 16. Dependency Review

When dependencies are added or changed, consider:

- Is the dependency actually necessary?
- Does the project already have an equivalent?
- Is it used correctly?
- Does it introduce unnecessary bundle size?
- Does it introduce security concerns?
- Is the dependency compatible with the current stack?
- Is the lockfile consistent?

Do not recommend adding a dependency for functionality that can reasonably be implemented with existing project dependencies or platform APIs.

---

# 17. Review Method

Use this process:

### Step 1 — Inspect

Understand the complete change and its surrounding code.

### Step 2 — Search

Search the repository for:

- Existing implementations
- Consumers of modified APIs
- Related components/hooks/services
- Existing tests
- Similar patterns
- Relevant types
- Configuration affecting the change

### Step 3 — Reason

Mentally execute important flows.

For each significant change ask:

- What happens with valid input?
- What happens with invalid input?
- What happens when something fails?
- What happens when it happens twice?
- What happens concurrently?
- What happens when data is missing?
- What happens with old data?
- What happens when the user is unauthorized?
- What happens when the network/database is unavailable?

### Step 4 — Verify

Where practical, use existing project tooling:

- Tests
- Type checking
- Linting
- Build
- Relevant scripts

Do not run destructive commands.

Do not modify the working tree merely to perform the review.

### Step 5 — Report

Only report findings that are actionable and supported by evidence from the code.

---

# 18. Finding Severity

Use these severity levels:

### 🔴 Critical

Must be fixed before pushing.

Examples:

- Authentication/authorization bypass
- Secret exposure
- Data corruption
- Severe security vulnerability
- Production-breaking behavior

### 🟠 High

Strongly recommend fixing before pushing.

Examples:

- Real functional bug
- Important edge case that breaks normal usage
- Significant regression
- Serious error-handling issue

### 🟡 Medium

Should be considered before pushing.

Examples:

- Maintainability issue
- Meaningful duplication
- Missing important test
- Non-critical performance issue
- Fragile implementation

### 🔵 Low

Minor improvement.

Examples:

- Small cleanup
- Minor inconsistency
- Non-critical simplification

Do not inflate severity.

---

# 19. Output Format

Start with a concise summary.

Use this structure:

## Pre-Push Review

**Status:** `READY` / `CHANGES RECOMMENDED` / `BLOCKED`

**Files reviewed:** X  
**Findings:** X

### 🔴 Critical

- `path/to/file.ts:42` — **Short title**
  - Explain the problem.
  - Explain why it can happen.
  - Explain the impact.
  - Give a concise recommendation.

### 🟠 High

...

### 🟡 Medium

...

### 🔵 Low

...

### What's good

Mention 2–5 meaningful things that were done well when appropriate.

Examples:

- Good reuse of the existing API abstraction.
- Correct handling of loading/error states.
- Appropriate authorization check.
- Good regression test coverage.

### Verification

List checks actually performed:

- `npm test` — passed
- `npm run lint` — passed
- `npm run typecheck` — passed

If a check was not run, explicitly say so.

### Final Recommendation

Conclude with one of:

**READY TO PUSH**  
No meaningful issues found.

**CHANGES RECOMMENDED BEFORE PUSH**  
No blocking issue, but the listed improvements are worth addressing.

**DO NOT PUSH YET**  
One or more Critical/High issues should be fixed first.

---

# 20. Important Review Rules

### Do not be a rubber stamp

Do not say everything looks good simply because the code compiles.

Actively look for problems.

### Do not be a nitpicker

Do not report:

- Personal style preferences
- Trivial formatting issues already handled by tooling
- Subjective refactoring preferences
- Hypothetical problems with no realistic impact

### Do not over-engineer

The goal is not to make the code perfect.

The goal is to make the change:

- Correct
- Secure
- Maintainable
- Consistent
- Appropriately tested
- Ready to push

### Do not change code automatically

This skill is a **reviewer**, not an implementation agent.

Unless explicitly instructed otherwise, only inspect and report.

### Always provide evidence

Every finding should point to a concrete file and preferably a line or relevant code section.

Avoid vague findings such as:

> "There may be a race condition."

Instead explain:

> `src/hooks/useUser.ts:34` — The request started by the previous user ID can resolve after `userId` changes and overwrite the state for the new user. Consider cancelling the previous request or validating the request identity before updating state.

### Prefer fewer high-quality findings

Five meaningful findings are better than twenty superficial ones.

---

# 21. Final Decision

Use this decision logic:

- Any **Critical** finding → `BLOCKED`
- Any **High** finding → `BLOCKED`
- Only Medium/Low findings → `CHANGES RECOMMENDED`
- No meaningful findings → `READY`

Do not call a change `READY` if important verification commands are failing.

If tests/typecheck/lint cannot be run because of environment limitations, mention that clearly rather than pretending verification passed.